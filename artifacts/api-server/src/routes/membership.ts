import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router = Router();

const GOLD_PRICE = 2.49;
const GOLD_DISCOUNT_PCT = 4;

function toRows(r: any): any[] {
  return Array.isArray(r) ? r : (r?.rows ?? []);
}
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── GET /membership/status ────────────────────────────────────────────────────
router.get("/status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const rows = toRows(await db.execute(sql`
      SELECT is_gold_member, gold_activated_at, gold_purchase_tx_id, total_membership_savings
      FROM users WHERE id = ${userId} LIMIT 1
    `));
    if (!rows.length) { res.status(404).json({ error: "User not found" }); return; }
    const u = rows[0];
    res.json({
      isGoldMember: Boolean(u.is_gold_member),
      activatedAt: u.gold_activated_at ?? null,
      purchaseTxId: u.gold_purchase_tx_id ?? null,
      totalSaved: Number(u.total_membership_savings || 0),
      purchaseAmount: GOLD_PRICE,
      discountPercent: GOLD_DISCOUNT_PCT,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /membership/purchase ─────────────────────────────────────────────────
router.post("/purchase", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Fetch user status + wallet
    const rows = toRows(await db.execute(sql`
      SELECT is_gold_member, wallet_balance, name, email FROM users WHERE id = ${userId} LIMIT 1
    `));
    if (!rows.length) { res.status(404).json({ error: "User not found" }); return; }
    const user = rows[0];

    if (user.is_gold_member) {
      res.status(400).json({ error: "You are already a Gold Member!" }); return;
    }

    const balance = Number(user.wallet_balance || 0);
    if (balance < GOLD_PRICE) {
      res.status(400).json({
        error: `Insufficient wallet balance. You need ₹${GOLD_PRICE}. Current balance: ₹${balance.toFixed(2)}`,
        code: "INSUFFICIENT_BALANCE",
        required: GOLD_PRICE,
        available: balance,
      });
      return;
    }

    const txId = generateId();
    const purchaseId = generateId();
    const notifId = generateId();
    const adminNotifId = generateId();

    // ── Atomic: deduct from customer wallet ───────────────────────────────────
    const updated = toRows(await db.execute(sql.raw(`
      UPDATE users SET wallet_balance = wallet_balance - ${GOLD_PRICE}
      WHERE id = '${userId}' AND wallet_balance >= ${GOLD_PRICE}
      RETURNING wallet_balance
    `)));
    if (!updated.length) {
      res.status(400).json({ error: "Insufficient balance or concurrent update" }); return;
    }
    const newBalance = Number(updated[0].wallet_balance);

    // ── Activate Gold on user ─────────────────────────────────────────────────
    await db.execute(sql.raw(`
      UPDATE users SET
        is_gold_member = TRUE,
        gold_activated_at = NOW(),
        gold_purchase_tx_id = '${txId}'
      WHERE id = '${userId}'
    `));

    // ── Record wallet debit transaction ───────────────────────────────────────
    await db.execute(sql.raw(`
      INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
      VALUES ('${txId}', '${userId}', 'gold_membership', ${GOLD_PRICE}, ${newBalance}, '${purchaseId}', 'gold_purchase', 'Gold Lifetime Membership', 'completed')
    `));

    // ── Record gold purchase ──────────────────────────────────────────────────
    await db.execute(sql.raw(`
      INSERT INTO gold_purchases (id, user_id, amount, status, tx_id)
      VALUES ('${purchaseId}', '${userId}', ${GOLD_PRICE}, 'completed', '${txId}')
    `));

    // ── Customer notification ──────────────────────────────────────────────────
    await db.execute(sql.raw(`
      INSERT INTO notifications (id, user_id, title, message)
      VALUES ('${notifId}', '${userId}',
        '🏆 Gold Membership Activated!',
        'Welcome to the Gold family! You now get 4% off on every booking forever.')
    `));

    // ── Admin notification ─────────────────────────────────────────────────────
    const adminRows = toRows(await db.execute(sql`
      SELECT id FROM users WHERE is_admin = TRUE LIMIT 5
    `));
    for (const admin of adminRows) {
      const aid = generateId();
      await db.execute(sql.raw(`
        INSERT INTO notifications (id, user_id, title, message)
        VALUES ('${aid}', '${admin.id}',
          '💰 New Gold Member',
          '${(user.name || "A customer").replace(/'/g, "''")} just purchased Gold Membership (₹${GOLD_PRICE})')
      `));
    }

    res.json({
      success: true,
      message: "🏆 Gold Membership activated! You now get 4% off every booking.",
      newWalletBalance: newBalance,
      purchaseId,
      txId,
      activatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Gold purchase error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
