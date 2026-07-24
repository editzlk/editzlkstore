import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, Timestamp, increment, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js";
import { emailjsConfig } from "./emailjs-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),storage=getStorage(app),$=id=>document.getElementById(id);
let downloads=[],uploads=[],orders=[],promos=[],portfolioProjects=[],portfolioBg={images:[],duration:7},unsubs=[];
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const money=n=>new Intl.NumberFormat("en-LK",{style:"currency",currency:"LKR",maximumFractionDigits:0}).format(Number(n)||0);
const bytes=n=>{if(!n)return"0 B";const u=["B","KB","MB","GB","TB"],i=Math.floor(Math.log(n)/Math.log(1024));return`${(n/1024**i).toFixed(i?2:0)} ${u[i]}`};
const date=v=>v?.toDate?v.toDate().toLocaleString():"Just now";
function toast(m,t="success"){$("toast").textContent=m;$("toast").className=`toast show ${t}`;setTimeout(()=>$("toast").className="toast",3200)}
$("togglePassword").onclick=()=>$("loginPassword").type=$("loginPassword").type==="password"?"text":"password";
$("loginForm").onsubmit=async e=>{e.preventDefault();$("loginMessage").textContent="Signing in…";try{const email=$("loginEmail").value.trim().toLowerCase();if(email!==ADMIN_EMAIL.toLowerCase())throw Error("This account is not authorized.");await signInWithEmailAndPassword(auth,email,$("loginPassword").value)}catch(e){$("loginMessage").textContent=e.message.replace("Firebase: ","")}};
$("logoutBtn").onclick=()=>signOut(auth);
onAuthStateChanged(auth,async user=>{const ok=user&&user.email?.toLowerCase()===ADMIN_EMAIL.toLowerCase();if(user&&!ok)await signOut(auth);$("loginView").hidden=!!ok;$("adminView").hidden=!ok;if(ok){$("adminEmail").textContent=user.email;start()}});
const panels={overview:$("overviewPanel"),portfolio:$("portfolioPanel"),slideshow:$("slideshowPanel"),downloads:$("downloadsPanel"),uploads:$("uploadsPanel"),orders:$("ordersPanel"),promos:$("promosPanel")};
function show(name){Object.entries(panels).forEach(([k,p])=>p?.classList.toggle("active",k===name));document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.panel===name));$("panelTitle").textContent=name[0].toUpperCase()+name.slice(1);document.querySelector(".sidebar").classList.remove("open")}
document.querySelectorAll("[data-panel]").forEach(b=>b.onclick=()=>show(b.dataset.panel));document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>show(b.dataset.go));$("sidebarToggle").onclick=()=>document.querySelector(".sidebar").classList.toggle("open");
function listen(qry,cb){unsubs.push(onSnapshot(qry,cb,e=>{console.error(e);toast(e.message,"error")}))}
function start(){if(unsubs.length)return;listen(doc(db,"siteSettings","portfolioBackground"),s=>{portfolioBg=s.data()||{images:[],duration:7};renderPortfolioBackgrounds()});listen(query(collection(db,"portfolioProjects"),orderBy("createdAt","desc")),s=>{portfolioProjects=s.docs.map(d=>({id:d.id,...d.data()}));renderPortfolio();stats()});listen(query(collection(db,"downloads"),orderBy("createdAt","desc")),s=>{downloads=s.docs.map(d=>({id:d.id,...d.data()}));renderDownloads();stats()});listen(query(collection(db,"clientUploads"),orderBy("uploadedAt","desc")),s=>{uploads=s.docs.map(d=>({id:d.id,...d.data()}));renderUploads();stats()});listen(query(collection(db,"orders"),orderBy("createdAt","desc")),s=>{orders=s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.sourceBrand==="EDITZ_LK"||(!x.sourceBrand&&(String(x.orderId||"").startsWith("BANK-")||Boolean(x.itemTitle)||Boolean(x.buyerEmail))));renderOrders();stats()});listen(query(collection(db,"promoCodes"),orderBy("createdAt","desc")),s=>{promos=s.docs.map(d=>({id:d.id,...d.data()}));renderPromos()})}
function stats(){if($("portfolioCount"))$("portfolioCount").textContent=portfolioProjects.filter(x=>x.published!==false).length;$("downloadCount").textContent=downloads.filter(x=>x.published).length;$("uploadCount").textContent=uploads.length;$("uploadSize").textContent=bytes(uploads.reduce((s,x)=>s+(x.size||0),0));$("pendingOrderCount").textContent=orders.filter(x=>x.status==="pending").length}
function renderDownloads(){const box=$("adminDownloads");box.innerHTML="";$("adminDownloadsEmpty").hidden=downloads.length>0;downloads.forEach(x=>{const paid=x.accessType==="paid"&&Number(x.price)>0,el=document.createElement("article");el.className="manage-card";el.innerHTML=`<img src="${esc(x.imageURL||"profile.png")}" alt=""><div class="manage-body"><div class="manage-tags"><span class="status-pill ${x.published?"published":"draft"}">${x.published?"Published":"Draft"}</span><span class="status-pill ${paid?"paid":"free"}">${paid?money(x.salePrice||x.price):"FREE"}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.description||"")}</p><div class="card-actions"><a href="${esc(x.link)}" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i></a><button data-edit="${x.id}"><i class="fa-solid fa-pen"></i></button><button class="danger" data-delete="${x.id}"><i class="fa-solid fa-trash"></i></button></div></div>`;box.appendChild(el)});box.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openDownload(downloads.find(x=>x.id===b.dataset.edit)));box.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteDownload(b.dataset.delete))}
function renderUploads(){const term=$("uploadSearch").value.toLowerCase(),filter=$("uploadFilter").value,list=uploads.filter(x=>{const type=x.type||"",group=type.startsWith("image/")?"image":type.startsWith("video/")?"video":"other";return(!term||`${x.originalName} ${type}`.toLowerCase().includes(term))&&(filter==="all"||filter===group)}),box=$("clientUploads");box.innerHTML="";$("clientUploadsEmpty").hidden=list.length>0;list.forEach(x=>{const el=document.createElement("article");el.className="upload-row";el.innerHTML=`<div class="file-icon"><i class="fa-solid fa-file"></i></div><div class="file-main"><h3>${esc(x.originalName)}</h3><p>${bytes(x.size)} • ${esc(x.type||"Unknown")} • ${date(x.uploadedAt)}</p></div><div class="row-actions"><button class="primary-mini" data-upload-download="${x.id}"><i class="fa-solid fa-download"></i><span>Download</span></button><button class="danger-mini" data-upload-delete="${x.id}"><i class="fa-solid fa-trash"></i></button></div>`;box.appendChild(el)});box.querySelectorAll("[data-upload-download]").forEach(b=>b.onclick=()=>downloadUpload(b.dataset.uploadDownload,b));box.querySelectorAll("[data-upload-delete]").forEach(b=>b.onclick=()=>deleteUpload(b.dataset.uploadDelete))}
$("uploadSearch").oninput=renderUploads;$("uploadFilter").onchange=renderUploads;$("refreshUploads").onclick=()=>{renderUploads();toast("Upload list refreshed")};
function renderOrders(){const term=$("orderSearch").value.toLowerCase(),filter=$("orderFilter").value,list=orders.filter(x=>(filter==="all"||x.status===filter)&&(!term||`${x.orderId} ${x.buyerName} ${x.buyerEmail} ${x.itemTitle}`.toLowerCase().includes(term))),box=$("ordersList");box.innerHTML="";$("ordersEmpty").hidden=list.length>0;list.forEach(x=>{const el=document.createElement("article");el.className="order-card";el.innerHTML=`<div class="order-top"><div><span class="order-id">${esc(x.orderId)}</span><h3>${esc(x.itemTitle)}</h3></div><span class="order-status ${esc(x.status)}">${esc(x.status)}</span></div><div class="order-info"><p><i class="fa-solid fa-user"></i>${esc(x.buyerName)}</p><p><i class="fa-solid fa-envelope"></i>${esc(x.buyerEmail)}</p><p><i class="fa-solid fa-phone"></i>${esc(x.buyerPhone)}</p><p><i class="fa-solid fa-money-bill"></i>${money(x.amount)} • ${esc(x.method)}</p><p><i class="fa-solid fa-calendar"></i>${date(x.createdAt)}</p>${x.promoCode?`<p><i class="fa-solid fa-ticket"></i>${esc(x.promoCode)}</p>`:""}</div><div class="order-actions">${x.receiptPath?`<button class="secondary-btn" data-view-receipt="${x.id}"><i class="fa-solid fa-receipt"></i> View Receipt</button>`:(x.receiptURL?`<a class="secondary-btn" href="${esc(x.receiptURL)}" target="_blank"><i class="fa-solid fa-receipt"></i> View Receipt</a>`:"")}${x.status==="pending"?`<button class="approve-btn" data-approve="${x.id}"><i class="fa-solid fa-check"></i> Approve & Email</button><button class="reject-btn" data-reject="${x.id}"><i class="fa-solid fa-xmark"></i> Reject</button>`:(x.status==="paid"?`<button class="secondary-btn" data-resend="${x.id}"><i class="fa-solid fa-envelope"></i> Resend Link</button>`:"")}<button class="danger-mini" data-order-delete="${x.id}"><i class="fa-solid fa-trash"></i></button></div>`;box.appendChild(el)});box.querySelectorAll("[data-view-receipt]").forEach(b=>b.onclick=()=>viewReceipt(b.dataset.viewReceipt));box.querySelectorAll("[data-approve]").forEach(b=>b.onclick=()=>setOrder(b.dataset.approve,"paid"));box.querySelectorAll("[data-resend]").forEach(b=>b.onclick=()=>resendOrderEmail(b.dataset.resend));box.querySelectorAll("[data-reject]").forEach(b=>b.onclick=()=>setOrder(b.dataset.reject,"rejected"));box.querySelectorAll("[data-order-delete]").forEach(b=>b.onclick=()=>deleteOrder(b.dataset.orderDelete))}

async function viewReceipt(id){
  const x=orders.find(o=>o.id===id);
  if(!x?.receiptPath){toast("Receipt file is unavailable","error");return;}
  try{
    toast("Opening receipt…");
    const url=await getDownloadURL(ref(storage,x.receiptPath));
    window.open(url,"_blank","noopener,noreferrer");
  }catch(e){
    console.error(e);
    toast("Could not open receipt. Check Storage rules and admin login.","error");
  }
}
$("orderSearch").oninput=renderOrders;$("orderFilter").onchange=renderOrders;$("refreshOrders").onclick=()=>{renderOrders();toast("Orders refreshed")};
function emailjsReady(){
  return Boolean(
    emailjsConfig?.publicKey &&
    emailjsConfig?.serviceId &&
    emailjsConfig?.templateId &&
    !String(emailjsConfig.publicKey).includes("YOUR_") &&
    !String(emailjsConfig.serviceId).includes("YOUR_") &&
    !String(emailjsConfig.templateId).includes("YOUR_")
  );
}
function emailTemplateParams(order, downloadLink){
  return {
    to_email: order.buyerEmail,
    to_name: order.buyerName || "Customer",
    customer_name: order.buyerName || "Customer",
    order_id: order.orderId || "",
    product_name: order.itemTitle || "Your purchase",
    item_title: order.itemTitle || "Your purchase",
    amount: money(order.amount),
    payment_method: order.method || "bank",
    download_link: downloadLink,
    reply_to: emailjsConfig.replyTo || ADMIN_EMAIL,
    support_email: emailjsConfig.replyTo || ADMIN_EMAIL,
    brand_name: emailjsConfig.brandName || "EDITZ LK",
    subject: `Your EDITZ LK download is ready — ${order.itemTitle || order.orderId}`,
    message: `Hi ${order.buyerName || "Customer"}, your payment has been approved. Use the download button below to access ${order.itemTitle || "your purchase"}.`
  };
}
async function sendDownloadEmail(order, downloadLink){
  if(!emailjsReady()){
    throw Error("EmailJS is not configured. Open emailjs-config.js and add your Public Key, Service ID and Template ID.");
  }
  const response=await fetch("https://api.emailjs.com/api/v1.0/email/send",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      service_id:emailjsConfig.serviceId,
      template_id:emailjsConfig.templateId,
      user_id:emailjsConfig.publicKey,
      template_params:emailTemplateParams(order,downloadLink)
    })
  });
  if(!response.ok){
    const detail=(await response.text()).trim();
    throw Error(`EmailJS failed (${response.status})${detail?`: ${detail}`:""}`);
  }
}
async function setOrder(id,status){
  const x=orders.find(o=>o.id===id);
  if(!x)return;
  if(!confirm(`${status==="paid"?"Approve payment and send the download email":"Reject"} for order ${x.orderId}?`))return;
  try{
    const downloadLink=status==="paid"?(downloads.find(d=>d.id===x.itemId)?.link||x.downloadLink||""):"";
    if(status==="paid"&&!downloadLink)throw Error("This product does not have a download link. Add the link in Download Files first.");
    if(status==="paid"&&!/^https?:\/\//i.test(downloadLink))throw Error("The download link must start with http:// or https://");
    if(status==="paid"&&!x.buyerEmail)throw Error("Customer email is missing.");

    if(status==="paid"){
      toast("Sending download email…");
      await sendDownloadEmail(x,downloadLink);
      await updateDoc(doc(db,"orders",id),{
        status:"paid",reviewedAt:serverTimestamp(),downloadLink,
        emailStatus:"sent",emailSentAt:serverTimestamp(),emailError:null
      });
      if(x.promoId)await updateDoc(doc(db,"promoCodes",x.promoId),{usedCount:increment(1)}).catch(()=>{});
      toast("Approved — download email sent");
    }else{
      await updateDoc(doc(db,"orders",id),{
        status:"rejected",reviewedAt:serverTimestamp(),emailStatus:"not_sent"
      });
      toast("Order rejected");
    }
  }catch(e){
    console.error(e);
    await updateDoc(doc(db,"orders",id),{emailStatus:"failed",emailError:String(e.message||e)}).catch(()=>{});
    toast(e.message||"Could not update order","error");
  }
}
async function resendOrderEmail(id){
  const x=orders.find(o=>o.id===id);if(!x)return;
  const downloadLink=x.downloadLink||(downloads.find(d=>d.id===x.itemId)?.link||"");
  if(!downloadLink){toast("Download link is missing","error");return;}
  try{
    toast("Resending download email…");
    await sendDownloadEmail(x,downloadLink);
    await updateDoc(doc(db,"orders",id),{emailStatus:"sent",emailSentAt:serverTimestamp(),emailError:null});
    toast("Download email sent again");
  }catch(e){
    await updateDoc(doc(db,"orders",id),{emailStatus:"failed",emailError:String(e.message||e)}).catch(()=>{});
    toast(e.message||"Could not send email","error");
  }
}
async function deleteOrder(id){const x=orders.find(o=>o.id===id);if(!confirm(`Delete order ${x?.orderId}?`))return;if(x?.receiptPath)await deleteObject(ref(storage,x.receiptPath)).catch(()=>{});await deleteDoc(doc(db,"orders",id));toast("Order deleted")}
function renderPromos(){const box=$("promoList");box.innerHTML="";$("promoEmpty").hidden=promos.length>0;promos.forEach(x=>{const el=document.createElement("article");el.className="promo-card";el.innerHTML=`<div class="promo-code">${esc(x.code)}</div><span class="status-pill ${x.active?"published":"draft"}">${x.active?"Active":"Inactive"}</span><h3>${x.type==="percent"?`${x.value}% OFF`:`${money(x.value)} OFF`}</h3><p>Minimum: ${money(x.minimum||0)} • Used: ${x.usedCount||0}${x.usageLimit?` / ${x.usageLimit}`:" / Unlimited"}</p><p>Expires: ${x.expiresAt?.toDate?x.expiresAt.toDate().toLocaleString():"Never"}</p><div class="card-actions"><button data-promo-edit="${x.id}"><i class="fa-solid fa-pen"></i></button><button class="danger" data-promo-delete="${x.id}"><i class="fa-solid fa-trash"></i></button></div>`;box.appendChild(el)});box.querySelectorAll("[data-promo-edit]").forEach(b=>b.onclick=()=>openPromo(promos.find(x=>x.id===b.dataset.promoEdit)));box.querySelectorAll("[data-promo-delete]").forEach(b=>b.onclick=()=>deletePromo(b.dataset.promoDelete))}
const dm=$("downloadModal");function openDownload(x=null){$("downloadForm").reset();$("editingId").value=x?.id||"";$("modalTitle").textContent=x?"Edit Download File":"Add Download File";$("downloadTitle").value=x?.title||"";$("downloadDescription").value=x?.description||"";$("downloadLink").value=x?.link||"";$("downloadImageURL").value=x?.imageURL||"";$("downloadPublished").checked=x?.published??true;$("downloadAccessType").value=x?.accessType||"free";$("downloadPrice").value=x?.price||0;$("downloadSalePrice").value=x?.salePrice||"";preview(x?.imageURL);dm.showModal()}function closeDownload(){dm.close();$("downloadMessage").textContent=""}$("openDownloadModal").onclick=()=>openDownload();$("closeDownloadModal").onclick=closeDownload;$("cancelDownload").onclick=closeDownload;function preview(url){$("coverPreview").innerHTML=url?`<img src="${esc(url)}" alt="Cover preview">`:'<i class="fa-solid fa-image"></i><span>Cover preview</span>'}$("downloadImageURL").oninput=e=>preview(e.target.value);$("downloadImageFile").onchange=e=>{if(e.target.files[0])preview(URL.createObjectURL(e.target.files[0]))};function uploadCover(file){return new Promise((res,rej)=>{const path=`download_covers/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`,task=uploadBytesResumable(ref(storage,path),file);task.on("state_changed",null,rej,async()=>res({imageURL:await getDownloadURL(task.snapshot.ref),imagePath:path}))})}
$("downloadForm").onsubmit=async e=>{e.preventDefault();const msg=$("downloadMessage");msg.textContent="Saving…";try{const id=$("editingId").value,old=downloads.find(x=>x.id===id),accessType=$("downloadAccessType").value,price=Math.max(0,Number($("downloadPrice").value)||0),sale=$("downloadSalePrice").value===""?null:Math.max(0,Number($("downloadSalePrice").value)||0);if(accessType==="paid"&&price<=0)throw Error("Enter a price greater than 0 for a paid download.");if(sale!==null&&sale>=price)throw Error("Sale price must be lower than the regular price.");let imageURL=$("downloadImageURL").value.trim()||old?.imageURL||"profile.png",imagePath=old?.imagePath||"";const file=$("downloadImageFile").files[0];if(file){const u=await uploadCover(file);imageURL=u.imageURL;imagePath=u.imagePath}const data={title:$("downloadTitle").value.trim(),description:$("downloadDescription").value.trim(),link:$("downloadLink").value.trim(),imageURL,imagePath,published:$("downloadPublished").checked,accessType,price:accessType==="paid"?price:0,salePrice:accessType==="paid"?sale:null,updatedAt:serverTimestamp()};id?await updateDoc(doc(db,"downloads",id),data):await addDoc(collection(db,"downloads"),{...data,createdAt:serverTimestamp()});closeDownload();toast(id?"Product updated":"Product added")}catch(e){msg.textContent=e.message}};
async function deleteDownload(id){const x=downloads.find(d=>d.id===id);if(!confirm(`Delete “${x?.title}”?`))return;if(x?.imagePath)await deleteObject(ref(storage,x.imagePath)).catch(()=>{});await deleteDoc(doc(db,"downloads",id));toast("Product deleted")}

async function downloadUpload(id,button){const x=uploads.find(u=>u.id===id);if(!x)return;const old=button?.innerHTML;if(button){button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i><span>Opening</span>'}try{const url=x.downloadURL||await getDownloadURL(ref(storage,x.storagePath));window.open(url,"_blank","noopener")}catch(error){console.error("Client file download failed:",error);toast(error?.code==="storage/unauthorized"?"Admin Storage read permission is missing.":"Could not open this file.")}finally{if(button){button.disabled=false;button.innerHTML=old}}}

async function deleteUpload(id){const x=uploads.find(u=>u.id===id);if(!confirm(`Delete “${x?.originalName}” permanently?`))return;if(x?.storagePath)await deleteObject(ref(storage,x.storagePath)).catch(()=>{});await deleteDoc(doc(db,"clientUploads",id));toast("Client file deleted")}
const pm=$("promoModal");function openPromo(x=null){$("promoForm").reset();$("promoEditingId").value=x?.id||"";$("promoModalTitle").textContent=x?"Edit Promo Code":"Add Promo Code";$("promoCode").value=x?.code||"";$("promoType").value=x?.type||"percent";$("promoValue").value=x?.value||"";$("promoMinimum").value=x?.minimum||0;$("promoLimit").value=x?.usageLimit||0;$("promoActive").checked=x?.active??true;if(x?.expiresAt?.toDate){const d=x.expiresAt.toDate();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());$("promoExpiry").value=d.toISOString().slice(0,16)}pm.showModal()}function closePromo(){pm.close();$("promoMessage").textContent=""}$("openPromoModal").onclick=()=>openPromo();$("closePromoModal").onclick=closePromo;$("cancelPromo").onclick=closePromo;
$("promoForm").onsubmit=async e=>{e.preventDefault();try{const id=$("promoEditingId").value,code=$("promoCode").value.trim().toUpperCase(),type=$("promoType").value,value=Number($("promoValue").value),expiry=$("promoExpiry").value;if(type==="percent"&&value>100)throw Error("Percentage cannot be more than 100.");if(promos.some(x=>x.code===code&&x.id!==id))throw Error("This promo code already exists.");const data={code,type,value,minimum:Number($("promoMinimum").value)||0,usageLimit:Number($("promoLimit").value)||0,active:$("promoActive").checked,expiresAt:expiry?Timestamp.fromDate(new Date(expiry)):null,updatedAt:serverTimestamp()};id?await updateDoc(doc(db,"promoCodes",id),data):await addDoc(collection(db,"promoCodes"),{...data,usedCount:0,createdAt:serverTimestamp()});closePromo();toast(id?"Promo updated":"Promo created")}catch(e){$("promoMessage").textContent=e.message}};
async function deletePromo(id){if(!confirm("Delete this promo code?"))return;await deleteDoc(doc(db,"promoCodes",id));toast("Promo deleted")}

/* Portfolio project manager */
const portfolioModal=$("portfolioModal");
function openPortfolio(x=null){
  $("portfolioForm").reset(); $("portfolioEditingId").value=x?.id||"";
  $("portfolioModalTitle").textContent=x?"Edit Project":"Add Project";
  $("portfolioTitle").value=x?.title||""; $("portfolioType").value=x?.type||"video";
  $("portfolioOrder").value=Number(x?.displayOrder)||0; $("portfolioLink").value=x?.link||"";
  $("portfolioDescription").value=x?.description||""; $("portfolioThumbnail").value=x?.thumbnailURL||"";
  $("portfolioFeatured").checked=Boolean(x?.featured); $("portfolioPublished").checked=x?.published!==false;
  portfolioModal.showModal();
}
function closePortfolio(){portfolioModal.close();$("portfolioMessage").textContent=""}
$("openPortfolioModal").onclick=()=>openPortfolio(); $("closePortfolioModal").onclick=closePortfolio; $("cancelPortfolio").onclick=closePortfolio;
$("portfolioForm").onsubmit=async e=>{e.preventDefault();const msg=$("portfolioMessage");msg.textContent="Saving project…";try{
  const id=$("portfolioEditingId").value, link=$("portfolioLink").value.trim(); new URL(link);
  const data={title:$("portfolioTitle").value.trim(),type:$("portfolioType").value,displayOrder:Number($("portfolioOrder").value)||0,link,description:$("portfolioDescription").value.trim(),thumbnailURL:$("portfolioThumbnail").value.trim(),featured:$("portfolioFeatured").checked,published:$("portfolioPublished").checked,updatedAt:serverTimestamp()};
  id?await updateDoc(doc(db,"portfolioProjects",id),data):await addDoc(collection(db,"portfolioProjects"),{...data,createdAt:serverTimestamp()}); closePortfolio();toast(id?"Portfolio project updated":"Portfolio project published");
}catch(err){msg.textContent=err?.message||"Could not save project."}};
async function deletePortfolio(id){const x=portfolioProjects.find(p=>p.id===id);if(!confirm(`Delete “${x?.title||'this project'}”?`))return;await deleteDoc(doc(db,"portfolioProjects",id));toast("Portfolio project deleted")}
function renderPortfolio(){const box=$("adminPortfolio");if(!box)return;box.innerHTML="";$("adminPortfolioEmpty").hidden=portfolioProjects.length>0;portfolioProjects.forEach(x=>{const el=document.createElement("article");el.className="manage-card portfolio-manage-card";el.innerHTML=`<div class="portfolio-admin-cover">${x.thumbnailURL?`<img src="${esc(x.thumbnailURL)}" alt="">`:'<i class="fa-solid fa-clapperboard"></i>'}</div><div class="manage-body"><div class="manage-tags"><span class="status-pill ${x.published!==false?'published':'draft'}">${x.published!==false?'Published':'Draft'}</span>${x.featured?'<span class="status-pill paid">Featured</span>':''}</div><h3>${esc(x.title)}</h3><p>${esc(x.description||x.link||'')}</p><div class="card-actions"><a href="${esc(x.link)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i></a><button data-portfolio-edit="${x.id}"><i class="fa-solid fa-pen"></i></button><button class="danger" data-portfolio-delete="${x.id}"><i class="fa-solid fa-trash"></i></button></div></div>`;box.appendChild(el)});box.querySelectorAll('[data-portfolio-edit]').forEach(b=>b.onclick=()=>openPortfolio(portfolioProjects.find(x=>x.id===b.dataset.portfolioEdit)));box.querySelectorAll('[data-portfolio-delete]').forEach(b=>b.onclick=()=>deletePortfolio(b.dataset.portfolioDelete))}


// Home hero slideshow manager
function renderPortfolioBackgrounds(){
  const box=$("portfolioBgList"),duration=$("portfolioBgDuration"); if(!box)return;
  const images=Array.isArray(portfolioBg.images)?portfolioBg.images:[];
  duration.value=Math.max(3,Number(portfolioBg.duration)||7);
  box.innerHTML=images.length?images.map((x,i)=>`<article class="background-thumb"><div class="bg-thumb-number">${String(i+1).padStart(2,"0")}</div><img src="${esc(x.url||x)}" alt="Home background ${i+1}"><div class="bg-thumb-overlay"><span><i class="fa-solid fa-image"></i> Slide ${i+1}</span><button type="button" data-bg-remove="${i}" title="Remove image"><i class="fa-solid fa-trash"></i></button></div></article>`).join(""):`<div class="slideshow-empty"><i class="fa-regular fa-images"></i><h3>No background images yet</h3><p>Select images above and press Upload Images. They will fade smoothly behind the Home section.</p></div>`;
  box.querySelectorAll('[data-bg-remove]').forEach(b=>b.onclick=async()=>{if(!confirm('Remove this slideshow image?'))return;try{const next=[...images];const removed=next.splice(Number(b.dataset.bgRemove),1)[0];await setDoc(doc(db,"siteSettings","portfolioBackground"),{images:next,duration:Math.max(3,Number(portfolioBg.duration)||7),updatedAt:serverTimestamp()},{merge:true});if(removed?.path){try{await deleteObject(ref(storage,removed.path))}catch(err){console.warn(err)}}toast("Slideshow image removed")}catch(e){toast(e.message||"Could not remove image","error")}});
}
if($("uploadPortfolioBg"))$("uploadPortfolioBg").onclick=async()=>{
  const files=[...($("portfolioBgFiles").files||[])],msg=$("portfolioBgProgress");
  if(!files.length){msg.textContent="Choose one or more images first.";return}
  const current=Array.isArray(portfolioBg.images)?[...portfolioBg.images]:[];
  try{
    for(let i=0;i<files.length;i++){
      const f=files[i]; if(!f.type.startsWith("image/"))continue;
      msg.textContent=`Uploading ${i+1} of ${files.length}: ${f.name}`;
      const path=`site_backgrounds/${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`;
      const task=uploadBytesResumable(ref(storage,path),f,{contentType:f.type});
      await new Promise((resolve,reject)=>task.on("state_changed",snap=>{msg.textContent=`Uploading ${i+1} of ${files.length} — ${Math.round(snap.bytesTransferred/snap.totalBytes*100)}%`},reject,resolve));
      current.push({url:await getDownloadURL(task.snapshot.ref),path,name:f.name});
    }
    await setDoc(doc(db,"siteSettings","portfolioBackground"),{images:current,duration:Math.max(3,Number($("portfolioBgDuration").value)||7),updatedAt:serverTimestamp()},{merge:true});
    $("portfolioBgFiles").value="";msg.textContent="Home slideshow updated successfully.";toast("Home slideshow images uploaded");
  }catch(e){console.error(e);msg.textContent=e.message;toast("Background upload failed","error")}
};
if($("savePortfolioBgSettings"))$("savePortfolioBgSettings").onclick=async()=>{await setDoc(doc(db,"siteSettings","portfolioBackground"),{duration:Math.max(3,Number($("portfolioBgDuration").value)||7),updatedAt:serverTimestamp()},{merge:true});toast("Home slideshow settings saved")};

const bgFilesInput=$("portfolioBgFiles"),bgFileStatus=$("bgFileStatus");
if(bgFilesInput&&bgFileStatus)bgFilesInput.addEventListener("change",()=>{const fs=[...(bgFilesInput.files||[])];bgFileStatus.innerHTML=fs.length?`<i class="fa-solid fa-circle-check"></i><strong>${fs.length}</strong> image${fs.length===1?"":"s"} selected`:`<i class="fa-solid fa-images"></i> Choose multiple JPG, PNG or WEBP images`;});
