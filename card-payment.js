/* KB LABEL secure card payment adapter (PayHere)
   IMPORTANT: Never place your Merchant Secret in this file.
   Configure a secure server endpoint that returns a signed PayHere payment object.
*/
window.KB_CARD_PAYMENT_CONFIG = Object.assign({
  enabled: false,
  provider: "PayHere",
  sandbox: true,
  hashEndpoint: ""
}, window.KB_CARD_PAYMENT_CONFIG || {});

window.startKbCardPayment = async function startKbCardPayment(orderPayload) {
  const config = window.KB_CARD_PAYMENT_CONFIG;
  if (!config.enabled || !config.hashEndpoint) {
    throw new Error("Card payments are not activated yet. Add the PayHere merchant configuration and secure hash endpoint in card-payment.js.");
  }
  if (!window.payhere || typeof window.payhere.startPayment !== "function") {
    throw new Error("The secure card payment service could not be loaded.");
  }

  const response = await fetch(config.hashEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Number(orderPayload.total).toFixed(2),
      currency: "LKR",
      customer: orderPayload.customer,
      items: orderPayload.items
    })
  });
  if (!response.ok) throw new Error("Could not prepare the secure card payment.");
  const payment = await response.json();

  return new Promise((resolve, reject) => {
    window.payhere.onCompleted = function (paymentId) {
      resolve({ paymentId, provider: "PayHere", status: "Paid" });
    };
    window.payhere.onDismissed = function () {
      reject(new Error("Card payment was cancelled."));
    };
    window.payhere.onError = function (error) {
      reject(new Error(error || "Card payment failed."));
    };
    window.payhere.startPayment(payment);
  });
};

document.addEventListener("DOMContentLoaded", () => {
  const note = document.getElementById("cardConfigNote");
  if (!note) return;
  if (window.KB_CARD_PAYMENT_CONFIG.enabled && window.KB_CARD_PAYMENT_CONFIG.hashEndpoint) {
    note.textContent = "Secure card checkout is active.";
    note.classList.add("is-active");
  }
});
