// KB LABEL entrance controller — index page only
function kbHidePageLoader(){
  const loader = document.getElementById("kbPageLoader");
  if (!loader) return;
  loader.classList.add("is-hidden");
  document.body.classList.remove("kb-loading");
  window.setTimeout(() => loader.remove(), 650);
}
function kbShowOrderLoader(title="Securing Your Order", text="Preparing your premium streetwear order...") {
  const box = document.getElementById("kbOrderLoader");
  if (!box) return;
  const heading = document.getElementById("kbOrderLoaderTitle");
  const detail = document.getElementById("kbOrderLoaderText");
  if (heading) heading.textContent = title;
  if (detail) detail.textContent = text;
  box.classList.add("is-active");
  box.setAttribute("aria-hidden", "false");
  document.body.classList.add("kb-order-processing");
}
function kbUpdateOrderLoader(title, text) {
  const heading = document.getElementById("kbOrderLoaderTitle");
  const detail = document.getElementById("kbOrderLoaderText");
  if (heading && title) heading.textContent = title;
  if (detail && text) detail.textContent = text;
}
function kbHideOrderLoader() {
  const box = document.getElementById("kbOrderLoader");
  if (box) {
    box.classList.remove("is-active");
    box.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("kb-order-processing");
}

document.addEventListener("DOMContentLoaded", () => {
  const enter = document.getElementById("kbEnterSite");
  if (!enter) {
    document.body.classList.remove("kb-loading");
    return;
  }
  const openSite = () => {
    if (enter.disabled) return;
    enter.disabled = true;
    enter.classList.add("is-entering");
    window.setTimeout(kbHidePageLoader, 180);
  };
  enter.addEventListener("click", openSite, { once: true });
  enter.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") openSite();
  });
});

const $ = (s, p = document) => p.querySelector(s),
  $$ = (s, p = document) => [...p.querySelectorAll(s)];
const money = (n) => `Rs. ${Number(n).toLocaleString()}`;
function hasProductDiscount(product) {
  const regular = Number(product?.price || 0);
  const discount = Number(product?.discountPrice || 0);
  return Boolean(product?.discountEnabled) && discount > 0 && discount < regular;
}
function productPrice(product) {
  return hasProductDiscount(product) ? Number(product.discountPrice) : Number(product?.price || 0);
}
function productPriceMarkup(product, className = "") {
  if (!hasProductDiscount(product)) return `<span class="${className}">${money(product?.price || 0)}</span>`;
  const percent = Math.round((1 - Number(product.discountPrice) / Number(product.price)) * 100);
  return `<span class="discount-price-wrap ${className}"><strong>${money(product.discountPrice)}</strong><del>${money(product.price)}</del><em>-${percent}%</em></span>`;
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}
function resolveProductImage(product) {
  const candidates = [
    product?.image,
    product?.imageUrl,
    product?.imageURL,
    product?.thumbnail,
    product?.thumbnailUrl,
    product?.coverImage,
    product?.photo,
    product?.photoUrl,
    ...(Array.isArray(product?.images) ? product.images : [])
  ];
  for (const candidate of candidates) {
    const value = typeof candidate === "string"
      ? candidate
      : candidate?.url || candidate?.downloadURL || candidate?.src || candidate?.image;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return String(product?.category || "").toLowerCase() === "hoodies"
    ? "hoodie-feature.webp"
    : "tshirt-feature.webp";
}
function productImageMarkup(product, alt = "Product image", extraClass = "") {
  const src = escapeHtml(resolveProductImage(product));
  const fallback = String(product?.category || "").toLowerCase() === "hoodies"
    ? "hoodie-feature.webp"
    : "tshirt-feature.webp";
  return `<img src="${src}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" class="kb-product-img kb-img-pending ${extraClass}" data-fallback="${fallback}" onload="this.classList.add('is-loaded');this.classList.remove('kb-img-pending')" onerror="if(this.dataset.retried!=='1'){this.dataset.retried='1';this.src=this.dataset.fallback}else{this.classList.add('is-broken')}" referrerpolicy="no-referrer">`;
}
function stockState(product) {
  return String(product?.stockStatus || "in-stock").toLowerCase() === "out-of-stock" ? "out" : "in";
}
function stockBadgeMarkup(product) {
  const isOut = stockState(product) === "out";
  return `<span class="premium-stock-badge ${isOut ? "stock-badge-out" : "stock-badge-in"}"><i></i><span><strong>${isOut ? "OUT OF STOCK" : "IN STOCK"}</strong><small>${isOut ? "Currently unavailable" : "Ready to order"}</small></span></span>`;
}
const store = {
  get(k, f = []) {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? f;
    } catch {
      return f;
    }
  },
  set(k, v) {
    localStorage.setItem(k, JSON.stringify(v));
  },
};
let KB_LIVE_PRODUCTS = Array.isArray(window.KB_PRODUCTS) ? [...window.KB_PRODUCTS] : [];
function getProducts() {
  return KB_LIVE_PRODUCTS;
}
function saveProducts(v) {
  KB_LIVE_PRODUCTS = Array.isArray(v) ? v : [];
}

function productMatchesId(product, id) {
  const wanted = String(id);
  return [product?.id, product?.legacyId, product?.localId]
    .filter((value) => value !== undefined && value !== null)
    .some((value) => String(value) === wanted);
}
function findProductById(id, products = getProducts()) {
  return products.find((product) => productMatchesId(product, id));
}
let kbProductUnsubscribe = null;
async function syncFirebaseProducts({ live = true } = {}) {
  if (!window.kbFirebaseProducts) return getProducts();
  const applyProducts = (products) => {
    saveProducts(Array.isArray(products) ? products : []);
    refreshProductViews();
  };
  try {
    const products = await window.kbFirebaseProducts.load();
    applyProducts(products);
    if (live && window.kbFirebaseProducts.subscribe) {
      if (typeof kbProductUnsubscribe === "function") kbProductUnsubscribe();
      kbProductUnsubscribe = window.kbFirebaseProducts.subscribe(applyProducts, (error) => {
        console.error("Live product sync failed:", error);
        toast(error?.code === "permission-denied" ? "Product read blocked by Firestore Rules." : "Live product sync unavailable.");
      });
    }
    return products;
  } catch (error) {
    console.error("Firebase products could not be loaded:", error);
    saveProducts([]);
    refreshProductViews();
    toast(error?.code === "permission-denied" ? "Product read blocked by Firestore Rules." : "Products could not be loaded.");
    return [];
  }
}

let kbOrderUnsubscribe = null;
async function syncFirebaseOrders({ live = true } = {}) {
  if (!(".admin-shell" && document.querySelector(".admin-shell"))) return [];
  if (!window.kbFirebaseOrders?.load) return store.get("kb_orders");
  try {
    const applyOrders = (orders) => {
      store.set("kb_orders", Array.isArray(orders) ? orders : []);
      renderAdmin();
    };
    const orders = await window.kbFirebaseOrders.load();
    applyOrders(orders);
    if (live && window.kbFirebaseOrders.subscribe) {
      if (typeof kbOrderUnsubscribe === "function") kbOrderUnsubscribe();
      kbOrderUnsubscribe = window.kbFirebaseOrders.subscribe(applyOrders, (error) => {
        console.error("Firebase orders could not be watched:", error);
        toast("Order live sync failed. Refresh the page.");
      });
    }
    return orders;
  } catch (error) {
    console.error("Firebase orders could not be loaded:", error);
    toast(error?.code === "permission-denied" ? "Order permission denied. Check Firestore Rules." : "Orders could not be loaded");
    return store.get("kb_orders");
  }
}

function startAdminOrderSyncAfterLogin() {
  if (!document.querySelector(".admin-shell")) return;
  const start = (authApi) => {
    authApi.onAuthStateChanged((user) => {
      if (user) syncFirebaseOrders({ live: true });
    });
  };
  if (window.kbFirebaseAuth) start(window.kbFirebaseAuth);
  else window.addEventListener("kb-auth-ready", () => start(window.kbFirebaseAuth), { once: true });
}

function refreshProductViews() {
  renderFeatured();
  renderShop();
  renderProduct();
  renderCart();
  renderWishlist();
  renderCheckout();
  renderAdmin();
}
function toast(msg) {
  let t = $(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}
function cart() {
  return store.get("kb_cart");
}
function wishlist() {
  return store.get("kb_wishlist");
}
function updateCounts() {
  $$(".cart-count").forEach(
    (x) => (x.textContent = cart().reduce((a, b) => a + b.qty, 0)),
  );
  $$(".wishlist-count").forEach((x) => (x.textContent = wishlist().length));
}
function addCart(id, size = "M", color = "Black", qty = 1) {
  let c = cart(),
    i = c.findIndex((x) => String(x.id) === String(id) && x.size == size && x.color == color);
  i > -1 ? (c[i].qty += qty) : c.push({ id: String(id), size, color, qty });
  store.set("kb_cart", c);
  updateCounts();
  toast("Added to cart");
}
function toggleWish(id) {
  let w = wishlist();
  w.includes(String(id)) ? (w = w.filter((x) => x !== String(id))) : w.push(String(id));
  store.set("kb_wishlist", w);
  updateCounts();
  toast(w.includes(String(id)) ? "Saved to wishlist" : "Removed from wishlist");
  renderWishlist();
}
function card(p) {
  const id = encodeURIComponent(String(p.id));
  const wished = wishlist().includes(String(p.id));
  const outOfStock = stockState(p) === "out";
  const typeLabel = String(p.category || "t-shirts").toLowerCase() === "hoodies" ? "Hoodie" : "T-Shirt";
  return `<article class="product-card ${outOfStock ? "is-out-of-stock" : "is-in-stock"}"><a class="product-image" href="product.html?id=${id}">${productImageMarkup(p, p.name)}<span class="badge">${escapeHtml(p.badge || "KB LABEL")}</span>${stockBadgeMarkup(p)}<div class="product-actions"><button data-wish-id="${String(p.id)}" onclick="event.preventDefault();toggleWish(this.dataset.wishId)" aria-label="Wishlist"><i class="${wished ? "fa-solid" : "fa-regular"} fa-heart"></i></button></div><button class="quick-add ${outOfStock ? "stock-view-only" : ""}" onclick="event.preventDefault();location.href='product.html?id=${id}'">${outOfStock ? "View Details" : "Select Options"}</button></a><div class="product-info"><small class="product-type-label">${typeLabel}</small><a href="product.html?id=${id}"><h3>${escapeHtml(p.name)}</h3></a><p>${productPriceMarkup(p, "card-price")}</p></div></article>`;
}
function renderFeatured() {
  const el = $("#featuredProducts");
  if (!el) return;
  const products = getProducts().filter((p) => p.active !== false).slice(0, 4);
  el.innerHTML = products.length
    ? products.map(card).join("")
    : `<div class="empty-state shop-empty-state"><div class="empty-icon"><i class="fa-solid fa-shirt"></i></div><h2>New products coming soon.</h2><p>Products added from the KB Label admin panel will appear here automatically.</p><a class="btn btn-dark" href="shop.html">Visit Shop</a></div>`;
}
function renderShop() {
  const el = $("#shopProducts");
  if (!el) return;

  const params = new URLSearchParams(location.search);
  const urlCategory = (params.get("category") || "").toLowerCase();
  const urlFilter = (params.get("filter") || "").toLowerCase();
  const searchValue = ($("#shopSearch")?.value || "").trim().toLowerCase();
  const selectedCategory = ($("#categoryFilter")?.value || "all").toLowerCase();
  const category = selectedCategory !== "all" ? selectedCategory : urlCategory || "all";
  const sort = $("#sortFilter")?.value || "featured";

  let ps = [...getProducts()].filter((p) => {
    const matchesCategory = category === "all" || String(p.category || "").toLowerCase() === category;
    const matchesSearch = String(p.name || "").toLowerCase().includes(searchValue);
    const matchesNew = urlFilter !== "new" || String(p.badge || "").toLowerCase() === "new";
    return matchesCategory && matchesSearch && matchesNew;
  });

  if (sort === "low") ps.sort((a, b) => productPrice(a) - productPrice(b));
  if (sort === "high") ps.sort((a, b) => productPrice(b) - productPrice(a));

  el.innerHTML = ps.length
    ? ps.map(card).join("")
    : `<div class="empty-state shop-empty-state"><div class="empty-icon"><i class="fa-solid fa-box-open"></i></div><h2>No products available.</h2><p>Products added from the unified admin panel will appear here instantly.</p></div>`;

  const count = $("#productCount");
  if (count) count.textContent = ps.length;
}
function renderProduct() {
  const el = $("#productPage");
  if (!el) return;

  const products = getProducts();
  if (!products.length) {
    el.innerHTML = `<div class="empty-state shop-empty-state"><div class="empty-icon"><i class="fa-solid fa-shirt"></i></div><h2>No product selected.</h2><p>Add products from the KB Label admin panel, then open them from the shop.</p><a class="btn btn-dark" href="shop.html">Back to Shop</a></div>`;
    return;
  }

  const id = new URLSearchParams(location.search).get("id") || String(products[0].id);
  const p = findProductById(id, products) || products[0];
  const outOfStock = String(p.stockStatus || "in-stock") === "out-of-stock";
  const sizes = p.sizes?.length ? p.sizes : ["S", "M", "L", "XL"];
  const colors = p.colors?.length ? p.colors : ["Black", "White"];

  document.title = `${p.name} | KB Label`;
  el.innerHTML = `<div class="product-gallery">${productImageMarkup(p, p.name)}</div><div class="product-details"><span class="eyebrow dark">${p.badge || "KB LABEL"}</span><h1>${p.name}</h1><div class="product-price">${productPriceMarkup(p, "product-page-price")}</div><div class="product-stock ${outOfStock ? "out" : "in"}">${outOfStock ? "Out of Stock" : "In Stock"}</div><p class="product-desc">${p.description || ""}</p><h4>SELECT COLOR</h4><div class="color-list">${colors.map((color, i) => `<button type="button" class="color-btn ${i === 0 ? "active" : ""}" data-color="${color}" aria-label="${color}"><span class="color-dot ${color.toLowerCase()}"></span>${color}</button>`).join("")}</div><h4>SELECT SIZE</h4><div class="size-list">${sizes.map((size, i) => `<button type="button" class="size-btn ${i === 0 ? "active" : ""}" data-size="${size}">${size}</button>`).join("")}</div><div class="selected-variant">Selected: <strong id="selectedVariant">${colors[0]} / ${sizes[0]}</strong></div><div class="product-buy"><div class="qty-control"><button type="button" id="minusQty">−</button><span id="qtyValue">1</span><button type="button" id="plusQty">+</button></div><button class="btn btn-dark" id="addProductCart" ${outOfStock ? "disabled" : ""}>${outOfStock ? "Out of Stock" : "Add to Cart"}</button></div><button class="btn full" id="wishProduct"><i class="fa-regular fa-heart"></i>&nbsp; Add to Wishlist</button><div class="details-list"><div>Premium heavyweight cotton blend</div><div>Oversized streetwear fit</div><div>Available in Black and White</div><div>Islandwide delivery available</div><div>Cash on Delivery & Bank Transfer</div></div></div>`;

  let size = sizes[0];
  let color = colors[0];
  let qty = 1;
  const updateVariant = () => {
    const label = $("#selectedVariant", el);
    if (label) label.textContent = `${color} / ${size}`;
  };

  $$(".size-btn", el).forEach((button) => {
    button.onclick = () => {
      $$(".size-btn", el).forEach((x) => x.classList.remove("active"));
      button.classList.add("active");
      size = button.dataset.size;
      updateVariant();
    };
  });

  $$(".color-btn", el).forEach((button) => {
    button.onclick = () => {
      $$(".color-btn", el).forEach((x) => x.classList.remove("active"));
      button.classList.add("active");
      color = button.dataset.color;
      updateVariant();
    };
  });

  $("#minusQty", el).onclick = () => {
    qty = Math.max(1, qty - 1);
    $("#qtyValue", el).textContent = qty;
  };
  $("#plusQty", el).onclick = () => {
    qty += 1;
    $("#qtyValue", el).textContent = qty;
  };
  if (!outOfStock) $("#addProductCart", el).onclick = () => addCart(p.id, size, color, qty);
  $("#wishProduct", el).onclick = () => toggleWish(p.id);

  const rel = $("#relatedProducts");
  if (rel) rel.innerHTML = products.filter((x) => String(x.id) !== String(p.id)).slice(0, 4).map(card).join("");
}
function renderCart() {
  let el = $("#cartItems"),
    sum = $("#cartSummary");
  if (!el) return;
  let c = cart(),
    ps = getProducts();
  if (!c.length) {
    el.innerHTML = `<div class="empty-state"><h2>Your cart is empty.</h2><p>Discover the latest KB Label collection.</p><a class="btn btn-dark" href="shop.html">Start Shopping</a></div>`;
    sum.innerHTML = "";
    return;
  }
  el.innerHTML = c
    .map((x, i) => {
      let p = findProductById(x.id, ps);
      if (!p) return "";
      return `<div class="cart-item"><img src="${p.image}" loading="lazy" decoding="async" class="kb-img-pending"><div class="cart-meta"><small>${p.category}</small><h3>${p.name}</h3><p>Color: ${x.color || "Black"} &nbsp;|&nbsp; Size: ${x.size}</p><div class="qty-control"><button onclick="changeQty(${i},-1)">−</button><span>${x.qty}</span><button onclick="changeQty(${i},1)">+</button></div></div><div><strong>${money(productPrice(p) * x.qty)}</strong><br><button class="remove-btn" onclick="removeCart(${i})">Remove</button></div></div>`;
    })
    .join("");
  let sub = c.reduce((a, x) => {
    let p = findProductById(x.id, ps);
    return a + (p ? productPrice(p) * x.qty : 0);
  }, 0);
  sum.innerHTML = `<h2>Order Summary</h2><div class="summary-row"><span>Subtotal</span><b>${money(sub)}</b></div><div class="summary-row"><span>Delivery</span><span>Calculated at checkout</span></div><div class="summary-row total"><span>Total</span><span>${money(sub)}</span></div><a class="btn btn-dark full" href="checkout.html">Proceed to Checkout</a>`;
}
window.changeQty = (i, d) => {
  let c = cart();
  c[i].qty = Math.max(1, c[i].qty + d);
  store.set("kb_cart", c);
  renderCart();
  updateCounts();
};
window.removeCart = (i) => {
  let c = cart();
  c.splice(i, 1);
  store.set("kb_cart", c);
  renderCart();
  updateCounts();
};
function renderWishlist() {
  let el = $("#wishlistProducts");
  if (!el) return;
  let ps = getProducts().filter((p) => wishlist().some((id) => productMatchesId(p, id)));
  el.innerHTML = ps.length
    ? ps.map(card).join("")
    : `<div class="empty-state"><h2>No saved products yet.</h2><a class="btn btn-dark" href="shop.html">Explore Products</a></div>`;
}
function renderCheckout() {
  let el = $("#checkoutSummary");
  if (!el) return;
  let c = cart(),
    ps = getProducts();
  if (!c.length) {
    el.innerHTML = `<h2>Your cart is empty</h2><a class="btn btn-dark full" href="shop.html">Shop Now</a>`;
    return;
  }
  let sub = c.reduce((a, x) => {
      let p = findProductById(x.id, ps);
      return a + (p ? productPrice(p) * x.qty : 0);
    }, 0),
    delivery = $("#district")?.value === "Colombo" ? 350 : 450;
  el.innerHTML = `<h2>Your Order</h2>${c
    .map((x) => {
      let p = findProductById(x.id, ps);
      return p
        ? `<div class="summary-row"><span>${p.name} × ${x.qty}<small style="display:block;color:#777">${x.color || "Black"} / Size ${x.size}</small></span><b>${money(productPrice(p) * x.qty)}</b></div>`
        : "";
    })
    .join(
      "",
    )}<div class="summary-row"><span>Subtotal</span><b>${money(sub)}</b></div><div class="summary-row"><span>Delivery</span><b>${money(delivery)}</b></div><div class="summary-row total"><span>Total</span><span>${money(sub + delivery)}</span></div><button class="btn btn-dark full" type="submit">Place Order</button>`;
}
function setupCheckout() {
  const form = $("#checkoutForm");
  if (!form) return;

  $$('input[name="payment"]').forEach(radio => {
    radio.onchange = () => {
      $("#bankDetails")?.classList.toggle(
        "show",
        radio.value === "bank" && radio.checked
      );
      const cardPanel = $("#cardPaymentPanel");
      const showCard = radio.value === "card" && radio.checked;
      cardPanel?.classList.toggle("show", showCard);
      cardPanel?.setAttribute("aria-hidden", showCard ? "false" : "true");
    };
  });

  $("#district").onchange = renderCheckout;

  $("#bankSlip").onchange = event => {
    $("#fileName").textContent =
      event.target.files[0]?.name || "Choose image or PDF";
  };

  form.onsubmit = async event => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton?.textContent || "Place Order";
    const formData = new FormData(form);
    const paymentMethod = formData.get("payment");
    const receiptFile = $("#bankSlip")?.files?.[0] || null;

    if (paymentMethod === "bank" && !receiptFile) {
      toast("Please upload your bank receipt");
      return;
    }

    const products = getProducts();
    const cartItems = cart();

    if (!cartItems.length) {
      toast("Your cart is empty");
      return;
    }

    const items = cartItems
      .map(item => {
        const product = products.find(product => String(product.id) === String(item.id));
        if (!product) return null;

        return {
          productId: product.id,
          name: product.name,
          image: product.image,
          size: item.size,
          color: item.color || "Black",
          qty: item.qty,
          unitPrice: productPrice(product),
          lineTotal: productPrice(product) * item.qty
        };
      })
      .filter(Boolean);

    const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
    const delivery = formData.get("district") === "Colombo" ? 350 : 450;

    const payload = {
      customer: {
        name: String(formData.get("name") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        address: String(formData.get("address") || "").trim(),
        district: String(formData.get("district") || "").trim()
      },
      items,
      subtotal,
      delivery,
      total: subtotal + delivery,
      paymentMethod,
      paymentStatus: paymentMethod === "card" ? "Awaiting Payment" : "Pending",
      paymentTransactionId: ""
    };

    try {
      if (paymentMethod === "card") {
        kbShowOrderLoader("Secure Card Payment", "Opening the encrypted payment gateway...");
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = "Opening secure payment...";
        }
        if (typeof window.startKbCardPayment !== "function") {
          throw new Error("Card payment service failed to load.");
        }
        const cardResult = await window.startKbCardPayment(payload);
        payload.paymentStatus = cardResult.status || "Paid";
        payload.paymentTransactionId = cardResult.paymentId || "";
      }
      kbShowOrderLoader("Securing Your Order", paymentMethod === "bank" ? "Uploading your payment receipt securely..." : paymentMethod === "card" ? "Confirming your secure card payment..." : "Connecting to KB LABEL order service...");
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent =
          paymentMethod === "bank"
            ? "Uploading receipt..."
            : paymentMethod === "card"
              ? "Confirming payment..."
              : "Sending order...";
      }

      if (typeof window.submitFirebaseOrder !== "function") {
        throw new Error("Firebase order service failed to load.");
      }

      kbUpdateOrderLoader(paymentMethod === "bank" ? "Verifying Payment" : paymentMethod === "card" ? "Payment Approved" : "Creating Your Order", "Almost there — locking in your selected pieces...");
      const result = await window.submitFirebaseOrder(payload, receiptFile);
      kbUpdateOrderLoader("Order Confirmed", "Your KB LABEL Clothing order is ready.");

      // Keep a local copy so My Orders works immediately on this browser too.
      const localOrders = store.get("kb_orders");
      localOrders.unshift({
        id: result.orderId,
        date: new Date().toISOString(),
        name: payload.customer.name,
        phone: payload.customer.phone,
        email: payload.customer.email,
        address: payload.customer.address,
        district: payload.customer.district,
        payment: payload.paymentMethod,
        paymentStatus: payload.paymentStatus,
        paymentTransactionId: payload.paymentTransactionId,
        status: "Pending",
        items: items,
        total: payload.total,
        bankSlipUrl: result.bankSlipUrl
      });

      store.set("kb_orders", localOrders);
      store.set("kb_cart", []);
      updateCounts();

      showOrderSuccessCard({
        orderId: result.orderId,
        phone: payload.customer.phone,
        email: payload.customer.email,
        warning: [result.trackingWarning, result.emailWarning].filter(Boolean).join(" ")
      });
    } catch (error) {
      kbHideOrderLoader();
      console.error(error);
      const readableError =
        typeof error === "string"
          ? error
          : error?.message || error?.code || "Please check your internet connection and Firebase setup, then try again.";
      alert("Order could not be sent.\n\n" + readableError);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  };
}


function showOrderSuccessCard({ orderId, phone = "", email = "", warning = "" }) {
  document.querySelector(".order-success-overlay")?.remove();
  const trackingUrl = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}my-orders.html?id=${encodeURIComponent(orderId)}`;
  const overlay = document.createElement("div");
  overlay.className = "order-success-overlay";
  overlay.innerHTML = `<section class="order-success-card" role="dialog" aria-modal="true" aria-label="Order confirmed">
    <div class="success-orbit"><i class="fa-solid fa-check"></i><span></span><span></span></div>
    <span class="success-kicker">ORDER SECURED</span>
    <h2>Your order is confirmed</h2>
    <p>You do not need to memorize the tracking number. This order has been saved automatically under <strong>My Saved Orders</strong> on this device.</p>
    <div class="success-order-id"><small>YOUR ORDER ID</small><strong>${orderId}</strong><button type="button" data-copy-order title="Copy order ID"><i class="fa-regular fa-copy"></i></button></div>
    <div class="success-note"><i class="fa-solid fa-mobile-screen-button"></i><span>Open Track Order anytime from this same browser and tap your saved order.</span></div>
    <div class="success-actions">
      <a class="btn btn-dark" href="my-orders.html?id=${encodeURIComponent(orderId)}"><i class="fa-solid fa-location-dot"></i> Track My Order</a>
      <button class="btn success-share" type="button" data-share-order><i class="fa-solid fa-share-nodes"></i> Share / Save Link</button>
    </div>
    ${warning ? `<div class="success-note success-warning"><i class="fa-solid fa-triangle-exclamation"></i><span>${warning.replace(/[<>&]/g, "")}</span></div>` : ""}
    ${email ? `<small class="success-email">Order contact: ${email.replace(/[<>&]/g, "")}</small>` : ""}
  </section>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));
  overlay.querySelector("[data-copy-order]")?.addEventListener("click", async (event) => {
    try { await navigator.clipboard.writeText(orderId); }
    catch { const input=document.createElement("textarea"); input.value=orderId; document.body.appendChild(input); input.select(); document.execCommand("copy"); input.remove(); }
    event.currentTarget.innerHTML = '<i class="fa-solid fa-check"></i>';
    toast("Order ID copied");
  });
  overlay.querySelector("[data-share-order]")?.addEventListener("click", async () => {
    const shareData = { title: `KB LABEL Order ${orderId}`, text: `Track my KB LABEL order ${orderId}`, url: trackingUrl };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(trackingUrl); toast("Tracking link copied"); }
    } catch (error) { if (error?.name !== "AbortError") toast("Could not share the link"); }
  });
}

function getSavedTrackingOrders() {
  return store.get("kb_orders")
    .filter((order) => order?.id)
    .slice(0, 8);
}

function renderSavedTrackingOrders(onSelect) {
  const holder = document.querySelector("#savedOrdersPanel");
  if (!holder) return;
  const orders = getSavedTrackingOrders();
  if (!orders.length) {
    holder.innerHTML = `<div class="saved-orders-empty"><i class="fa-solid fa-shield-heart"></i><div><strong>No saved orders on this device yet</strong><span>After checkout, your order will appear here automatically.</span></div></div>`;
    return;
  }
  holder.innerHTML = `<div class="saved-orders-head"><div><span class="eyebrow dark">NO NUMBER NEEDED</span><h2>My Saved Orders</h2></div><small>Stored only on this browser</small></div><div class="saved-orders-grid">${orders.map((order, index) => `
    <button type="button" class="saved-order-card" data-saved-order="${order.id}" style="--saved-delay:${index * 70}ms">
      <span class="saved-order-icon"><i class="fa-solid fa-box"></i></span>
      <span class="saved-order-copy"><small>ORDER ID</small><strong>${order.id}</strong><em>${new Date(order.date || Date.now()).toLocaleDateString("en-LK", {year:"numeric",month:"short",day:"numeric"})}</em></span>
      <span class="saved-order-status">${normalizeOrderStatus(order.status || "Pending")}<i class="fa-solid fa-arrow-right"></i></span>
    </button>`).join("")}</div>`;
  holder.querySelectorAll("[data-saved-order]").forEach((button) => button.addEventListener("click", () => {
    const order = orders.find((item) => String(item.id) === button.dataset.savedOrder);
    onSelect?.(order);
  }));
}

function normalizeOrderStatus(status = "Pending") {
  const value = String(status).toLowerCase().trim();
  if (["confirmed", "confirm"].includes(value)) return "Confirmed";
  if (["shipped", "shipping", "delivery", "out for delivery"].includes(value)) return "Out for Delivery";
  if (["delivered", "received", "completed", "order delivered"].includes(value)) return "Delivered";
  if (["cancelled", "canceled"].includes(value)) return "Cancelled";
  return "Pending";
}

function orderProgress(status) {
  const normalized = normalizeOrderStatus(status);
  return { Pending: 8, Confirmed: 34, "Out for Delivery": 72, Delivered: 100, Cancelled: 0 }[normalized] ?? 8;
}

function renderOrderTracker(order) {
  const status = normalizeOrderStatus(order.status);
  const progress = orderProgress(status);
  const isMoving = status === "Out for Delivery";
  const isDelivered = status === "Delivered";
  const isCancelled = status === "Cancelled";
  const payment = order.payment === "cod" ? "Cash on Delivery" : order.payment === "card" ? "Card Payment" : "Bank Transfer";
  const steps = [
    ["Pending", "Order Placed", "We received your order."],
    ["Confirmed", "Order Confirmed", "KB LABEL approved your order."],
    ["Out for Delivery", "Out for Delivery", "Your order is travelling to you."],
    ["Delivered", "Order Delivered", "The customer has received the order."]
  ];
  const rank = { Pending: 0, Confirmed: 1, "Out for Delivery": 2, Delivered: 3 }[status] ?? 0;
  return `<section class="delivery-tracker ${isCancelled ? "is-cancelled" : ""}">
    <div class="tracker-head">
      <div><span class="eyebrow dark">LIVE DELIVERY JOURNEY</span><h2>${order.id}</h2></div>
      <span class="live-status status-${status.toLowerCase().replace(/\s+/g, "-")}">${isCancelled ? "Order Cancelled" : status}</span>
    </div>
    ${isCancelled ? `<div class="cancelled-banner"><i class="fa-solid fa-circle-xmark"></i><div><strong>This order was cancelled</strong><span>Please contact KB LABEL for assistance.</span></div></div>` : `
    <div class="delivery-map" style="--delivery-progress:${progress}%">
      <div class="road-glow"></div><div class="road-base"></div><div class="road-progress"></div>
      <div class="delivery-bike ${isMoving ? "is-moving" : ""} ${isDelivered ? "is-delivered" : ""}" aria-hidden="true">
        <span class="speed-line speed-one"></span><span class="speed-line speed-two"></span>
        <i class="fa-solid fa-motorcycle"></i><span class="delivery-box">KB</span>
      </div>
      <div class="start-pin"><i class="fa-solid fa-store"></i><span>KB LABEL</span></div>
      <div class="home-pin ${isDelivered ? "reached" : ""}"><i class="fa-solid fa-house"></i><span>YOUR DOOR</span></div>
    </div>
    <div class="tracking-steps">${steps.map((step, index) => `<div class="tracking-step ${index < rank ? "done" : index === rank ? "active" : ""}"><span class="step-icon"><i class="fa-solid ${index < rank || (isDelivered && index === rank) ? "fa-check" : ["fa-receipt","fa-box-open","fa-motorcycle","fa-house-circle-check"][index]}"></i></span><div><strong>${step[1]}</strong><small>${step[2]}</small></div></div>`).join("")}</div>`}
    <div class="tracker-order-info"><div><small>Customer</small><strong>${order.name}</strong></div><div><small>Total</small><strong>${money(order.total)}</strong></div><div><small>Payment</small><strong>${payment}</strong></div></div>
  </section>`;
}

function setupTracking() {
  const form = $("#trackForm");
  if (!form) return;

  const idInput = $("#trackId");
  const phoneInput = $("#trackPhone");
  const result = $("#trackResult");
  let stopLiveTracking = null;

  const queryId = new URLSearchParams(location.search).get("id");
  if (queryId) idInput.value = queryId;

  renderSavedTrackingOrders((savedOrder) => {
    idInput.value = savedOrder.id || "";
    phoneInput.value = savedOrder.phone || "";
    history.replaceState(null, "", `my-orders.html?id=${encodeURIComponent(savedOrder.id)}`);
    startLiveTracking();
    setTimeout(() => result.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  });

  const renderLoading = (orderId) => {
    result.innerHTML = `<div class="tracking-loading"><span class="tracking-radar"><i></i><i></i><i></i></span><div><strong>Connecting to live tracking</strong><small>Checking ${orderId} securely...</small></div></div>`;
  };

  const startLiveTracking = async () => {
    const orderId = idInput.value.trim().toUpperCase();
    const phoneDigits = phoneInput.value.replace(/\D/g, "");
    if (!orderId) {
      result.innerHTML = `<div class="track-empty"><i class="fa-solid fa-circle-exclamation"></i><h3>Enter your order ID</h3><p>Use the KB order ID shown after checkout.</p></div>`;
      return;
    }

    if (stopLiveTracking) {
      stopLiveTracking();
      stopLiveTracking = null;
    }
    renderLoading(orderId);

    const connect = () => {
      if (!window.kbFirebaseOrders?.subscribePublic) return false;
      stopLiveTracking = window.kbFirebaseOrders.subscribePublic(
        orderId,
        (liveOrder) => {
          if (!liveOrder) {
            // Backward-compatible local fallback for orders created before live tracking was added.
            const localOrder = store.get("kb_orders").find((item) => String(item.id).toUpperCase() === orderId);
            result.innerHTML = localOrder
              ? renderOrderTracker(localOrder)
              : `<div class="track-empty"><i class="fa-solid fa-box-open"></i><h3>Order not found</h3><p>Check the order ID and try again. Older orders appear after the admin updates their status once.</p></div>`;
            return;
          }

          if (phoneDigits && liveOrder.phoneLast4 && !phoneDigits.endsWith(String(liveOrder.phoneLast4))) {
            result.innerHTML = `<div class="track-empty"><i class="fa-solid fa-shield-halved"></i><h3>Phone number does not match</h3><p>Enter the phone number used during checkout.</p></div>`;
            return;
          }

          const trackingOrder = {
            id: liveOrder.orderId || liveOrder.id || orderId,
            name: liveOrder.customerName || "Customer",
            total: Number(liveOrder.total || 0),
            payment: liveOrder.paymentMethod || "cod",
            paymentMethod: liveOrder.paymentMethod || "cod",
            status: liveOrder.status || "Pending",
            statusUpdatedAt: liveOrder.statusUpdatedAt
          };
          result.innerHTML = renderOrderTracker(trackingOrder);
          result.querySelector(".delivery-tracker")?.classList.add("tracker-live-enter");
        },
        (error) => {
          console.error(error);
          result.innerHTML = `<div class="track-empty"><i class="fa-solid fa-triangle-exclamation"></i><h3>Live tracking unavailable</h3><p>${error?.message || "Please publish the included Firestore rules and try again."}</p></div>`;
        }
      );
      return true;
    };

    if (!connect()) {
      const readyHandler = () => {
        window.removeEventListener("kb-firebase-orders-ready", readyHandler);
        connect();
      };
      window.addEventListener("kb-firebase-orders-ready", readyHandler, { once: true });
      setTimeout(() => {
        if (!stopLiveTracking) connect();
      }, 1800);
    }
  };

  form.onsubmit = (event) => {
    event.preventDefault();
    startLiveTracking();
  };

  window.addEventListener("beforeunload", () => stopLiveTracking?.());
  if (queryId) setTimeout(startLiveTracking, 550);
}
function setupGlobal() {
  updateCounts();
  $(".menu-toggle")?.addEventListener("click", () =>
    $(".nav").classList.toggle("open"),
  );
  $("[data-open-search]")?.addEventListener("click", () =>
    $("#searchPanel").classList.add("show"),
  );
  $(".close-search")?.addEventListener("click", () =>
    $("#searchPanel").classList.remove("show"),
  );
  $("#globalSearch")?.addEventListener("input", (e) => {
    $("#searchResults").innerHTML = getProducts()
      .filter((p) =>
        p.name.toLowerCase().includes(e.target.value.toLowerCase()),
      )
      .slice(0, 6)
      .map(
        (p) =>
          `<a class="search-result" href="product.html?id=${p.id}">${productImageMarkup(p, p.name)}<div><h4>${p.name}</h4><p>${productPriceMarkup(p, "search-price")}</p></div></a>`,
      )
      .join("");
  });
  $("#newsletterForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    toast("Welcome to the KB Label inner circle");
    e.target.reset();
  });
  $("#contactForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    toast("Message ready. Connect a form service to receive it.");
    e.target.reset();
  });
}

function fileToOptimizedDataUrl(file, maxSize = 1400, quality = 0.86) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Please select a PNG, JPG or WEBP image."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Image could not be read."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image file."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function setProductPreview(src = "") {
  const preview = $("#productImagePreview");
  const placeholder = $("#uploadPlaceholder");
  if (!preview || !placeholder) return;
  if (src) {
    preview.src = src;
    preview.classList.add("show");
    placeholder.hidden = true;
  } else {
    preview.removeAttribute("src");
    preview.classList.remove("show");
    placeholder.hidden = false;
  }
}

function setCheckedOptions(form, name, values = []) {
  const selected = new Set(values);
  $$(`input[name="${name}"]`, form).forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function updateDiscountEditorState(form = $("#productForm")) {
  if (!form) return;
  const enabled = Boolean(form.elements.discountEnabled?.checked);
  const panel = $("#discountFields", form);
  const input = form.elements.discountPrice;
  panel?.classList.toggle("is-open", enabled);
  if (input) {
    input.disabled = !enabled;
    input.required = enabled;
  }
}

function openProductEditor(product = null) {
  const modal = $("#productModal");
  const form = $("#productForm");
  if (!modal || !form) return;
  form.reset();
  form.elements.id.value = product?.id || "";
  form.elements.existingImage.value = product ? resolveProductImage(product) : "";
  form.elements.name.value = product?.name || "";
  form.elements.price.value = product?.price || "";
  form.elements.category.value = product?.category || "t-shirts";
  form.elements.badge.value = product?.badge || "New";
  form.elements.stockStatus.value = product?.stockStatus || "in-stock";
  if(form.elements.stockQty) form.elements.stockQty.value = Number(product?.stockQty ?? product?.quantity ?? 0);
  form.elements.discountEnabled.checked = Boolean(product?.discountEnabled);
  form.elements.discountPrice.value = product?.discountPrice || "";
  updateDiscountEditorState(form);
  form.elements.description.value = product?.description || "";
  setCheckedOptions(form, "sizeOption", product?.sizes || ["S", "M", "L", "XL", "XXL"]);
  setCheckedOptions(form, "colorOption", product?.colors || ["Black", "White"]);
  setProductPreview(product ? resolveProductImage(product) : "");
  $("#productModalTitle").textContent = product ? "Edit Product" : "Add New Product";
  modal.classList.add("show");
}

function closeProductEditor() {
  $("#productModal")?.classList.remove("show");
}

function renderAdmin() {
  if (!(".admin-shell" && $(".admin-shell"))) return;
  let ps = getProducts(),
    orders = store.get("kb_orders");
  $("#adminStats").innerHTML = [
    ["Total Products", ps.length],
    ["Orders", orders.length],
    ["Pending", orders.filter((o) => normalizeOrderStatus(o.status) === "Pending").length],
    ["Revenue", money(orders.reduce((a, o) => a + o.total, 0))],
  ]
    .map((x) => `<div class="stat"><small>${x[0]}</small><strong>${x[1]}</strong></div>`)
    .join("");

  const recent = orders.slice(0, 5);
  const recentRows = recent.map((o) =>
    `<tr>
      <td class="select-cell"><input class="order-select recent-order-select" type="checkbox" value="${o.id}" aria-label="Select order ${o.id}"></td>
      <td>${o.id}</td><td>${o.name}</td><td>${money(o.total)}</td><td>${normalizeOrderStatus(o.status)}</td>
    </tr>`).join("");
  $("#recentOrders").innerHTML = `
    <div class="order-bulk-toolbar compact">
      <label class="bulk-select-all"><input type="checkbox" id="selectAllRecentOrders"> Select visible</label>
      <div class="bulk-actions">
        <button class="btn bulk-delete" id="deleteSelectedRecentOrders" type="button" disabled><i class="fa-solid fa-trash-can"></i> Delete Selected</button>
        <button class="btn admin-danger" id="clearDashboardOrders" type="button" ${orders.length ? "" : "disabled"}><i class="fa-solid fa-broom"></i> Clear All Orders</button>
      </div>
    </div>
    <div class="admin-table-wrap"><table class="admin-table"><tr><th></th><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr>${recentRows || '<tr><td colspan="5">No orders yet</td></tr>'}</table></div>`;

  $("#adminProducts").innerHTML =
    `<div class="admin-table-wrap"><table class="admin-table product-admin-table"><tr><th>Image</th><th>Name</th><th>Price</th><th>Type</th><th>Stock</th><th>Actions</th></tr>${ps.map((p) => {
      const isOut = p.stockStatus === "out-of-stock";
      return `<tr data-product-row="${String(p.id)}"><td>${productImageMarkup(p, p.name, "admin-product-thumb")}</td><td><strong>${p.name}</strong>${hasProductDiscount(p) ? '<small class="admin-discount-note">Discount active</small>' : ''}</td><td>${productPriceMarkup(p, "admin-product-price")}</td><td>${String(p.category || "t-shirts").toLowerCase() === "hoodies" ? "Hoodie" : "T-Shirt"}</td><td><button class="stock-quick-toggle ${isOut ? "is-out" : "is-in"}" data-product-id="${String(p.id)}" onclick="toggleProductStock(this.dataset.productId,this)"><span class="stock-toggle-dot"></span><span>${isOut ? "Out of Stock" : "In Stock"}</span><small>Click to change</small></button></td><td class="table-actions"><button data-product-id="${String(p.id)}" onclick="editProduct(this.dataset.productId)">Edit</button><button data-product-id="${String(p.id)}" onclick="deleteProduct(this.dataset.productId)">Delete</button></td></tr>`;
    }).join("")}</table></div>`;

  $("#adminOrders").innerHTML = orders.length
    ? `<div class="order-bulk-toolbar">
        <label class="bulk-select-all"><input type="checkbox" id="selectAllAdminOrders"> Select all orders</label>
        <div class="bulk-summary"><strong id="selectedOrderCount">0</strong> selected</div>
        <div class="bulk-actions">
          <button class="btn bulk-delete" id="deleteSelectedAdminOrders" type="button" disabled><i class="fa-solid fa-trash-can"></i> Delete Selected</button>
          <button class="btn admin-danger" id="clearAllOrders" type="button"><i class="fa-solid fa-broom"></i> Clear All Orders</button>
        </div>
      </div>
      <div class="admin-order-list">${orders.map((o) => {
        const status = normalizeOrderStatus(o.status);
        const actions = status === "Pending"
          ? `<button class="order-action confirm" onclick="updateOrder('${o.id}','Confirmed')"><i class="fa-solid fa-circle-check"></i><span>Confirm Order</span></button>`
          : status === "Confirmed"
            ? `<button class="order-action delivery" onclick="updateOrder('${o.id}','Out for Delivery')"><i class="fa-solid fa-motorcycle"></i><span>Send for Delivery</span></button>`
            : status === "Out for Delivery"
              ? `<button class="order-action delivered" onclick="updateOrder('${o.id}','Delivered')"><i class="fa-solid fa-house-circle-check"></i><span>Mark Order Delivered</span></button>`
              : status === "Delivered"
                ? `<span class="order-complete"><i class="fa-solid fa-circle-check"></i> Customer Received</span>`
                : `<span class="order-cancelled"><i class="fa-solid fa-circle-xmark"></i> Cancelled</span>`;
        return `<article class="admin-order-card status-${status.toLowerCase().replace(/\s+/g,"-")}">
          <label class="order-card-selector"><input class="order-select admin-order-select" type="checkbox" value="${o.id}" aria-label="Select order ${o.id}"><span><i class="fa-solid fa-check"></i></span></label>
          <div class="admin-order-top"><div><small>ORDER ID</small><h3>${o.id}</h3></div><span class="admin-order-status">${status}</span></div>
          <div class="admin-order-meta"><div><small>Customer</small><strong>${o.name}</strong></div><div><small>Phone</small><strong>${o.phone}</strong></div><div><small>Total</small><strong>${money(o.total)}</strong></div></div>
          <div class="admin-mini-route" style="--admin-progress:${orderProgress(status)}%"><span class="mini-line"></span><span class="mini-fill"></span><i class="fa-solid fa-motorcycle"></i></div>
          <div class="admin-order-actions">${actions}${!["Delivered","Cancelled"].includes(status) ? `<button class="order-action cancel" onclick="updateOrder('${o.id}','Cancelled')"><i class="fa-solid fa-ban"></i><span>Cancel</span></button>` : ""}<button class="order-action delete-single" onclick="deleteSingleOrder('${o.id}')"><i class="fa-solid fa-trash-can"></i><span>Delete</span></button></div>
        </article>`;
      }).join("")}</div>`
    : '<div class="admin-empty-orders"><i class="fa-solid fa-box-open"></i><h3>No orders yet</h3><p>New customer orders will appear here.</p></div>';

  setupOrderBulkControls();
}

function selectedOrderIds(selector) {
  return $$(selector).filter((box) => box.checked).map((box) => box.value);
}

async function removeOrders(orderIds, message) {
  const uniqueIds = [...new Set(orderIds.map(String))];
  if (!uniqueIds.length) return;
  try {
    if (!window.kbFirebaseOrders?.deleteMany) throw new Error("Firebase order service is not ready.");
    await window.kbFirebaseOrders.deleteMany(uniqueIds);
    store.set("kb_orders", store.get("kb_orders").filter((order) => !uniqueIds.includes(String(order.id))));
    renderAdmin();
    toast(message || `${uniqueIds.length} order${uniqueIds.length === 1 ? "" : "s"} deleted`);
  } catch (error) {
    console.error(error);
    alert(error.message || "Orders could not be deleted.");
  }
}

window.deleteSingleOrder = async (id) => {
  if (!confirm(`Permanently delete order ${id}? This cannot be undone.`)) return;
  await removeOrders([id], "Order permanently deleted");
};

function setupOrderBulkControls() {
  const recentBoxes = $$(".recent-order-select");
  const allRecent = $("#selectAllRecentOrders");
  const recentDelete = $("#deleteSelectedRecentOrders");
  const updateRecent = () => {
    const count = selectedOrderIds(".recent-order-select").length;
    if (recentDelete) recentDelete.disabled = count === 0;
    if (allRecent) allRecent.checked = recentBoxes.length > 0 && count === recentBoxes.length;
  };
  recentBoxes.forEach((box) => box.addEventListener("change", updateRecent));
  if (allRecent) allRecent.addEventListener("change", () => { recentBoxes.forEach((box) => box.checked = allRecent.checked); updateRecent(); });
  if (recentDelete) recentDelete.onclick = async () => {
    const ids = selectedOrderIds(".recent-order-select");
    if (!ids.length || !confirm(`Delete ${ids.length} selected order${ids.length === 1 ? "" : "s"}?`)) return;
    await removeOrders(ids);
  };

  const adminBoxes = $$(".admin-order-select");
  const allAdmin = $("#selectAllAdminOrders");
  const adminDelete = $("#deleteSelectedAdminOrders");
  const selectedCount = $("#selectedOrderCount");
  const updateAdmin = () => {
    const count = selectedOrderIds(".admin-order-select").length;
    if (adminDelete) adminDelete.disabled = count === 0;
    if (selectedCount) selectedCount.textContent = count;
    if (allAdmin) allAdmin.checked = adminBoxes.length > 0 && count === adminBoxes.length;
  };
  adminBoxes.forEach((box) => box.addEventListener("change", updateAdmin));
  if (allAdmin) allAdmin.addEventListener("change", () => { adminBoxes.forEach((box) => box.checked = allAdmin.checked); updateAdmin(); });
  if (adminDelete) adminDelete.onclick = async () => {
    const ids = selectedOrderIds(".admin-order-select");
    if (!ids.length || !confirm(`Permanently delete ${ids.length} selected order${ids.length === 1 ? "" : "s"}?`)) return;
    await removeOrders(ids);
  };

  const clearAll = async () => {
    const orders = store.get("kb_orders");
    if (!orders.length) return toast("The order list is already empty");
    if (!confirm(`Permanently delete all ${orders.length} orders from Dashboard and Order Management? This cannot be undone.`)) return;
    try {
      if (!window.kbFirebaseOrders?.clearAll) throw new Error("Firebase order service is not ready.");
      await window.kbFirebaseOrders.clearAll();
      store.set("kb_orders", []);
      renderAdmin();
      toast("Dashboard and order history cleared");
    } catch (error) {
      console.error(error);
      alert(error.message || "Order history could not be cleared.");
    }
  };
  const clearDashboard = $("#clearDashboardOrders");
  const clearOrders = $("#clearAllOrders");
  if (clearDashboard) clearDashboard.onclick = clearAll;
  if (clearOrders) clearOrders.onclick = clearAll;
}

window.toggleProductStock = async (id, button) => {
  const product = findProductById(id);
  if (!product || button?.disabled) return;
  const oldStatus = product.stockStatus || "in-stock";
  const nextStatus = oldStatus === "out-of-stock" ? "in-stock" : "out-of-stock";
  try {
    if (!window.kbFirebaseProducts?.updateStock) throw new Error("Firebase stock service is not ready.");
    if (button) {
      button.disabled = true;
      button.classList.add("is-saving");
      button.querySelector("small").textContent = "Updating...";
    }
    await window.kbFirebaseProducts.updateStock(id, nextStatus);
    product.stockStatus = nextStatus;
    saveProducts([...getProducts()]);
    renderAdmin();
    refreshProductViews();
    toast(nextStatus === "in-stock" ? "Product is now In Stock" : "Product marked Out of Stock");
  } catch (error) {
    console.error(error);
    alert(error.message || "Stock status could not be updated.");
    renderAdmin();
  }
};

window.editProduct = (id) => {
  const product = findProductById(id);
  if (product) openProductEditor(product);
};
window.deleteProduct = async (id) => {
  const product = findProductById(id);
  if (!product || !confirm("Delete this product from the online shop?")) return;
  try {
    if (!window.kbFirebaseProducts) throw new Error("Firebase product service is not ready.");
    await window.kbFirebaseProducts.delete(product);
    saveProducts(getProducts().filter((x) => String(x.id) !== String(id)));
    renderAdmin();
    refreshProductViews();
    toast("Product deleted from online shop");
  } catch (error) {
    console.error(error);
    alert(error.message || "Product could not be deleted.");
  }
};
window.updateOrder = async (id, status) => {
  const normalized = normalizeOrderStatus(status);
  let orders = store.get("kb_orders");
  const order = orders.find((x) => x.id === id);
  if (!order) return;
  const previous = order.status;
  order.status = normalized;
  order.statusUpdatedAt = new Date().toISOString();
  store.set("kb_orders", orders);
  renderAdmin();
  try {
    if (window.kbFirebaseOrders?.updateStatus) await window.kbFirebaseOrders.updateStatus(id, normalized);
    toast(normalized === "Delivered" ? "Order marked as delivered" : `Order status: ${normalized}`);
  } catch (error) {
    console.error(error);
    order.status = previous;
    store.set("kb_orders", orders);
    renderAdmin();
    alert(error.message || "Order status could not be updated.");
  }
};
function setupAdmin() {
  if (!(".admin-shell" && $(".admin-shell"))) return;

  $$('[data-admin-tab]').forEach((b) => {
    b.onclick = () => {
      $$('[data-admin-tab]').forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      $$(".admin-tab").forEach((x) => x.classList.remove("active"));
      $("#admin-" + b.dataset.adminTab).classList.add("active");
    };
  });

  $("#addProductBtn").onclick = () => openProductEditor();
  $(".modal-close").onclick = closeProductEditor;
  $("#cancelProduct").onclick = closeProductEditor;
  $("#productModal").addEventListener("click", (e) => {
    if (e.target.id === "productModal") closeProductEditor();
  });

  const imageInput = $("#productImageFile");
  $("#chooseProductImage").onclick = () => imageInput.click();
  $(".upload-drop").addEventListener("click", () => imageInput.click());
  imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please choose a PNG, JPG or WEBP image.");
      imageInput.value = "";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert("Please choose an image smaller than 8 MB.");
      imageInput.value = "";
      return;
    }
    setProductPreview(URL.createObjectURL(file));
    toast("Image ready to upload");
  });

  const discountToggle = $("#productForm")?.elements.discountEnabled;
  if (discountToggle) discountToggle.addEventListener("change", () => updateDiscountEditorState());

  let activeProductSaveButton = null;
  window.addEventListener("kb-product-upload-progress", (event) => {
    if (!activeProductSaveButton) return;
    const percent = Math.max(0, Math.min(100, Number(event.detail?.percent || 0)));
    activeProductSaveButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading ${percent}%`;
  });

  window.addEventListener("kb-product-save-stage", (event) => {
    if (!activeProductSaveButton) return;
    const stage = String(event.detail?.stage || "");
    const percent = Math.max(0, Math.min(100, Number(event.detail?.percent || 0)));
    const labels = {
      uploading: `Uploading ${percent}%`,
      finalizing: "Finalizing Upload...",
      "getting-url": "Preparing Image...",
      "saving-product": "Saving Product...",
      complete: "Saved Successfully"
    };
    activeProductSaveButton.innerHTML = `<i class="fa-solid ${stage === "complete" ? "fa-check" : "fa-spinner fa-spin"}"></i> ${labels[stage] || "Saving Online..."}`;
  });

  $("#productForm").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const button = form.querySelector('button[type="submit"]');
    const f = new FormData(form);
    const sizes = $$('input[name="sizeOption"]:checked', form).map((x) => x.value);
    const colors = $$('input[name="colorOption"]:checked', form).map((x) => x.value);
    const currentId = String(f.get("id") || "");
    const current = findProductById(currentId);
    const imageFile = $("#productImageFile").files?.[0] || null;

    if (!sizes.length) return alert("Select at least one size.");
    if (!colors.length) return alert("Select at least one color.");
    if (!imageFile && !current?.image) return alert("Please choose a product image.");
    const regularPrice = Number(f.get("price"));
    const discountEnabled = f.get("discountEnabled") === "on";
    const discountPrice = Number(f.get("discountPrice") || 0);
    if (discountEnabled && (!discountPrice || discountPrice >= regularPrice)) {
      return alert("Discount price must be lower than the regular price.");
    }

    const product = {
      id: currentId || "",
      name: String(f.get("name") || "").trim(),
      price: Number(f.get("price")),
      category: f.get("category"),
      image: current?.image || String(f.get("existingImage") || ""),
      imagePath: current?.imagePath || "",
      badge: f.get("badge"),
      stockStatus: Number(f.get("stockQty") || 0) <= 0 ? "out-of-stock" : f.get("stockStatus"),
      stockQty: Math.max(0, Number(f.get("stockQty") || 0)),
      quantity: Math.max(0, Number(f.get("stockQty") || 0)),
      discountEnabled: f.get("discountEnabled") === "on",
      discountPrice: f.get("discountEnabled") === "on" ? Number(f.get("discountPrice")) : 0,
      sizes,
      colors,
      description: String(f.get("description") || "").trim(),
      active: true
    };

    try {
      if (!window.kbFirebaseProducts) throw new Error("Firebase product service is not ready. Refresh and try again.");
      if (button) { activeProductSaveButton = button; button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing Save...'; }
      const saveWatchdog = new Promise((_, reject) => setTimeout(() => reject(new Error(
        "Product save took too long. The editor was reset safely. Check Firestore Rules, then try again."
      )), 165000));
      const saved = await Promise.race([
        window.kbFirebaseProducts.save(product, imageFile),
        saveWatchdog
      ]);
      const ps = getProducts();
      const index = ps.findIndex((x) => String(x.id) === String(saved.id));
      index > -1 ? (ps[index] = saved) : ps.unshift(saved);
      saveProducts(ps);
      closeProductEditor();
      form.reset();
      renderAdmin();
      refreshProductViews();
      toast(currentId ? "Product updated online" : "Product added to online shop");
    } catch (error) {
      console.error("Product save failed:", error);
      alert(error.message || "Product could not be saved to Firebase.");
    } finally {
      activeProductSaveButton = null;
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Product';
      }
    }
  };

  $("#exportProducts").onclick = () => {
    const blob = new Blob([JSON.stringify(getProducts(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kb-label-products-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Product backup downloaded");
  };

  $("#importProducts").onclick = () => $("#importProductsFile").click();
  $("#importProductsFile").onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data)) throw new Error();
      if (!confirm(`Restore ${data.length} products from this backup?`)) return;
      if (!window.kbFirebaseProducts) throw new Error("Firebase product service is not ready.");
      for (const item of data) await window.kbFirebaseProducts.save({ ...item, id: "" }, null);
      await syncFirebaseProducts();
      renderAdmin();
      toast("Products restored to Firebase");
    } catch {
      alert("This is not a valid KB Label product backup file.");
    } finally {
      e.target.value = "";
    }
  };

  const clearProductsButton = $("#clearAllProducts");
  if (clearProductsButton) clearProductsButton.onclick = async () => {
    const total = getProducts().length;
    if (!total) return toast("The online shop is already empty");
    if (!confirm(`Delete all ${total} online products? This cannot be undone.`)) return;
    try {
      clearProductsButton.disabled = true;
      clearProductsButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Clearing...';
      if (!window.kbFirebaseProducts?.clearAll) throw new Error("Firebase product service is not ready.");
      await window.kbFirebaseProducts.clearAll();
      saveProducts([]);
      store.set("kb_cart", []);
      store.set("kb_wishlist", []);
      renderAdmin();
      refreshProductViews();
      updateCounts();
      toast("All online products were removed");
    } catch (error) {
      console.error(error);
      alert(error.message || "Products could not be cleared.");
    } finally {
      clearProductsButton.disabled = false;
      clearProductsButton.innerHTML = '<i class="fa-solid fa-trash"></i> Clear All Products';
    }
  };
  renderAdmin();
}
document.addEventListener("DOMContentLoaded", () => {
  setupGlobal();
  renderFeatured();
  renderShop();
  renderProduct();
  renderCart();
  renderWishlist();
  renderCheckout();
  setupCheckout();
  setupTracking();
  setupAdmin();
  startAdminOrderSyncAfterLogin();
  if (window.kbFirebaseProducts) syncFirebaseProducts();
  else window.addEventListener("kb-firebase-ready", () => syncFirebaseProducts(), { once: true });
  $("#shopSearch")?.addEventListener("input", renderShop);
  $("#categoryFilter")?.addEventListener("change", renderShop);
  $("#sortFilter")?.addEventListener("change", renderShop);
  $("#clearFilters")?.addEventListener("click", () => {
    $("#shopSearch").value = "";
    $("#categoryFilter").value = "all";
    $("#sortFilter").value = "featured";
    renderShop();
  });
  $(".filter-toggle")?.addEventListener("click", () =>
    $(".filters").classList.toggle("open"),
  );
});


// Highlight the current page in the shared storefront header.
document.addEventListener("DOMContentLoaded", () => {
  const currentFile = (location.pathname.split("/").pop() || "store.html").toLowerCase();
  document.querySelectorAll(".site-header .nav a").forEach((link) => {
    const targetFile = (new URL(link.href, location.href).pathname.split("/").pop() || "store.html").toLowerCase();
    if (targetFile === currentFile) link.setAttribute("aria-current", "page");
  });
});
