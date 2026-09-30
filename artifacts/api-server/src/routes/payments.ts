/**
 * /api/payments — Razorpay payment lifecycle
 *
 * POST /api/payments/create-order   — create a Razorpay order for any purpose
 * POST /api/payments/verify         — verify payment signature + credit wallet/grant membership/grant spin
 * POST /api/payments/webhook        — Razorpay server-to-server webhook (fallback)
 * GET  /api/payments/config         — return public key_id for client
 */

import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware } from "./users.js";
import {
  getRazorpay,
  verifyPaymentSignature,
  verifyWebhookSignature,
  PURPOSES,
  type RazorpayPurpose,
} from "../lib/razorpay.js";
import { decidePaymentCapture, isBookingPayable } from "../lib/paymentCaptureRules.js";

const router = Router();
type AR = Request & { userId: string };

function toRows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function newId(): string { return `${Date.now()}${Math.random().toString(36).slice(2, 8)}`; }

const GOLD_PRICE_INR = 2.49;
const WHEEL_SPIN_PRICE_INR = 1.00; // Razorpay minimum is ₹1 (100 paise)

type CapturedOrder = {
  order: any;
  alreadyFulfilled: boolean;
  refundRequired?: boolean;
  refunded?: boolean;
  fulfillment?: Record<string, any>;
  booking?: { id: string; paymentStatus: string; invoiceId: string | null };
  invoice?: any;
};

async function fulfilCapturedNonBooking(order: any, paymentId: string, executor: any) {
  if (order.purpose === PURPOSES.WALLET_TOPUP) {
    return fulfilWalletTopup(order.user_id, Number(order.amount_inr), paymentId, executor);
  }
  if (order.purpose === PURPOSES.GOLD_MEMBERSHIP) {
    return fulfilGoldMembership(order.user_id, Number(order.amount_inr), paymentId, executor);
  }
  if (order.purpose === PURPOSES.WHEEL_SPIN) {
    return fulfilWheelSpin(order.user_id, Number(order.amount_inr), paymentId, executor);
  }
  return {};
}

/**
 * Claims a Razorpay capture exactly once. The order status transition is the
 * idempotency gate for both the client verify call and Razorpay's webhook.
 */
async function captureOrder(params: {
  orderId: string;
  paymentId: string;
  signature?: string;
  userId?: string;
  amountPaise?: number;
}): Promise<CapturedOrder> {
  return db.transaction(async (tx) => {
    const orderRows = toRows(await tx.execute(params.userId
      ? sql`SELECT * FROM razorpay_orders WHERE razorpay_order_id = ${params.orderId} AND user_id = ${params.userId} FOR UPDATE`
      : sql`SELECT * FROM razorpay_orders WHERE razorpay_order_id = ${params.orderId} FOR UPDATE`
    ));
    const order = orderRows[0];
    if (!order) throw new Error("ORDER_NOT_FOUND");

    if (
      order.purpose === PURPOSES.BOOKING_PAYMENT
      && (order.status === "refund_pending" || order.status === "refunded")
    ) {
      if (
        params.amountPaise !== undefined
        && params.amountPaise !== Number(order.amount_paise)
      ) throw new Error("PAYMENT_AMOUNT_MISMATCH");
      if (
        order.razorpay_payment_id
        && order.razorpay_payment_id !== params.paymentId
      ) throw new Error("PAYMENT_REPLAY_MISMATCH");
      return {
        order,
        alreadyFulfilled: order.status === "refunded",
        refundRequired: order.status === "refund_pending",
        refunded: order.status === "refunded",
      };
    }

    const decision = decidePaymentCapture({
      status: order.status,
      storedPaymentId: order.razorpay_payment_id,
      incomingPaymentId: params.paymentId,
      expectedAmountPaise: Number(order.amount_paise),
      receivedAmountPaise: params.amountPaise,
    });
    if (decision.action === "reject") throw new Error(decision.reason);

    if (decision.action === "idempotent") {
      if (!order.booking_id && !order.fulfilled_at) {
        const fulfillment = await fulfilCapturedNonBooking(order, params.paymentId, tx);
        await tx.execute(sql`
          UPDATE razorpay_orders SET fulfilled_at = NOW()
          WHERE razorpay_order_id = ${params.orderId}
        `);
        return { order, alreadyFulfilled: false, fulfillment };
      }
      const invoiceRows = order.booking_id
        ? toRows(await tx.execute(sql`SELECT * FROM invoices WHERE booking_id = ${order.booking_id} LIMIT 1`))
        : [];
      return {
        order,
        alreadyFulfilled: true,
        ...(order.booking_id ? {
          booking: { id: order.booking_id, paymentStatus: "paid", invoiceId: invoiceRows[0]?.id ?? null },
          invoice: invoiceRows[0],
        } : {}),
      };
    }

    const reusedPayment = toRows(await tx.execute(sql`
      SELECT id FROM razorpay_orders
      WHERE razorpay_payment_id = ${params.paymentId}
        AND razorpay_order_id <> ${params.orderId}
      LIMIT 1
    `));
    if (reusedPayment.length) throw new Error("PAYMENT_REPLAY_MISMATCH");

    const claimedRows = toRows(await tx.execute(sql`
      UPDATE razorpay_orders
      SET status = 'paid', razorpay_payment_id = ${params.paymentId},
          razorpay_signature = ${params.signature ?? null}, paid_at = NOW()
      WHERE razorpay_order_id = ${params.orderId} AND status = 'created'
      RETURNING *
    `));
    const claimed = claimedRows[0];
    if (!claimed) throw new Error("PAYMENT_NOT_CAPTURABLE");

    if (claimed.purpose !== PURPOSES.BOOKING_PAYMENT) {
      const fulfillment = await fulfilCapturedNonBooking(claimed, params.paymentId, tx);
      await tx.execute(sql`
        UPDATE razorpay_orders SET fulfilled_at = NOW()
        WHERE razorpay_order_id = ${params.orderId}
      `);
      return { order: claimed, alreadyFulfilled: false, fulfillment };
    }

    const bookedRows = toRows(await tx.execute(sql`
      UPDATE bookings
      SET payment_status = 'paid',
          amount_paid = COALESCE(NULLIF(final_amount, 0), total_amount),
          payment_due_amount = 0,
          payment_order_id = ${claimed.razorpay_order_id},
          paid_at = NOW(),
          updated_at = NOW()
      WHERE id = ${claimed.booking_id}
        AND customer_id = ${claimed.user_id}
        AND status = 'pending'
        AND payment_status = 'pending'
      RETURNING *
    `));
    const booking = bookedRows[0];
    if (!booking) {
      const refundRows = toRows(await tx.execute(sql`
        UPDATE razorpay_orders
        SET status = 'refund_pending'
        WHERE razorpay_order_id = ${params.orderId}
          AND status = 'paid'
        RETURNING *
      `));
      return {
        order: refundRows[0] ?? claimed,
        alreadyFulfilled: false,
        refundRequired: true,
      };
    }

    if (Number(booking.gold_discount_amount || 0) > 0) {
      await tx.execute(sql`
        UPDATE users
        SET total_membership_savings = total_membership_savings + ${Number(booking.gold_discount_amount)}
        WHERE id = ${claimed.user_id}
      `);
    }

    const invoiceId = newId();
    const invoiceNumber = `RZ-${String(booking.id).slice(-8).toUpperCase()}-${String(claimed.id).slice(-6).toUpperCase()}`;
    await tx.execute(sql`
      INSERT INTO invoices
        (id, invoice_number, booking_id, user_id, payment_order_id, razorpay_payment_id,
         currency, subtotal, discount_amount, total_amount, status, issued_at, created_at)
      VALUES
        (${invoiceId}, ${invoiceNumber}, ${booking.id}, ${claimed.user_id},
         ${claimed.razorpay_order_id}, ${params.paymentId}, 'INR',
         ${Number(booking.total_amount)}, ${Number(booking.discount_amount || 0)},
         ${Number(booking.final_amount || booking.total_amount)}, 'issued', NOW(), NOW())
      ON CONFLICT (booking_id) DO NOTHING
    `);
    const invoiceRows = toRows(await tx.execute(sql`
      SELECT * FROM invoices WHERE booking_id = ${booking.id} LIMIT 1
    `));
    const invoice = invoiceRows[0];
    await tx.execute(sql`UPDATE bookings SET invoice_id = ${invoice?.id ?? null} WHERE id = ${booking.id}`);
    await tx.execute(sql`
      UPDATE razorpay_orders SET fulfilled_at = NOW()
      WHERE razorpay_order_id = ${params.orderId}
    `);

    return {
      order: claimed,
      alreadyFulfilled: false,
      booking: { id: booking.id, paymentStatus: "paid", invoiceId: invoice?.id ?? null },
      invoice,
    };
  });
}

async function recoverOrphanBookingCapture(params: {
  orderId: string;
  paymentId: string;
  signature?: string;
  userId?: string;
  amountPaise?: number;
}): Promise<CapturedOrder> {
  const externalOrder = await getRazorpay().orders.fetch(params.orderId);
  const notes = (externalOrder.notes ?? {}) as Record<string, string>;
  const bookingId = notes.bookingId;
  const notedUserId = notes.userId;
  if (
    notes.purpose !== PURPOSES.BOOKING_PAYMENT
    || !bookingId
    || !notedUserId
    || (params.userId && params.userId !== notedUserId)
  ) {
    throw new Error("ORDER_NOT_FOUND");
  }

  const amountPaise = Number(externalOrder.amount);
  if (
    !Number.isFinite(amountPaise)
    || (params.amountPaise !== undefined && params.amountPaise !== amountPaise)
  ) {
    throw new Error("PAYMENT_AMOUNT_MISMATCH");
  }

  const recovered = await db.transaction(async (tx) => {
    const existingRows = toRows(await tx.execute(sql`
      SELECT * FROM razorpay_orders
      WHERE razorpay_order_id = ${params.orderId}
      FOR UPDATE
    `));
    if (existingRows.length) return existingRows[0];

    const bookingRows = toRows(await tx.execute(sql`
      SELECT * FROM bookings WHERE id = ${bookingId} FOR UPDATE LIMIT 1
    `));
    const booking = bookingRows[0];
    if (!booking || booking.customer_id !== notedUserId) {
      throw new Error("ORDER_NOT_FOUND");
    }

    const expectedPaise = Math.round(Number(booking.final_amount || booking.total_amount) * 100);
    let refundRequired = (
      !isBookingPayable(booking.status, booking.payment_status)
      || expectedPaise !== amountPaise
    );

    if (!refundRequired && booking.promo_code && !booking.promo_reserved_order_id) {
      const promoRows = toRows(await tx.execute(sql`
        UPDATE promo_codes SET used_count = used_count + 1
        WHERE UPPER(code) = UPPER(${booking.promo_code})
          AND is_active = TRUE
          AND (expires_at IS NULL OR expires_at >= NOW())
          AND used_count < max_uses
        RETURNING id
      `));
      if (promoRows.length === 0) {
        refundRequired = true;
      } else {
        await tx.execute(sql`
          UPDATE bookings
          SET promo_reserved_order_id = ${params.orderId}, promo_released_at = NULL
          WHERE id = ${bookingId}
        `);
      }
    }

    const reusedPayment = toRows(await tx.execute(sql`
      SELECT id FROM razorpay_orders
      WHERE razorpay_payment_id = ${params.paymentId}
        AND razorpay_order_id <> ${params.orderId}
      LIMIT 1
    `));
    if (reusedPayment.length) throw new Error("PAYMENT_REPLAY_MISMATCH");

    const paymentRecordId = newId();
    const insertedRows = toRows(await tx.execute(sql`
      INSERT INTO razorpay_orders
        (id, user_id, razorpay_order_id, purpose, amount_inr, amount_paise,
         status, notes, booking_id, razorpay_payment_id, razorpay_signature,
         paid_at, created_at)
      VALUES (
        ${paymentRecordId}, ${notedUserId}, ${params.orderId}, ${PURPOSES.BOOKING_PAYMENT},
        ${amountPaise / 100}, ${amountPaise},
        ${refundRequired ? "refund_pending" : "created"},
        ${JSON.stringify(notes)}::jsonb, ${bookingId},
        ${refundRequired ? params.paymentId : null}, ${params.signature ?? null},
        ${refundRequired ? sql`NOW()` : null}, NOW()
      )
      ON CONFLICT (razorpay_order_id) DO NOTHING
      RETURNING *
    `));
    if (insertedRows.length) return insertedRows[0];
    const winnerRows = toRows(await tx.execute(sql`
      SELECT * FROM razorpay_orders WHERE razorpay_order_id = ${params.orderId} LIMIT 1
    `));
    if (!winnerRows.length) throw new Error("ORDER_NOT_FOUND");
    return winnerRows[0];
  });

  if (recovered.status === "refund_pending" || recovered.status === "refunded") {
    return {
      order: recovered,
      alreadyFulfilled: recovered.status === "refunded",
      refundRequired: recovered.status === "refund_pending",
      refunded: recovered.status === "refunded",
    };
  }
  return captureOrder(params);
}

async function refundCapturedBookingPayment(captured: CapturedOrder) {
  const order = captured.order;
  if (captured.refunded || order.status === "refunded") {
    return { refunded: true, refundId: order.refund_id ?? null };
  }
  const paymentId = order.razorpay_payment_id;
  if (!paymentId) throw new Error("REFUND_PAYMENT_ID_MISSING");

  const rz = getRazorpay();
  const expectedPaise = Number(order.amount_paise);
  let payment = await rz.payments.fetch(paymentId);
  let amountRefunded = Number(payment.amount_refunded || 0);
  let refundId: string | null = order.refund_id ?? null;

  if (amountRefunded < expectedPaise && !refundId) {
    const refunds = await rz.payments.fetchMultipleRefund(paymentId, { count: 100 }) as any;
    const existingRefund = (refunds?.items ?? []).find(
      (refund: any) => refund.notes?.orderId === order.razorpay_order_id
    );
    refundId = existingRefund?.id ?? null;
  }

  if (amountRefunded < expectedPaise && !refundId) {
    try {
      const refund = await rz.payments.refund(paymentId, {
        amount: expectedPaise - amountRefunded,
        notes: {
          reason: "booking_cancelled_before_payment_fulfillment",
          orderId: order.razorpay_order_id,
        },
      });
      refundId = refund.id;
      await db.execute(sql`
        UPDATE razorpay_orders SET refund_id = ${refundId}
        WHERE razorpay_order_id = ${order.razorpay_order_id}
          AND status = 'refund_pending'
      `);
    } catch (err) {
      const refunds = await rz.payments.fetchMultipleRefund(paymentId, { count: 100 }) as any;
      const concurrentRefund = (refunds?.items ?? []).find(
        (refund: any) => refund.notes?.orderId === order.razorpay_order_id
      );
      if (!concurrentRefund) throw err;
      refundId = concurrentRefund.id;
    }
  }

  if (refundId && refundId !== order.refund_id) {
    await db.execute(sql`
      UPDATE razorpay_orders SET refund_id = ${refundId}
      WHERE razorpay_order_id = ${order.razorpay_order_id}
        AND status = 'refund_pending'
    `);
  }

  // Razorpay refunds can be asynchronous. Only close the local state after the
  // provider confirms the entire captured amount has actually been refunded.
  payment = await rz.payments.fetch(paymentId);
  amountRefunded = Number(payment.amount_refunded || 0);
  if (amountRefunded < expectedPaise) {
    return { refunded: false, refundPending: true, refundId };
  }

  await db.execute(sql`
    UPDATE razorpay_orders
    SET status = 'refunded',
        refund_id = ${refundId},
        refunded_at = NOW(),
        fulfilled_at = NOW()
    WHERE razorpay_order_id = ${order.razorpay_order_id}
      AND razorpay_payment_id = ${paymentId}
      AND status IN ('refund_pending', 'refunded')
  `);
  return { refunded: true, refundId };
}

let refundReconcileRunning = false;
async function reconcilePendingBookingRefunds() {
  if (refundReconcileRunning) return;
  refundReconcileRunning = true;
  try {
    const pending = toRows(await db.execute(sql`
      SELECT * FROM razorpay_orders
      WHERE purpose = 'booking_payment' AND status = 'refund_pending'
      ORDER BY paid_at ASC
      LIMIT 25
    `));
    for (const order of pending) {
      try {
        await refundCapturedBookingPayment({
          order,
          alreadyFulfilled: false,
          refundRequired: true,
        });
      } catch (err) {
        console.error("Pending booking refund reconciliation failed", order.razorpay_order_id, err);
      }
    }
  } finally {
    refundReconcileRunning = false;
  }
}

const refundReconcileTimer = setInterval(() => {
  void reconcilePendingBookingRefunds();
}, 60_000);
refundReconcileTimer.unref();
const initialRefundReconcileTimer = setTimeout(() => {
  void reconcilePendingBookingRefunds();
}, 5_000);
initialRefundReconcileTimer.unref();

// ── GET /payments/config — public Razorpay key ──────────────────────────────
router.get("/config", (req: Request, res: Response) => {
  res.json({ keyId: process.env.RAZORPAY_KEY_ID || "" });
});

// ── POST /payments/create-order ─────────────────────────────────────────────
// Body: { purpose, amount?, bookingId? }. Booking amounts always come from the
// persisted booking, never from the client.
router.post("/create-order", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { purpose, amount: reqAmount, bookingId } = req.body as {
      purpose: RazorpayPurpose;
      amount?: number;
      bookingId?: string;
    };

    if (!Object.values(PURPOSES).includes(purpose)) {
      res.status(400).json({ error: "Invalid purpose" });
      return;
    }

    // Determine INR amount (in paise — Razorpay uses smallest currency unit).
    // A booking order is bound to one customer-owned pending booking.
    let amountINR: number;
    let booking: any | undefined;
    if (purpose === PURPOSES.BOOKING_PAYMENT) {
      if (!bookingId || typeof bookingId !== "string") {
        res.status(400).json({ error: "bookingId is required for a booking payment" });
        return;
      }
      const rows = toRows(await db.execute(sql`
        SELECT id, customer_id, status, payment_status, final_amount, total_amount
        FROM bookings WHERE id = ${bookingId} LIMIT 1
      `));
      booking = rows[0];
      if (!booking || booking.customer_id !== userId) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }
      if (!isBookingPayable(booking.status, booking.payment_status)) {
        res.status(409).json({ error: "This booking does not require payment" });
        return;
      }
      amountINR = Number(booking.final_amount || booking.total_amount);
      if (!Number.isFinite(amountINR) || amountINR < 1) {
        res.status(400).json({ error: "Booking amount must be at least ₹1" });
        return;
      }
    } else if (purpose === PURPOSES.WALLET_TOPUP) {
      amountINR = parseFloat(String(reqAmount || 0));
      if (!amountINR || amountINR < 1 || amountINR > 100000) {
        res.status(400).json({ error: "Wallet top-up amount must be ₹1 – ₹1,00,000" });
        return;
      }
    } else if (purpose === PURPOSES.GOLD_MEMBERSHIP) {
      amountINR = GOLD_PRICE_INR;
    } else if (purpose === PURPOSES.WHEEL_SPIN) {
      amountINR = WHEEL_SPIN_PRICE_INR;
    } else {
      res.status(400).json({ error: "Unknown purpose" });
      return;
    }

    const amountPaise = Math.round(amountINR * 100);

    // Fetch user info for Razorpay prefill
    const users = toRows(await db.execute(sql`SELECT name, email, phone FROM users WHERE id = ${userId} LIMIT 1`));
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }
    const user = users[0];

    // Serialize booking order creation on the booking row before calling
    // Razorpay. This prevents concurrent Pay taps from creating an orphaned
    // external order that loses the local partial-unique-index race.
    if (purpose === PURPOSES.BOOKING_PAYMENT && bookingId) {
      const response = await db.transaction(async (tx) => {
        const lockedRows = toRows(await tx.execute(sql`
          SELECT id, customer_id, status, payment_status, final_amount, total_amount, promo_code
          FROM bookings WHERE id = ${bookingId} FOR UPDATE LIMIT 1
        `));
        const lockedBooking = lockedRows[0];
        if (!lockedBooking || lockedBooking.customer_id !== userId) {
          throw new Error("BOOKING_NOT_FOUND");
        }
        if (!isBookingPayable(lockedBooking.status, lockedBooking.payment_status)) {
          throw new Error("BOOKING_NOT_PAYABLE");
        }

        const existing = toRows(await tx.execute(sql`
          SELECT razorpay_order_id, amount_paise, amount_inr
          FROM razorpay_orders
          WHERE booking_id = ${bookingId} AND user_id = ${userId} AND status = 'created'
          LIMIT 1
        `));
        if (existing.length) {
          return {
            orderId: existing[0].razorpay_order_id,
            amount: Number(existing[0].amount_paise),
            currency: "INR",
            keyId: process.env.RAZORPAY_KEY_ID,
            prefill: { name: user.name || "", email: user.email || "", contact: user.phone || "" },
            purpose,
            amountINR: Number(existing[0].amount_inr),
            bookingId,
            reusedOrder: true,
          };
        }

        // Reserve limited promo capacity before an external order can collect.
        // The booking row lock and outstanding-order reuse make this exactly once.
        if (lockedBooking.promo_code) {
          const promoRows = toRows(await tx.execute(sql`
            UPDATE promo_codes SET used_count = used_count + 1
            WHERE UPPER(code) = UPPER(${lockedBooking.promo_code})
              AND is_active = TRUE
              AND (expires_at IS NULL OR expires_at >= NOW())
              AND used_count < max_uses
            RETURNING id
          `));
          if (promoRows.length === 0) {
            throw new Error("PROMO_UNAVAILABLE");
          }
        }

        const lockedAmountINR = Number(lockedBooking.final_amount || lockedBooking.total_amount);
        if (!Number.isFinite(lockedAmountINR) || lockedAmountINR < 1) {
          throw new Error("INVALID_BOOKING_AMOUNT");
        }
        const lockedAmountPaise = Math.round(lockedAmountINR * 100);
        const shortId = Date.now().toString(36);
        const receipt = `rz_${purpose.slice(0, 10)}_${shortId}`.slice(0, 40);
        const order = await getRazorpay().orders.create({
          amount: lockedAmountPaise,
          currency: "INR",
          receipt,
          notes: { userId, purpose, amountINR: String(lockedAmountINR), bookingId },
        });

        const paymentRecordId = newId();
        await tx.execute(sql`
          INSERT INTO razorpay_orders
            (id, user_id, razorpay_order_id, purpose, amount_inr, amount_paise, status, notes, booking_id, created_at)
          VALUES
            (${paymentRecordId}, ${userId}, ${order.id}, ${purpose}, ${lockedAmountINR},
             ${lockedAmountPaise}, 'created',
             ${JSON.stringify({ purpose, amountINR: lockedAmountINR, bookingId })}::jsonb,
             ${bookingId}, NOW())
        `);
        if (lockedBooking.promo_code) {
          await tx.execute(sql`
            UPDATE bookings
            SET promo_reserved_order_id = ${order.id}, promo_released_at = NULL
            WHERE id = ${bookingId}
          `);
        }

        return {
          orderId: order.id,
          amount: lockedAmountPaise,
          currency: "INR",
          keyId: process.env.RAZORPAY_KEY_ID,
          prefill: { name: user.name || "", email: user.email || "", contact: user.phone || "" },
          purpose,
          amountINR: lockedAmountINR,
          bookingId,
        };
      });
      res.json(response);
      return;
    }

    const rz = getRazorpay();
    // Razorpay receipt must be ≤ 40 chars
    const shortId = Date.now().toString(36);
    const receipt = `rz_${purpose.slice(0, 10)}_${shortId}`.slice(0, 40);
    const order = await rz.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        userId,
        purpose,
        amountINR: String(amountINR),
        ...(bookingId ? { bookingId } : {}),
      },
    });

    // Persist pending payment record
    const paymentRecordId = newId();
    await db.execute(sql`
      INSERT INTO razorpay_orders
        (id, user_id, razorpay_order_id, purpose, amount_inr, amount_paise, status, notes, booking_id, created_at)
      VALUES
        (${paymentRecordId}, ${userId}, ${order.id}, ${purpose}, ${amountINR},
         ${amountPaise}, 'created', ${JSON.stringify({ purpose, amountINR, bookingId })}::jsonb, ${bookingId ?? null}, NOW())
      ON CONFLICT (razorpay_order_id) DO NOTHING
    `);

    res.json({
      orderId: order.id,
      amount: amountPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      prefill: {
        name: user.name || "",
        email: user.email || "",
        contact: user.phone || "",
      },
      purpose,
      amountINR,
      ...(booking ? { bookingId: booking.id } : {}),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "BOOKING_NOT_FOUND") {
      res.status(404).json({ error: "Booking not found" });
      return;
    }
    if (err instanceof Error && err.message === "BOOKING_NOT_PAYABLE") {
      res.status(409).json({ error: "This booking does not require payment" });
      return;
    }
    if (err instanceof Error && err.message === "PROMO_UNAVAILABLE") {
      res.status(409).json({ error: "This promo code is no longer available" });
      return;
    }
    if (err instanceof Error && err.message === "INVALID_BOOKING_AMOUNT") {
      res.status(400).json({ error: "Booking amount must be at least ₹1" });
      return;
    }
    req.log?.error({ err }, "Create Razorpay order error");
    res.status(500).json({ error: "Could not create payment order" });
  }
});

// ── POST /payments/verify — verify + fulfil ──────────────────────────────────
// Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature, purpose, amount? }
router.post("/verify", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      res.status(400).json({ error: "razorpayOrderId, razorpayPaymentId, razorpaySignature are required" });
      return;
    }

    // Verify HMAC signature
    const valid = verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });
    if (!valid) {
      res.status(400).json({ error: "Invalid payment signature" });
      return;
    }

    // Fetch our order record before capture so clients only verify their own order.
    const orderRows = toRows(await db.execute(sql`
      SELECT * FROM razorpay_orders
      WHERE razorpay_order_id = ${razorpayOrderId} AND user_id = ${userId}
      LIMIT 1
    `));
    const captured = orderRows.length
      ? await captureOrder({
          orderId: razorpayOrderId,
          paymentId: razorpayPaymentId,
          signature: razorpaySignature,
          userId,
        })
      : await recoverOrphanBookingCapture({
          orderId: razorpayOrderId,
          paymentId: razorpayPaymentId,
          signature: razorpaySignature,
          userId,
        });
    const purpose = captured.order.purpose as RazorpayPurpose;
    const amountINR = Number(captured.order.amount_inr);

    let result: Record<string, any> = {};

    // ── Fulfil by purpose ────────────────────────────────────────────────────
    if (captured.refundRequired || captured.refunded) {
      try {
        const refund = await refundCapturedBookingPayment(captured);
        if (refund.refunded) {
          res.status(409).json({
            success: false,
            purpose,
            refunded: true,
            refundId: refund.refundId,
            error: "The booking was cancelled before payment completed, so the payment was refunded",
          });
        } else {
          res.status(202).json({
            success: false,
            purpose,
            refundPending: true,
            refundId: refund.refundId,
            error: "The booking was cancelled and the payment refund is being processed",
          });
        }
      } catch (refundError) {
        req.log?.error({ err: refundError }, "Booking payment refund pending");
        res.status(202).json({
          success: false,
          purpose,
          refundPending: true,
          error: "The booking was cancelled and the payment refund is being processed",
        });
      }
      return;
    } else if (captured.alreadyFulfilled) {
      result = {
        alreadyFulfilled: true,
        ...(captured.booking ? { booking: captured.booking } : {}),
        ...(captured.invoice ? { invoice: invoiceResponse(captured.invoice) } : {}),
      };
    } else if (purpose === PURPOSES.BOOKING_PAYMENT) {
      result = {
        booking: captured.booking,
        invoice: captured.invoice ? invoiceResponse(captured.invoice) : null,
      };
    } else {
      result = captured.fulfillment ?? {};
    }

    res.json({ success: true, purpose, ...result });
  } catch (err) {
    req.log?.error({ err }, "Verify payment error");
    const message = err instanceof Error ? err.message : "";
    const status = ["ORDER_NOT_FOUND", "PAYMENT_AMOUNT_MISMATCH", "PAYMENT_REPLAY_MISMATCH", "BOOKING_NOT_PAYABLE"].includes(message) ? 409 : 500;
    res.status(status).json({ error: status === 409 ? "Payment could not be applied to this booking" : "Payment verification failed" });
  }
});

// ── POST /payments/webhook — Razorpay server-to-server (raw body required) ──
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    const rawBody = (req as any).rawBody as string | undefined;

    if (!rawBody || !signature) {
      res.status(400).json({ error: "Missing body or signature" });
      return;
    }

    if (!verifyWebhookSignature(rawBody, signature)) {
      res.status(400).json({ error: "Invalid webhook signature" });
      return;
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event as string;

    if (eventType === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      const orderId = payment?.order_id;
      const paymentId = payment?.id;
      if (!orderId || !paymentId) { res.json({ ok: true }); return; }

      let captured: CapturedOrder;
      try {
        captured = await captureOrder({
          orderId,
          paymentId,
          amountPaise: Number(payment.amount),
        });
      } catch (err) {
        if (!(err instanceof Error) || err.message !== "ORDER_NOT_FOUND") throw err;
        captured = await recoverOrphanBookingCapture({
          orderId,
          paymentId,
          amountPaise: Number(payment.amount),
        });
      }
      const purpose = captured.order.purpose as RazorpayPurpose;
      const userId = captured.order.user_id;
      const amountINR = Number(captured.order.amount_inr);

      if (captured.refundRequired || captured.refunded) {
        await refundCapturedBookingPayment(captured);
      }
      // captureOrder atomically performs fulfillment; cancelled bookings are
      // durably moved through the idempotent refund path above.
    }

    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, "Webhook payment error");
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

function invoiceResponse(invoice: any) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    bookingId: invoice.booking_id,
    paymentId: invoice.razorpay_payment_id,
    currency: invoice.currency,
    subtotal: Number(invoice.subtotal),
    discountAmount: Number(invoice.discount_amount),
    totalAmount: Number(invoice.total_amount),
    status: invoice.status,
    issuedAt: invoice.issued_at,
  };
}

// ── Fulfilment helpers ───────────────────────────────────────────────────────

async function fulfilWalletTopup(userId: string, amountINR: number, paymentId: string, executor: any = db) {
  // Idempotency: check if this paymentId was already processed
  const existing = toRows(await executor.execute(sql.raw(`
    SELECT id FROM wallet_transactions WHERE reference_id = '${paymentId}' AND user_id = '${userId}' LIMIT 1
  `)));
  if (existing.length) return { alreadyFulfilled: true, paymentId };

  const updated = toRows(await executor.execute(sql.raw(`
    UPDATE users SET wallet_balance = wallet_balance + ${amountINR}
    WHERE id = '${userId}' RETURNING wallet_balance
  `)));
  const newBalance = Number(updated[0]?.wallet_balance || 0);

  const txId = newId();
  await executor.execute(sql.raw(`
    INSERT INTO wallet_transactions
      (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
    VALUES ('${txId}', '${userId}', 'topup', ${amountINR}, ${newBalance},
      '${paymentId}', 'razorpay',
      'Wallet top-up via Razorpay (${paymentId})', 'completed')
  `));

  return { newBalance, transactionId: txId, paymentId };
}

async function fulfilGoldMembership(userId: string, amountINR: number, paymentId: string, executor: any = db) {
  // Idempotency
  const existing = toRows(await executor.execute(sql.raw(`
    SELECT id FROM wallet_transactions WHERE reference_id = '${paymentId}' AND user_id = '${userId}' LIMIT 1
  `)));
  if (existing.length) return { alreadyFulfilled: true };

  const activatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();

  const userRows = toRows(await executor.execute(sql.raw(`SELECT is_gold_member FROM users WHERE id = '${userId}' LIMIT 1`)));
  const wasGold = Boolean(userRows[0]?.is_gold_member);

  await executor.execute(sql.raw(`
    UPDATE users
    SET is_gold_member = TRUE,
        gold_activated_at = '${activatedAt}',
        gold_expires_at = '${expiresAt}',
        gold_purchase_amount = ${amountINR}
    WHERE id = '${userId}'
  `));

  // Log payment as wallet transaction for record-keeping
  const txId = newId();
  const balRows = toRows(await executor.execute(sql.raw(`SELECT wallet_balance FROM users WHERE id = '${userId}' LIMIT 1`)));
  const bal = Number(balRows[0]?.wallet_balance || 0);
  await executor.execute(sql.raw(`
    INSERT INTO wallet_transactions
      (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
    VALUES ('${txId}', '${userId}', 'gold_membership', ${amountINR}, ${bal},
      '${paymentId}', 'razorpay',
      '${wasGold ? "Gold Membership renewal" : "Gold Membership activation"} via Razorpay', 'completed')
  `));

  return { isGoldMember: true, expiresAt, paymentId, renewed: wasGold };
}

async function fulfilWheelSpin(userId: string, amountINR: number, paymentId: string, executor: any = db) {
  // Idempotency
  const existing = toRows(await executor.execute(sql.raw(`
    SELECT id FROM wallet_transactions WHERE reference_id = '${paymentId}' AND user_id = '${userId}' LIMIT 1
  `)));
  if (existing.length) return { alreadyFulfilled: true };

  const updated = toRows(await executor.execute(sql.raw(`
    UPDATE users
    SET paid_spin_balance = COALESCE(paid_spin_balance, 0) + 1
    WHERE id = '${userId}'
    RETURNING paid_spin_balance, wallet_balance
  `)));
  const paidSpinBalance = Number(updated[0]?.paid_spin_balance || 1);
  const bal = Number(updated[0]?.wallet_balance || 0);

  const txId = newId();
  await executor.execute(sql.raw(`
    INSERT INTO wallet_transactions
      (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
    VALUES ('${txId}', '${userId}', 'paid_spin', ${amountINR}, ${bal},
      '${paymentId}', 'razorpay',
      'Wheel of Fortune spin via Razorpay', 'completed')
  `));

  // Credit platform/admin spin revenue
  const admins = toRows(await executor.execute(sql.raw(`SELECT id FROM users WHERE is_admin = TRUE LIMIT 1`)));
  if (admins.length) {
    const aid = admins[0].id;
    const atx = newId();
    await executor.execute(sql.raw(`UPDATE users SET wallet_balance = wallet_balance + ${amountINR} WHERE id = '${aid}'`));
    await executor.execute(sql.raw(`
      INSERT INTO wallet_transactions
        (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
      VALUES ('${atx}', '${aid}', 'spin_revenue', ${amountINR},
        (SELECT wallet_balance FROM users WHERE id = '${aid}'),
        '${paymentId}', 'razorpay', 'Spin purchase via Razorpay', 'completed')
    `));
  }

  return { paidSpinBalance, paymentId };
}

// ── GET /payments/history — user's Razorpay payment history ─────────────────
router.get("/history", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const page = parseInt(String(req.query.page || "1"));
    const limit = Math.min(parseInt(String(req.query.limit || "20")), 50);
    const offset = (page - 1) * limit;
    const purpose = req.query.purpose as string | undefined;

    const whereClause = purpose
      ? `WHERE ro.user_id = '${userId}' AND ro.purpose = '${purpose}'`
      : `WHERE ro.user_id = '${userId}'`;

    const [orders, countRows] = await Promise.all([
      db.execute(sql.raw(`
        SELECT ro.id, ro.razorpay_order_id, ro.razorpay_payment_id, ro.amount_inr,
               ro.purpose, ro.status, ro.created_at, ro.paid_at
        FROM razorpay_orders ro
        ${whereClause}
        ORDER BY ro.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `)),
      db.execute(sql.raw(`
        SELECT COUNT(*) as total FROM razorpay_orders ro ${whereClause}
      `)),
    ]);

    const rows = toRows(orders);
    const total = Number(toRows(countRows)[0]?.total || 0);

    res.json({
      payments: rows.map(r => ({
        id: r.id,
        orderId: r.razorpay_order_id,
        paymentId: r.razorpay_payment_id,
        amount: Number(r.amount_inr),
        currency: "INR",
        purpose: r.purpose,
        status: r.status,
        createdAt: r.created_at,
        paidAt: r.paid_at,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    req.log?.error({ err }, "Payments history error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
