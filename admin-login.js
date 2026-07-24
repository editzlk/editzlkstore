const form = document.getElementById("adminLoginForm");
const errorBox = document.getElementById("loginError");
const submitButton = form?.querySelector('button[type="submit"]');

function whenAuthReady(callback) {
  if (window.kbFirebaseAuth) return callback(window.kbFirebaseAuth);
  window.addEventListener("kb-auth-ready", () => callback(window.kbFirebaseAuth), { once: true });
}

whenAuthReady((authApi) => {
  authApi.onAuthStateChanged((user) => {
    if (user) {
      const next = new URLSearchParams(location.search).get("next") || "store-admin.html";
      location.replace(next);
    }
  });
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!window.kbFirebaseAuth) return;

  errorBox.textContent = "";
  submitButton.disabled = true;
  submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';

  const data = new FormData(form);
  try {
    await window.kbFirebaseAuth.login(data.get("email"), data.get("password"));
  } catch (error) {
    console.error(error);
    const code = String(error?.code || "");
    errorBox.textContent = code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")
      ? "Incorrect email or password."
      : (error?.message || "Login failed. Please try again.");
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = '<i class="fa-solid fa-lock"></i> Login to Dashboard';
  }
});
