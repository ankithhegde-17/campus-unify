// Razorpay Checkout: the server creates the order (so the browser never sets
// the price), then verifies the signature and the captured payment with
// Razorpay before any receipt is issued. The key secret never leaves here.
import { Router } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { fail } from "./domain/access.js";
import { onlinePaymentQuote, recordOnlinePayment } from "./domain/actions.js";

const API = "https://api.razorpay.com/v1";

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID,
    secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret)
    fail("Online payments are not configured on the server.", 503);
  return { keyId, secret };
}

async function razorpay(path, { method = "GET", body } = {}) {
  const { keyId, secret } = credentials();
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Razorpay:", response.status, result.error?.description);
    fail(result.error?.description || "Payment gateway request failed.", 502);
  }
  return result;
}

function signatureValid(orderId, paymentId, signature) {
  const expected = createHmac("sha256", credentials().secret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const given = Buffer.from(String(signature || ""), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function razorpayRoutes(store) {
  const router = Router();

  router.get("/config", (_req, res) =>
    res.json({
      enabled: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      keyId: process.env.RAZORPAY_KEY_ID || null,
    }),
  );

  router.post("/order", async (req, res) => {
    const { keyId } = credentials();
    const { student, campusId, amount } = onlinePaymentQuote(
      await store.read(),
      req.actor,
      req.body || {},
    );
    const order = await razorpay("/orders", {
      method: "POST",
      body: {
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: `${student.student_code}-${Date.now()}`.slice(0, 40),
        notes: {
          student_id: student.id,
          campus_id: campusId,
          payer_user_id: req.actor.userId,
        },
      },
    });
    res.json({
      key_id: keyId,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      student: { name: student.full_name, code: student.student_code },
      payer: { name: req.actor.profile.full_name, email: req.actor.email },
    });
  });

  router.post("/verify", async (req, res) => {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body || {};
    if (!orderId || !paymentId || !signatureValid(orderId, paymentId, signature))
      fail("Payment verification failed. No receipt was issued.", 400);

    // Trust Razorpay's records, not the browser, for amount and ownership.
    const order = await razorpay(`/orders/${encodeURIComponent(orderId)}`);
    if (order.notes?.payer_user_id !== req.actor.userId)
      fail("This payment was started from a different account.", 403);
    let payment = await razorpay(`/payments/${encodeURIComponent(paymentId)}`);
    if (payment.order_id !== orderId)
      fail("Payment does not belong to this order.", 400);
    if (payment.status === "authorized")
      payment = await razorpay(`/payments/${encodeURIComponent(paymentId)}/capture`, {
        method: "POST",
        body: { amount: payment.amount, currency: payment.currency },
      });
    if (payment.status !== "captured")
      fail(`Payment is ${payment.status}. No receipt was issued.`, 402);

    const result = await store.mutate((state) =>
      recordOnlinePayment(state, req.actor, {
        student_id: order.notes.student_id,
        campus_id: order.notes.campus_id,
        amount: payment.amount / 100,
        reference: paymentId,
        order_id: orderId,
      }),
    );
    res.json(result);
  });

  return router;
}
