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

const router = Router();
type AR = Request & { userId: string };

function toRows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function newId(): string { return `${Date.now()}${Math.random().toString(36).slice(2, 8)}`; }

const GOLD_PRICE_INR = 2.49;
const WHEEL_SPIN_PRICE_INR = 1.00; // Razorpay minimum is ₹1 (100 paise)

// ── GET /payments/config — public Razorpay key ──────────────────────────────
router.get("/config", (req: Request, res: Response) => {
  res.json({ keyId: process.env.RAZORPAY_KEY_ID || "" });
});

// ── POST /payments/create-order ─────────────────────────────────────────────
// Body: { purpose: "wallet_topup" | "gold_membership" | "wheel_spin", amount?: number }
router.post("/create-order", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { purpose, amount: reqAmount } = req.body as { purpose: RazorpayPurpose; amount?: number };

    if (!Object.values(PURPOSES).includes(purpose)) {
      res.status(400).json({ error: "Invalid purpose" });
      return;
    }

    // Determine INR amount (in paise — Razorpay uses smallest currency unit)
    let amountINR: number;
    if (purpose === PURPOSES.WALLET_TOPUP) {
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
    const users = toRows(await db.execute(sql.raw(`SELECT name, email, phone FROM users WHERE id = '${userId}' LIMIT 1`)));
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }
    const user = users[0];

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
      },
    });

    // Persist pending payment record
    const paymentRecordId = newId();
    const safeNotes = JSON.stringify({ purpose, amountINR }).replace(/'/g, "''");
    await db.execute(sql.raw(`
      INSERT INTO razorpay_orders (id, user_id, razorpay_order_id, purpose, amount_inr, amount_paise, status, notes, created_at)
      VALUES ('${paymentRecordId}', '${userId}', '${order.id}', '${purpose}',
              ${amountINR}, ${amountPaise}, 'created', '${safeNotes}', NOW())
      ON CONFLICT (razorpay_order_id) DO NOTHING
    `));

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
    });
  } catch (err) {
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

    // Fetch our order record
    const orderRows = toRows(await db.execute(sql.raw(`
      SELECT * FROM razorpay_orders
      WHERE razorpay_order_id = '${razorpayOrderId}' AND user_id = '${userId}'
      LIMIT 1
    `)));
    if (!orderRows.length) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const order = orderRows[0];

    // Idempotency — already fulfilled
    if (order.status === "paid") {
      res.json({ success: true, alreadyFulfilled: true });
      return;
    }

    // Mark as paid
    await db.execute(sql.raw(`
      UPDATE razorpay_orders
      SET status = 'paid', razorpay_payment_id = '${razorpayPaymentId}',
          razorpay_signature = '${razorpaySignature}', paid_at = NOW()
      WHERE razorpay_order_id = '${razorpayOrderId}'
    `));

    const purpose = order.purpose as RazorpayPurpose;
    const amountINR = Number(order.amount_inr);

    let result: Record<string, any> = {};

    // ── Fulfil by purpose ────────────────────────────────────────────────────
    if (purpose === PURPOSES.WALLET_TOPUP) {
      result = await fulfilWalletTopup(userId, amountINR, razorpayPaymentId, req);
    } else if (purpose === PURPOSES.GOLD_MEMBERSHIP) {
      result = await fulfilGoldMembership(userId, amountINR, razorpayPaymentId, req);
    } else if (purpose === PURPOSES.WHEEL_SPIN) {
      result = await fulfilWheelSpin(userId, amountINR, razorpayPaymentId, req);
    }

    res.json({ success: true, purpose, ...result });
  } catch (err) {
    req.log?.error({ err }, "Verify payment error");
    res.status(500).json({ error: "Payment verification failed" });
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

      // Look up our order
      const orderRows = toRows(await db.execute(sql.raw(`
        SELECT * FROM razorpay_orders WHERE razorpay_order_id = '${orderId}' AND status != 'paid' LIMIT 1
      `)));
      if (!orderRows.length) { res.json({ ok: true }); return; }
      const order = orderRows[0];
      const userId = order.user_id;
      const purpose = order.purpose as RazorpayPurpose;
      const amountINR = Number(order.amount_inr);

      await db.execute(sql.raw(`
        UPDATE razorpay_orders SET status = 'paid', razorpay_payment_id = '${paymentId}', paid_at = NOW()
        WHERE razorpay_order_id = '${orderId}'
      `));

      const fakeReq = { log: { error: console.error } } as any;
      if (purpose === PURPOSES.WALLET_TOPUP) {
        await fulfilWalletTopup(userId, amountINR, paymentId, fakeReq);
      } else if (purpose === PURPOSES.GOLD_MEMBERSHIP) {
        await fulfilGoldMembership(userId, amountINR, paymentId, fakeReq);
      } else if (purpose === PURPOSES.WHEEL_SPIN) {
        await fulfilWheelSpin(userId, amountINR, paymentId, fakeReq);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// ── Fulfilment helpers ───────────────────────────────────────────────────────

async function fulfilWalletTopup(userId: string, amountINR: number, paymentId: string, req: any) {
  // Idempotency: check if this paymentId was already processed
  const existing = toRows(await db.execute(sql.raw(`
    SELECT id FROM wallet_transactions WHERE reference_id = '${paymentId}' AND user_id = '${userId}' LIMIT 1
  `)));
  if (existing.length) return { alreadyFulfilled: true, paymentId };

  const updated = toRows(await db.execute(sql.raw(`
    UPDATE users SET wallet_balance = wallet_balance + ${amountINR}
    WHERE id = '${userId}' RETURNING wallet_balance
  `)));
  const newBalance = Number(updated[0]?.wallet_balance || 0);

  const txId = newId();
  await db.execute(sql.raw(`
    INSERT INTO wallet_transactions
      (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
    VALUES ('${txId}', '${userId}', 'topup', ${amountINR}, ${newBalance},
      '${paymentId}', 'razorpay',
      'Wallet top-up via Razorpay (${paymentId})', 'completed')
  `));

  return { newBalance, transactionId: txId, paymentId };
}

async function fulfilGoldMembership(userId: string, amountINR: number, paymentId: string, req: any) {
  // Idempotency
  const existing = toRows(await db.execute(sql.raw(`
    SELECT id FROM wallet_transactions WHERE reference_id = '${paymentId}' AND user_id = '${userId}' LIMIT 1
  `)));
  if (existing.length) return { alreadyFulfilled: true };

  const activatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();

  const userRows = toRows(await db.execute(sql.raw(`SELECT is_gold_member FROM users WHERE id = '${userId}' LIMIT 1`)));
  const wasGold = Boolean(userRows[0]?.is_gold_member);

  await db.execute(sql.raw(`
    UPDATE users
    SET is_gold_member = TRUE,
        gold_activated_at = '${activatedAt}',
        gold_expires_at = '${expiresAt}',
        gold_purchase_amount = ${amountINR}
    WHERE id = '${userId}'
  `));

  // Log payment as wallet transaction for record-keeping
  const txId = newId();
  const balRows = toRows(await db.execute(sql.raw(`SELECT wallet_balance FROM users WHERE id = '${userId}' LIMIT 1`)));
  const bal = Number(balRows[0]?.wallet_balance || 0);
  await db.execute(sql.raw(`
    INSERT INTO wallet_transactions
      (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
    VALUES ('${txId}', '${userId}', 'gold_membership', ${amountINR}, ${bal},
      '${paymentId}', 'razorpay',
      '${wasGold ? "Gold Membership renewal" : "Gold Membership activation"} via Razorpay', 'completed')
  `));

  return { isGoldMember: true, expiresAt, paymentId, renewed: wasGold };
}

async function fulfilWheelSpin(userId: string, amountINR: number, paymentId: string, req: any) {
  // Idempotency
  const existing = toRows(await db.execute(sql.raw(`
    SELECT id FROM wallet_transactions WHERE reference_id = '${paymentId}' AND user_id = '${userId}' LIMIT 1
  `)));
  if (existing.length) return { alreadyFulfilled: true };

  const updated = toRows(await db.execute(sql.raw(`
    UPDATE users
    SET paid_spin_balance = COALESCE(paid_spin_balance, 0) + 1
    WHERE id = '${userId}'
    RETURNING paid_spin_balance, wallet_balance
  `)));
  const paidSpinBalance = Number(updated[0]?.paid_spin_balance || 1);
  const bal = Number(updated[0]?.wallet_balance || 0);

  const txId = newId();
  await db.execute(sql.raw(`
    INSERT INTO wallet_transactions
      (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
    VALUES ('${txId}', '${userId}', 'paid_spin', ${amountINR}, ${bal},
      '${paymentId}', 'razorpay',
      'Wheel of Fortune spin via Razorpay', 'completed')
  `));

  // Credit platform/admin spin revenue
  const admins = toRows(await db.execute(sql.raw(`SELECT id FROM users WHERE is_admin = TRUE LIMIT 1`)));
  if (admins.length) {
    const aid = admins[0].id;
    const atx = newId();
    await db.execute(sql.raw(`UPDATE users SET wallet_balance = wallet_balance + ${amountINR} WHERE id = '${aid}'`));
    await db.execute(sql.raw(`
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
