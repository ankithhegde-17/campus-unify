import { api } from "./client";

let loader = null,
  logo = null;
// Checkout runs on Razorpay's domain and cannot load images from localhost,
// so the logo is passed as a data URL.
function loadLogo() {
  logo ||= fetch("/apple-touch-icon.png")
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        }),
    )
    .catch(() => undefined);
  return logo;
}
function loadCheckout() {
  loader ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => {
      loader = null;
      reject(new Error("Could not load Razorpay. Check your internet connection."));
    };
    document.head.append(script);
  });
  return loader;
}

// The server validates the payer and amount and creates the Razorpay order.
export async function createRazorpayOrder({ student_id, campus_id, amount }) {
  const [order, image] = await Promise.all([
    api("/razorpay/order", {
      method: "POST",
      body: JSON.stringify({ student_id, campus_id, amount }),
    }),
    loadLogo(),
    loadCheckout(),
  ]);
  return { ...order, image };
}

// Opens Razorpay Checkout and resolves with the server's verified receipt.
// Rejects with `cancelled: true` if the payer closes the popup without paying.
export function openRazorpay(order) {
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: "Maharaja Education Trust",
      description: `Fees · ${order.student.name} (${order.student.code})`,
      image: order.image,
      prefill: { name: order.payer.name, email: order.payer.email },
      theme: { color: "#722f37" },
      modal: {
        confirm_close: true,
        ondismiss: () =>
          reject(
            Object.assign(new Error("Payment cancelled. No money was taken."), {
              cancelled: true,
            }),
          ),
      },
      handler: (response) =>
        api("/razorpay/verify", {
          method: "POST",
          body: JSON.stringify(response),
        }).then(resolve, reject),
    });
    checkout.open();
  });
}
