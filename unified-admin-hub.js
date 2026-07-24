import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().find((item) => item.name === "[DEFAULT]") || initializeApp(firebaseConfig);
const auth = getAuth(app);
onAuthStateChanged(auth, (user) => {
  if (!user) {
    location.replace("admin-login.html");
    return;
  }
  const chip = document.getElementById("unifiedAdminEmail");
  if (chip) chip.innerHTML = `<i class="fa-solid fa-user-shield"></i> ${user.email}`;
});

const loader = document.getElementById("frameLoader");
document.querySelectorAll(".ua-frame").forEach((frame) => frame.addEventListener("load", () => {
  loader?.classList.add("is-hidden");
  setTimeout(() => { if (loader) loader.style.display = "none"; }, 360);
  try {
    const doc = frame.contentDocument;
    doc?.documentElement?.classList.add("embedded-admin");
    doc?.querySelectorAll("#logoutBtn,#adminLogout,.back-link").forEach((element) => { element.style.display = "none"; });
    if (frame.id === "editzFrame") doc?.getElementById("loginView")?.setAttribute("hidden", "");
  } catch (_) {}
}));

document.querySelectorAll(".ua-tab").forEach((button) => button.addEventListener("click", () => {
  if (button.classList.contains("active")) return;
  document.querySelectorAll(".ua-tab").forEach((item) => item.classList.toggle("active", item === button));
  document.querySelectorAll(".ua-frame").forEach((item) => item.classList.toggle("active", item.id === button.dataset.frame));
  try { sessionStorage.setItem("uaWorkspace", button.dataset.frame); } catch (_) {}
}));
const savedFrame = sessionStorage.getItem("uaWorkspace");
if (savedFrame && document.getElementById(savedFrame)) document.querySelector(`[data-frame="${savedFrame}"]`)?.click();

document.getElementById("unifiedLogout")?.addEventListener("click", async () => {
  await signOut(auth);
  sessionStorage.removeItem("unifiedAdmin");
  location.replace("admin-login.html");
});
