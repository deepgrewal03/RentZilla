import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { decidePaymentCapture, isBookingPayable } from "./paymentCaptureRules.js";
import { verifyPaymentSignature, verifyWebhookSignature } from "./razorpay.js";

test("accepts a correctly signed Razorpay client payment", () => {
  process.env.RAZORPAY_KEY_SECRET = "test-secret";
  const orderId = "order_booking_1";
  const paymentId = "pay_booking_1";
  const signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  assert.equal(verifyPaymentSignature({ orderId, paymentId, signature }), true);
  assert.equal(verifyPaymentSignature({ orderId, paymentId, signature: "bad" }), false);
});

test("rejects malformed and incorrectly signed webhooks without throwing", () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-test-secret";
  const body = JSON.stringify({ event: "payment.captured" });
  const signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  assert.equal(verifyWebhookSignature(body, signature), true);
  assert.equal(verifyWebhookSignature(body, "bad"), false);
});

test("allows one new capture and makes the same payment replay idempotent", () => {
  assert.deepEqual(decidePaymentCapture({
    status: "created",
    incomingPaymentId: "pay_1",
    expectedAmountPaise: 12500,
    receivedAmountPaise: 12500,
  }), { action: "capture" });

  assert.deepEqual(decidePaymentCapture({
    status: "paid",
    storedPaymentId: "pay_1",
    incomingPaymentId: "pay_1",
    expectedAmountPaise: 12500,
    receivedAmountPaise: 12500,
  }), { action: "idempotent" });
});

test("rejects amount changes, payment ID reuse, and failed order capture", () => {
  assert.deepEqual(decidePaymentCapture({
    status: "created",
    incomingPaymentId: "pay_1",
    expectedAmountPaise: 12500,
    receivedAmountPaise: 100,
  }), { action: "reject", reason: "PAYMENT_AMOUNT_MISMATCH" });

  assert.deepEqual(decidePaymentCapture({
    status: "paid",
    storedPaymentId: "pay_original",
    incomingPaymentId: "pay_replayed",
    expectedAmountPaise: 12500,
  }), { action: "reject", reason: "PAYMENT_REPLAY_MISMATCH" });

  assert.deepEqual(decidePaymentCapture({
    status: "failed",
    incomingPaymentId: "pay_failed",
    expectedAmountPaise: 12500,
  }), { action: "reject", reason: "PAYMENT_NOT_CAPTURABLE" });
});

test("only pending unpaid bookings can enter the Razorpay collection path", () => {
  assert.equal(isBookingPayable("pending", "pending"), true);
  assert.equal(isBookingPayable("pending", "paid"), false);
  assert.equal(isBookingPayable("pending", "refunded"), false);
  assert.equal(isBookingPayable("confirmed", "pending"), false);
  assert.equal(isBookingPayable("in_progress", "pending"), false);
  assert.equal(isBookingPayable("completed", "pending"), false);
  assert.equal(isBookingPayable("cancelled", "pending"), false);
});