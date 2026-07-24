import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { firebaseConfig } from "./firebase-config.js";
import { kbEmailjsConfig } from "./kb-emailjs-config.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getStorage,
  ref,
  uploadBytesResumable,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";



const app = getApps().find((item) => item.name === "[DEFAULT]") || initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function emitProductSaveStage(stage, percent = null) {
  window.dispatchEvent(new CustomEvent("kb-product-save-stage", {
    detail: { stage, percent }
  }));
}

function uploadFileWithProgress(storageRef, file, metadata = {}) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, metadata);
    let settled = false;

    const finish = (snapshot) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      emitProductSaveStage("finalizing", 100);
      resolve(snapshot || task.snapshot);
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };

    const timer = setTimeout(() => {
      try { task.cancel(); } catch (_) {}
      fail(new Error("Image upload timed out. Check your internet connection and try again."));
    }, 120000);

    task.on(
      "state_changed",
      (snapshot) => {
        const percent = snapshot.totalBytes
          ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          : 0;
        emitProductSaveStage("uploading", percent);
      },
      fail,
      () => finish(task.snapshot)
    );
  });
}

async function getDownloadURLWithRetry(storageRef, attempts = 8) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await getDownloadURL(storageRef);
    } catch (error) {
      lastError = error;
      const retryable = error?.code === "storage/object-not-found" || error?.code === "storage/retry-limit-exceeded" || error?.code === "storage/unknown";
      if (!retryable || attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 450 * attempt));
    }
  }
  throw lastError || new Error("Could not prepare the uploaded image.");
}

async function requireAdminUser() {
  const existing = auth.currentUser;
  if (existing) {
    if ((existing.email || "").toLowerCase() !== "editzlk.www@gmail.com") {
      throw new Error("This account is not authorized to manage KB Label products.");
    }
    await existing.getIdToken(true);
    return existing;
  }
  const user = await new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; unsubscribe(); reject(new Error("Admin login session was not found. Please sign in again.")); }
    }, 6000);
    const unsubscribe = onAuthStateChanged(auth, (value) => {
      if (settled) return;
      if (!value) return;
      settled = true; clearTimeout(timeout); unsubscribe(); resolve(value);
    }, (error) => {
      if (settled) return;
      settled = true; clearTimeout(timeout); unsubscribe(); reject(error);
    });
  });
  if ((user.email || "").toLowerCase() !== "editzlk.www@gmail.com") {
    throw new Error("This account is not authorized to manage KB Label products.");
  }
  await user.getIdToken(true);
  return user;
}

async function loginAdmin(email, password) {
  await setPersistence(auth, browserLocalPersistence);
  return signInWithEmailAndPassword(auth, String(email).trim(), password);
}

async function logoutAdmin() {
  return signOut(auth);
}

window.kbFirebaseAuth = {
  auth,
  login: loginAdmin,
  logout: logoutAdmin,
  onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback)
};
window.dispatchEvent(new Event("kb-auth-ready"));

function safeFileName(name = "file") {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeProductDoc(item) {
  const data = item.data() || {};
  const imageCandidate = data.image || data.imageUrl || data.imageURL || data.thumbnail || data.thumbnailUrl || data.coverImage || data.photoUrl || (Array.isArray(data.images) ? data.images[0] : "");
  const normalizedImage = typeof imageCandidate === "string"
    ? imageCandidate
    : imageCandidate?.url || imageCandidate?.downloadURL || imageCandidate?.src || "";
  return {
    ...data,
    image: normalizedImage || data.image || "",
    stockStatus: String(data.stockStatus || data.stock || "in-stock").toLowerCase().replace(/\s+/g, "-") === "out-of-stock" ? "out-of-stock" : "in-stock",
    stockQty: Math.max(0, Number(data.stockQty ?? data.quantity ?? 0)),
    quantity: Math.max(0, Number(data.stockQty ?? data.quantity ?? 0)),
    legacyId: data.legacyId ?? data.id ?? null,
    id: item.id
  };
}

async function loadFirebaseProducts() {
  const snapshot = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
  return snapshot.docs.map(normalizeProductDoc);
}

async function uploadProductImage(file, productId = "new") {
  if (!file) throw new Error("Please choose a product image.");
  if (!file.type?.startsWith("image/")) throw new Error("Only image files are allowed.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Image must be smaller than 8 MB.");
  const path = `product-images/${productId}/${Date.now()}-${safeFileName(file.name)}`;
  const imageRef = ref(storage, path);
  await uploadFileWithProgress(imageRef, file, { contentType: file.type || "image/jpeg" });
  emitProductSaveStage("getting-url", 100);
  const image = await withTimeout(
    getDownloadURLWithRetry(imageRef),
    30000,
    "Image upload finished, but Firebase could not prepare its URL. Try again after checking Storage read permission."
  );
  return { image, imagePath: path };
}

async function saveFirebaseProduct(product, imageFile = null) {
  await requireAdminUser();
  const isEdit = Boolean(product.id);
  const productRef = isEdit ? doc(db, "products", String(product.id)) : doc(collection(db, "products"));
  let imageData = { image: product.image || "", imagePath: product.imagePath || "" };
  let uploadedNewImage = false;
  if (imageFile) { imageData = await uploadProductImage(imageFile, productRef.id); uploadedNewImage = true; }
  if (!imageData.image) throw new Error("Please choose a product image.");
  const payload = {
    name: product.name,
    price: Number(product.price),
    category: product.category,
    badge: product.badge || "",
    stockStatus: Number(product.stockQty ?? product.quantity ?? 0) <= 0 ? "out-of-stock" : (product.stockStatus || "in-stock"),
    stockQty: Math.max(0, Number(product.stockQty ?? product.quantity ?? 0)),
    quantity: Math.max(0, Number(product.stockQty ?? product.quantity ?? 0)),
    discountEnabled: Boolean(product.discountEnabled),
    discountPrice: Number(product.discountPrice || 0),
    sizes: Array.isArray(product.sizes) ? product.sizes : [],
    colors: Array.isArray(product.colors) ? product.colors : [],
    description: product.description || "",
    image: imageData.image,
    imagePath: imageData.imagePath,
    active: product.active !== false,
    updatedAt: serverTimestamp()
  };
  if (!isEdit) payload.createdAt = serverTimestamp();
  try {
    emitProductSaveStage("saving-product", 100);
    await setDoc(productRef, payload, { merge: true });
  } catch (error) {
    if (uploadedNewImage && imageData.imagePath) {
      try { await deleteObject(ref(storage, imageData.imagePath)); } catch (_) {}
    }
    if (error?.code === "permission-denied") {
      const permissionError = new Error("Firestore blocked the product save. Publish firestore.rules in the editz-lk project, then log out and sign in again.");
      permissionError.code = error.code;
      throw permissionError;
    }
    if (error?.code === "unauthenticated") {
      const authError = new Error("Your admin session expired. Log out, sign in again, and retry the product save.");
      authError.code = error.code;
      throw authError;
    }
    throw error;
  }
  emitProductSaveStage("complete", 100);
  return { id: productRef.id, ...payload, ...imageData };
}

async function updateFirebaseProductStock(productId, stockStatus) {
  await requireAdminUser();
  await updateDoc(doc(db, "products", String(productId)), {
    stockStatus,
    updatedAt: serverTimestamp()
  });
  return true;
}

async function deleteFirebaseProduct(product) {
  await requireAdminUser();
  await deleteDoc(doc(db, "products", String(product.id)));
  if (product.imagePath) {
    try { await deleteObject(ref(storage, product.imagePath)); } catch (error) { console.warn("Old image could not be removed:", error); }
  }
}


async function clearAllFirebaseProducts() {
  await requireAdminUser();
  const snapshot = await getDocs(collection(db, "products"));
  for (const item of snapshot.docs) {
    const data = item.data();
    await deleteDoc(doc(db, "products", item.id));
    if (data.imagePath) {
      try { await deleteObject(ref(storage, data.imagePath)); }
      catch (error) { console.warn("Product image could not be removed:", error); }
    }
  }
  return true;
}

async function seedFirebaseProducts(products) {
  const current = await loadFirebaseProducts();
  if (current.length) return current;
  for (const product of products) {
    const id = `product-${product.id}`;
    await setDoc(doc(db, "products", id), {
      ...product,
      legacyId: product.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      active: true
    });
  }
  return loadFirebaseProducts();
}

window.kbFirebaseProducts = {
  load: loadFirebaseProducts,
  subscribe: (callback, onError) => onSnapshot(query(collection(db, "products"), orderBy("createdAt", "desc")), (snapshot) => callback(snapshot.docs.map(normalizeProductDoc)), onError),
  save: saveFirebaseProduct,
  delete: deleteFirebaseProduct,
  updateStock: updateFirebaseProductStock,
  clearAll: clearAllFirebaseProducts,
  seed: seedFirebaseProducts
};
window.dispatchEvent(new Event("kb-firebase-ready"));


function normalizeFirebaseOrder(orderDoc) {
  const data = orderDoc.data() || {};
  const isEditzOrder = data.sourceBrand === "EDITZ_LK" || (!data.sourceBrand && (String(data.orderId || "").startsWith("BANK-") || Boolean(data.itemTitle) || Boolean(data.buyerEmail)));
  if (isEditzOrder) return null;
  const customer = data.customer || {};
  const created = data.createdAt?.toDate?.() || data.createdAt || null;
  return {
    ...data,
    id: String(data.id || orderDoc.id),
    name: data.name || customer.name || "Customer",
    phone: data.phone || customer.phone || "",
    email: data.email || customer.email || "",
    address: data.address || customer.address || "",
    district: data.district || customer.district || "",
    payment: data.payment || data.paymentMethod || "cod",
    paymentMethod: data.paymentMethod || data.payment || "cod",
    items: Array.isArray(data.items) ? data.items : [],
    subtotal: Number(data.subtotal || 0),
    delivery: Number(data.delivery || 0),
    total: Number(data.total || 0),
    status: data.status || "Pending",
    createdAt: created instanceof Date ? created.toISOString() : created
  };
}

async function loadFirebaseOrders() {
  const snapshot = await getDocs(collection(db, "orders"));
  return snapshot.docs
    .map(normalizeFirebaseOrder)
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function subscribeFirebaseOrders(callback, onError) {
  return onSnapshot(
    collection(db, "orders"),
    (snapshot) => {
      const orders = snapshot.docs
        .map(normalizeFirebaseOrder)
        .filter(Boolean)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      callback(orders);
    },
    (error) => {
      console.error("Live order sync failed:", error);
      if (typeof onError === "function") onError(error);
    }
  );
}

function publicTrackingPayload(order = {}, status = "Pending") {
  const customer = order.customer || {};
  const phone = String(order.phone || customer.phone || "").replace(/\D/g, "");
  const name = String(order.name || customer.name || "Customer").trim();
  return {
    orderId: String(order.id || ""),
    status,
    customerName: name.split(/\s+/)[0] || "Customer",
    phoneLast4: phone.slice(-4),
    total: Number(order.total || 0),
    paymentMethod: order.paymentMethod || order.payment || "cod",
    createdAt: order.createdAt || serverTimestamp(),
    statusUpdatedAt: serverTimestamp()
  };
}

async function updateFirebaseOrderStatus(orderId, status) {
  const id = String(orderId);
  const orderRef = doc(db, "orders", id);
  await updateDoc(orderRef, {
    status,
    statusUpdatedAt: serverTimestamp()
  });

  // Keep a privacy-safe public tracking document in sync for customers.
  const snapshot = await getDoc(orderRef);
  const order = snapshot.exists() ? { id, ...snapshot.data() } : { id };
  await setDoc(doc(db, "orderTracking", id), publicTrackingPayload(order, status), { merge: true });
  return true;
}

function subscribePublicOrderTracking(orderId, callback, onError) {
  return onSnapshot(
    doc(db, "orderTracking", String(orderId)),
    (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    (error) => {
      console.error("Public tracking sync failed:", error);
      if (typeof onError === "function") onError(error);
    }
  );
}

async function deleteFirebaseOrder(orderId) {
  const id = String(orderId);
  await deleteDoc(doc(db, "orders", id));
  try { await deleteDoc(doc(db, "orderTracking", id)); } catch (error) { console.warn("Tracking record could not be deleted:", error); }
  return true;
}

async function deleteManyFirebaseOrders(orderIds = []) {
  for (const orderId of orderIds) {
    await deleteFirebaseOrder(orderId);
  }
  return true;
}

async function clearAllFirebaseOrders() {
  const snapshot = await getDocs(collection(db, "orders"));
  for (const item of snapshot.docs) {
    // Never remove EDITZ LK orders from the KB LABEL workspace.
    if (!normalizeFirebaseOrder(item)) continue;
    await deleteDoc(doc(db, "orders", item.id));
    try { await deleteDoc(doc(db, "orderTracking", item.id)); } catch (error) { console.warn("Tracking record could not be deleted:", error); }
  }
  return true;
}

window.kbFirebaseOrders = {
  load: loadFirebaseOrders,
  subscribe: subscribeFirebaseOrders,
  updateStatus: updateFirebaseOrderStatus,
  delete: deleteFirebaseOrder,
  deleteMany: deleteManyFirebaseOrders,
  clearAll: clearAllFirebaseOrders,
  subscribePublic: subscribePublicOrderTracking
};
window.dispatchEvent(new Event("kb-firebase-orders-ready"));

window.submitFirebaseOrder = async function submitFirebaseOrder(
  payload,
  receiptFile
) {
  const orderId = `KB${Date.now().toString().slice(-9)}`;
  let bankSlipUrl = "";

  try {
    // Upload bank slip
    if (payload.paymentMethod === "bank") {
      if (!receiptFile) {
        throw new Error("Please upload your bank receipt.");
      }

      const receiptRef = ref(
        storage,
        `payment_receipts/${orderId}/${Date.now()}-${safeFileName(
          receiptFile.name
        )}`
      );

      console.log("Uploading receipt...");

      await uploadBytes(receiptRef, receiptFile, {
        contentType:
          receiptFile.type || "application/octet-stream"
      });

      bankSlipUrl = await getDownloadURL(receiptRef);

      console.log("Receipt uploaded:", bankSlipUrl);
    }

    // Create order
    const order = {
      ...payload,
      id: orderId,
      bankSlipUrl,
      status: "Pending",
      paymentStatus: payload.paymentStatus || (payload.paymentMethod === "card" ? "Awaiting Payment" : "Pending"),
      paymentTransactionId: payload.paymentTransactionId || "",
      source: "GitHub Pages",
      sourceBrand: "KB_LABEL",
      createdAt: serverTimestamp()
    };

    // Save to Firestore
    console.log("Saving order to Firestore...");

    try {
      await setDoc(doc(db, "orders", orderId), order);
      console.log("Order saved successfully.");
    } catch (firestoreError) {
      console.error("Firestore order save failed:", firestoreError);
      const code = String(firestoreError?.code || "");
      throw new Error(
        code.includes("permission-denied")
          ? "Firebase permission denied while saving the order. Publish the included Firestore rules and try again."
          : firestoreError?.message || "Order could not be saved to Firebase."
      );
    }

    // Tracking is a secondary service. Never report a successfully saved order as failed
    // just because the public tracking collection has not been allowed in Firebase Rules yet.
    let trackingWarning = "";
    try {
      await setDoc(
        doc(db, "orderTracking", orderId),
        publicTrackingPayload(order, "Pending"),
        { merge: true }
      );
    } catch (trackingError) {
      console.warn("Tracking document could not be created:", trackingError);
      trackingWarning = "Live tracking is temporarily unavailable, but your order was saved successfully.";
    }

    // Product text
    const productsText = order.items
      .map(
        item =>
          `${item.name}
Color: ${item.color || "Black"}
Size: ${item.size}
Quantity: ${item.qty}
Price: Rs. ${Number(
            item.lineTotal
          ).toLocaleString()}`
      )
      .join("\n\n");

    // EmailJS is a secondary notification service. The saved order remains valid
    // even if the mail provider is temporarily unavailable.
    let emailWarning = "";
    let emailResponse = null;

    const customerEmail = String(order.customer.email || "").trim();
    const trackingLink = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}my-orders.html?id=${encodeURIComponent(order.id)}`;

    if (!customerEmail) {
      emailWarning = "Order saved, but no customer email address was provided.";
    } else if (!window.emailjs) {
      emailWarning = "Order saved, but the EmailJS library could not load. Check the internet connection or content blocker.";
    } else {
      console.log("Sending KB LABEL order email...");

      const templateParams = {
        // Recipient aliases: set EmailJS Template > To Email to {{to_email}}
        // or {{customer_email}}. Set BCC to the owner's email in EmailJS.
        to_email: customerEmail,
        customer_email: customerEmail,
        email: customerEmail,
        reply_to: customerEmail,
        owner_email: kbEmailjsConfig.ownerEmail,

        order_id: order.id,
        tracking_number: order.id,
        customer_name: order.customer.name,
        name: order.customer.name,
        phone: order.customer.phone,
        customer_phone: order.customer.phone,
        address: order.customer.address,
        customer_address: order.customer.address,
        district: order.customer.district,
        payment: order.paymentMethod === "bank"
          ? "Bank Transfer"
          : order.paymentMethod === "card"
            ? "Card Payment"
            : "Cash on Delivery",
        payment_method: order.paymentMethod === "bank"
          ? "Bank Transfer"
          : order.paymentMethod === "card"
            ? "Card Payment"
            : "Cash on Delivery",
        products: productsText,
        order_items: productsText,
        subtotal: `Rs. ${Number(order.subtotal).toLocaleString()}`,
        delivery: `Rs. ${Number(order.delivery).toLocaleString()}`,
        total: `Rs. ${Number(order.total).toLocaleString()}`,
        receipt: order.bankSlipUrl || "No bank receipt uploaded",
        receipt_link: order.bankSlipUrl || "No bank receipt uploaded",
        tracking_link: trackingLink,
        tracking_note: "Open the tracking link anytime to view the latest order status.",
        brand_name: kbEmailjsConfig.brandName
      };

      try {
        emailResponse = await withTimeout(
          window.emailjs.send(
            kbEmailjsConfig.serviceId,
            kbEmailjsConfig.templateId,
            templateParams,
            { publicKey: kbEmailjsConfig.publicKey }
          ),
          15000,
          "EmailJS timed out after 15 seconds."
        );
        console.log("KB LABEL email sent:", emailResponse);
      } catch (emailError) {
        console.error("KB LABEL EmailJS failure:", emailError);
        const status = emailError?.status ? ` (${emailError.status})` : "";
        const detail = String(emailError?.text || emailError?.message || "Unknown EmailJS error");
        emailWarning = `Order saved, but email delivery failed${status}: ${detail}`;
      }
    }

    return {
      orderId,
      bankSlipUrl,
      trackingWarning,
      emailWarning
    };
  } catch (error) {
    console.error("Order submission failed:", error);
    throw error;
  }
};
