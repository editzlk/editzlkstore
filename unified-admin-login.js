import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, setPersistence, browserSessionPersistence, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js";

const app = getApps().find((item) => item.name === "[DEFAULT]") || initializeApp(firebaseConfig);
const auth = getAuth(app);
const form = document.getElementById("unifiedAdminLogin");
const error = document.getElementById("unifiedLoginError");
const button = document.getElementById("unifiedLoginButton");
const email = document.getElementById("unifiedEmail");
const password = document.getElementById("unifiedPassword");

document.getElementById("showUnifiedPassword")?.addEventListener("click", (event) => {
  password.type = password.type === "password" ? "text" : "password";
  event.currentTarget.innerHTML = password.type === "password"
    ? '<i class="fa-regular fa-eye"></i>'
    : '<i class="fa-regular fa-eye-slash"></i>';
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.textContent = "";
  button.disabled = true;
  button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Securing control center...';
  const value = email.value.trim().toLowerCase();
  try {
    if (value !== ADMIN_EMAIL.toLowerCase()) throw new Error("This email is not authorized.");
    await setPersistence(auth, browserSessionPersistence);
    await signInWithEmailAndPassword(auth, value, password.value);
    sessionStorage.setItem("unifiedAdmin", "1");
    const requested = new URLSearchParams(location.search).get("next") || "admin.html";
    const allowed = new Set(["admin.html", "pos.html", "kb-pos.html", "store-admin.html", "editz-admin.html"]);
    const destination = allowed.has(requested) ? requested : "admin.html";
    location.replace(destination);
  } catch (err) {
    console.error(err);
    error.textContent = String(err?.message || "Login failed").replace("Firebase: ", "");
  } finally {
    button.disabled = false;
    button.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Enter Control Center';
  }
});

email?.addEventListener("input",()=>{ password.value=""; error.textContent=""; });
window.addEventListener("pageshow",()=>{ password.value=""; });
