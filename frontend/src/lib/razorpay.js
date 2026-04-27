/**
 * Razorpay Checkout helper. Loads the script on demand and resolves the
 * payment response from the modal. The backend creates the Order; this only
 * handles the UI hand-off and posts the signed result back for verification.
 */
import { api, formatApiError } from "./api";

let scriptPromise = null;

function loadCheckoutScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load Razorpay checkout"));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Open the Razorpay modal for an order returned by the backend.
 * @param {object} order - response from /wallet/order or /store/order
 * @param {object} opts
 * @param {string} opts.theme - hex color for the modal (defaults to Vyra cyan)
 * @returns {Promise<{razorpay_order_id, razorpay_payment_id, razorpay_signature}>}
 */
export async function openRazorpayCheckout(order, opts = {}) {
  await loadCheckoutScript();

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency || "USD",
      name: order.name || "Vyra",
      description: order.description || "",
      order_id: order.order_id,
      prefill: order.prefill || {},
      theme: { color: opts.theme || "#00e5ff" },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
      handler: (resp) => resolve(resp),
    });
    rzp.on("payment.failed", (resp) => {
      reject(
        new Error(resp?.error?.description || "Payment failed. Please try again."),
      );
    });
    rzp.open();
  });
}

/**
 * Top-up coins flow: create order, open Razorpay, verify on the server.
 * @param {string} packageId
 * @returns {Promise<{balance:number, order:object}>}
 */
export async function buyCoinPackage(packageId) {
  let order;
  try {
    const { data } = await api.post("/wallet/order", { package_id: packageId });
    order = data;
  } catch (e) {
    throw new Error(formatApiError(e));
  }
  const resp = await openRazorpayCheckout(order, { theme: "#ffd700" });
  const { data } = await api.post("/wallet/verify", resp);
  return data;
}

/**
 * Buy a store item directly with USD via Razorpay.
 */
export async function buyStoreItemWithUsd(itemId) {
  const { data: order } = await api.post("/store/order", { item_id: itemId });
  const resp = await openRazorpayCheckout(order, { theme: "#00e5ff" });
  const { data } = await api.post("/wallet/verify", resp);
  return data;
}
