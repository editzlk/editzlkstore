function whenAuthReady(callback) {
  if (window.kbFirebaseAuth) return callback(window.kbFirebaseAuth);
  window.addEventListener("kb-auth-ready", () => callback(window.kbFirebaseAuth), { once: true });
}

whenAuthReady((authApi) => {
  authApi.onAuthStateChanged((user) => {
    if (!user) {
      const next = encodeURIComponent("store-admin.html");
      location.replace(`admin-login.html?next=${next}`);
      return;
    }

    document.body.classList.remove("auth-checking");
    const email = document.getElementById("adminUserEmail");
    if (email) email.textContent = user.email || "Authenticated admin";
  });
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("#adminLogout");
  if (!button || !window.kbFirebaseAuth) return;
  button.disabled = true;
  try {
    await window.kbFirebaseAuth.logout();
    location.replace("admin-login.html");
  } catch (error) {
    console.error(error);
    alert(error.message || "Could not log out.");
    button.disabled = false;
  }
});
