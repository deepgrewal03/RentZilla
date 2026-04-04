import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router: IRouter = Router();
type AR = Request & { userId: string };

function toRows(res: any): any[] {
  return Array.isArray(res) ? res : (res?.rows ?? []);
}

function newId(): string {
  return `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

// ── GET /wallet — customer wallet balance + transactions ───────────────────
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const users = toRows(await db.execute(sql.raw(`SELECT wallet_balance, upi_id FROM users WHERE id = '${userId}' LIMIT 1`)));
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }

    const txRows = toRows(await db.execute(sql.raw(`
      SELECT * FROM wallet_transactions WHERE user_id = '${userId}'
      ORDER BY created_at DESC LIMIT 50
    `)));

    res.json({
      balance: Number(users[0].wallet_balance || 0),
      upiId: users[0].upi_id || null,
      transactions: txRows.map(t => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        balanceAfter: Number(t.balance_after || 0),
        referenceId: t.reference_id,
        referenceType: t.reference_type,
        description: t.description,
        status: t.status,
        createdAt: t.created_at,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Wallet fetch error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /wallet/topup — add funds to customer wallet (mock UPI/card) ─────
router.post("/topup", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { amount, method = "upi", upiRef } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || amt > 100000) {
      res.status(400).json({ error: "Invalid amount (₹1 – ₹1,00,000)" });
      return;
    }

    // Credit wallet + get new balance atomically
    const updated = toRows(await db.execute(sql.raw(`
      UPDATE users SET wallet_balance = wallet_balance + ${amt} WHERE id = '${userId}'
      RETURNING wallet_balance
    `)));
    const newBalance = Number(updated[0]?.wallet_balance || 0);

    // Record transaction
    const txId = newId();
    await db.execute(sql.raw(`
      INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, reference_id, description, status)
      VALUES ('${txId}', '${userId}', 'topup', ${amt}, ${newBalance},
        '${upiRef || txId}',
        'Wallet top-up via ${method.toUpperCase()}',
        'completed')
    `));

    res.json({ balance: newBalance, transactionId: txId, message: "Wallet topped up successfully" });
  } catch (err) {
    req.log.error({ err }, "Wallet topup error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /wallet/transactions — paginated transaction history ───────────────
router.get("/transactions", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const page = parseInt(String(req.query.page || "1"));
    const limit = 20;
    const offset = (page - 1) * limit;

    const txRows = toRows(await db.execute(sql.raw(`
      SELECT * FROM wallet_transactions WHERE user_id = '${userId}'
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `)));
    const countRows = toRows(await db.execute(sql.raw(`
      SELECT COUNT(*) as total FROM wallet_transactions WHERE user_id = '${userId}'
    `)));

    res.json({
      transactions: txRows.map(t => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        balanceAfter: Number(t.balance_after || 0),
        referenceId: t.reference_id,
        referenceType: t.reference_type,
        description: t.description,
        status: t.status,
        createdAt: t.created_at,
      })),
      total: Number(countRows[0]?.total || 0),
      page,
      pages: Math.ceil(Number(countRows[0]?.total || 0) / limit),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /wallet/provider — provider wallet + earnings ─────────────────────
router.get("/provider", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const users = toRows(await db.execute(sql.raw(`
      SELECT wallet_balance, payout_preference, upi_id FROM users WHERE id = '${userId}' LIMIT 1
    `)));
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [txRows, payoutRows, monthEarnings, totalEarnings, pendingPayouts] = await Promise.all([
      db.execute(sql.raw(`
        SELECT * FROM wallet_transactions WHERE user_id = '${userId}'
        ORDER BY created_at DESC LIMIT 30
      `)),
      db.execute(sql.raw(`
        SELECT * FROM payouts WHERE provider_id = '${userId}'
        ORDER BY created_at DESC LIMIT 20
      `)),
      db.execute(sql.raw(`
        SELECT COALESCE(SUM(provider_earning), 0) as total FROM bookings
        WHERE provider_id = '${userId}' AND status = 'completed' AND created_at >= '${monthStart}'
      `)),
      db.execute(sql.raw(`
        SELECT COALESCE(SUM(provider_earning), 0) as total FROM bookings
        WHERE provider_id = '${userId}' AND status = 'completed'
      `)),
      db.execute(sql.raw(`
        SELECT COALESCE(SUM(amount), 0) as total FROM payouts
        WHERE provider_id = '${userId}' AND status = 'pending'
      `)),
    ]);

    res.json({
      balance: Number(users[0].wallet_balance || 0),
      payoutPreference: users[0].payout_preference || "wallet",
      upiId: users[0].upi_id || null,
      monthEarnings: Number(toRows(monthEarnings)[0]?.total || 0),
      totalEarnings: Number(toRows(totalEarnings)[0]?.total || 0),
      pendingPayouts: Number(toRows(pendingPayouts)[0]?.total || 0),
      transactions: toRows(txRows).map(t => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        balanceAfter: Number(t.balance_after || 0),
        description: t.description,
        referenceId: t.reference_id,
        status: t.status,
        createdAt: t.created_at,
      })),
      payouts: toRows(payoutRows).map(p => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        upiId: p.upi_id,
        status: p.status,
        scheduledAt: p.scheduled_at,
        processedAt: p.processed_at,
        notes: p.notes,
        createdAt: p.created_at,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Provider wallet error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /wallet/provider/payout/instant — request instant payout ──────────
router.post("/provider/payout/instant", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { amount, upiId } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }
    if (!upiId?.trim()) { res.status(400).json({ error: "UPI ID is required for instant payout" }); return; }

    const users = toRows(await db.execute(sql.raw(`
      SELECT wallet_balance FROM users WHERE id = '${userId}' LIMIT 1
    `)));
    const balance = Number(users[0]?.wallet_balance || 0);
    if (amt > balance) { res.status(400).json({ error: `Insufficient balance. Available: ₹${balance.toFixed(2)}` }); return; }

    // Deduct from wallet
    const updated = toRows(await db.execute(sql.raw(`
      UPDATE users SET wallet_balance = wallet_balance - ${amt}, upi_id = '${upiId.trim()}'
      WHERE id = '${userId}' AND wallet_balance >= ${amt}
      RETURNING wallet_balance
    `)));
    if (!updated.length) { res.status(400).json({ error: "Insufficient balance or concurrent update" }); return; }

    const newBalance = Number(updated[0].wallet_balance);
    const payoutId = newId();
    const txId = newId();

    await db.execute(sql.raw(`
      INSERT INTO payouts (id, provider_id, amount, method, upi_id, status, processed_at, notes)
      VALUES ('${payoutId}', '${userId}', ${amt}, 'instant', '${upiId.trim()}', 'processing',
        NOW(), 'Instant payout to UPI ${upiId.trim()}')
    `));

    await db.execute(sql.raw(`
      INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
      VALUES ('${txId}', '${userId}', 'payout', ${amt}, ${newBalance}, '${payoutId}', 'payout',
        'Instant payout to UPI: ${upiId.trim()}', 'completed')
    `));

    res.json({
      payoutId,
      amount: amt,
      newBalance,
      upiId: upiId.trim(),
      status: "processing",
      message: `₹${amt.toFixed(2)} payout to ${upiId.trim()} initiated. Typically arrives within 30 minutes.`,
    });
  } catch (err) {
    req.log.error({ err }, "Instant payout error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /wallet/provider/payout/schedule — set payout preference ──────────
router.post("/provider/payout/schedule", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { preference, upiId } = req.body;
    if (!["instant", "weekly", "wallet"].includes(preference)) {
      res.status(400).json({ error: "Invalid preference. Use: instant, weekly, or wallet" });
      return;
    }

    const sets = [`payout_preference = '${preference}'`];
    if (upiId?.trim()) sets.push(`upi_id = '${upiId.trim()}'`);
    await db.execute(sql.raw(`UPDATE users SET ${sets.join(", ")} WHERE id = '${userId}'`));

    res.json({ preference, message: `Payout preference set to: ${preference}` });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /wallet/admin/summary — admin commission overview ──────────────────
router.get("/admin/summary", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const adminCheck = toRows(await db.execute(sql.raw(`SELECT is_admin FROM users WHERE id = '${userId}' LIMIT 1`)));
    if (!adminCheck[0]?.is_admin) { res.status(403).json({ error: "Admin only" }); return; }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [totalCommission, monthCommission, totalPayouts, pendingPayouts, topProviders] = await Promise.all([
      db.execute(sql.raw(`SELECT COALESCE(SUM(commission_amount), 0) as total FROM bookings WHERE status = 'completed'`)),
      db.execute(sql.raw(`SELECT COALESCE(SUM(commission_amount), 0) as total FROM bookings WHERE status = 'completed' AND created_at >= '${monthStart}'`)),
      db.execute(sql.raw(`SELECT COALESCE(SUM(amount), 0) as total FROM payouts WHERE status IN ('completed', 'processing')`)),
      db.execute(sql.raw(`SELECT COALESCE(SUM(amount), 0) as total FROM payouts WHERE status = 'pending'`)),
      db.execute(sql.raw(`
        SELECT u.name, u.email, COALESCE(SUM(b.provider_earning), 0) as earnings,
               COALESCE(SUM(b.commission_amount), 0) as commission_paid,
               COUNT(b.id) as completed_jobs
        FROM users u JOIN bookings b ON b.provider_id = u.id
        WHERE b.status = 'completed'
        GROUP BY u.id, u.name, u.email
        ORDER BY earnings DESC LIMIT 10
      `)),
    ]);

    res.json({
      totalCommission: Number(toRows(totalCommission)[0]?.total || 0),
      monthCommission: Number(toRows(monthCommission)[0]?.total || 0),
      totalPayouts: Number(toRows(totalPayouts)[0]?.total || 0),
      pendingPayouts: Number(toRows(pendingPayouts)[0]?.total || 0),
      topProviders: toRows(topProviders).map(p => ({
        name: p.name,
        email: p.email,
        earnings: Number(p.earnings),
        commissionPaid: Number(p.commission_paid),
        completedJobs: Number(p.completed_jobs),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Admin wallet summary error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
