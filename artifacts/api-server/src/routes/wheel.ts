import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router = Router();
type AR = Request & { userId: string };

function toRows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function newId(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

const PAID_SPIN_PRICE = 0.99;
const SEGMENTS = [
  { index: 0, label: "5% OFF",               discountValue: 5,  type: "discount" },
  { index: 1, label: "10% OFF",              discountValue: 10, type: "discount" },
  { index: 2, label: "15% OFF",              discountValue: 15, type: "discount" },
  { index: 3, label: "20% OFF",              discountValue: 20, type: "discount" },
  { index: 4, label: "25% OFF",              discountValue: 25, type: "discount" },
  { index: 5, label: "30% OFF",              discountValue: 30, type: "discount" },
  { index: 6, label: "Better Luck Next Time", discountValue: 0,  type: "none"     },
];

function generateReward(isGold: boolean): typeof SEGMENTS[0] {
  const probs = isGold ? [22, 20, 16, 13, 9, 6, 14] : [20, 18, 15, 12, 8, 5, 22];
  const rand = Math.random() * 100;
  let cum = 0;
  for (let i = 0; i < probs.length; i++) { cum += probs[i]; if (rand < cum) return SEGMENTS[i]; }
  return SEGMENTS[6];
}

// GET /wheel/status
router.get("/status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const rows = toRows(await db.execute(sql.raw(`
      SELECT free_spin_last_used, paid_spin_balance, is_gold_member FROM users WHERE id = '${userId}' LIMIT 1
    `)));
    if (!rows.length) { res.status(404).json({ error: "User not found" }); return; }
    const u = rows[0];
    const lastUsed = u.free_spin_last_used ? new Date(u.free_spin_last_used) : null;
    const hoursElapsed = lastUsed ? (Date.now() - lastUsed.getTime()) / 3600000 : 999;
    const canFreeSpin = hoursElapsed >= 24;
    res.json({
      canFreeSpin,
      nextFreeSpinAt: (!canFreeSpin && lastUsed) ? new Date(lastUsed.getTime() + 24 * 3600000).toISOString() : null,
      hoursUntilFree: canFreeSpin ? 0 : Math.ceil(24 - hoursElapsed),
      paidSpinBalance: Number(u.paid_spin_balance || 0),
      paidSpinPrice: PAID_SPIN_PRICE,
      isGoldMember: Boolean(u.is_gold_member),
    });
  } catch (err) {
    console.error("Wheel status error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /wheel/free-spin
router.post("/free-spin", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const rows = toRows(await db.execute(sql.raw(`
      SELECT free_spin_last_used, is_gold_member FROM users WHERE id = '${userId}' LIMIT 1
    `)));
    if (!rows.length) { res.status(404).json({ error: "User not found" }); return; }
    const u = rows[0];
    const lastUsed = u.free_spin_last_used ? new Date(u.free_spin_last_used) : null;
    const hoursElapsed = lastUsed ? (Date.now() - lastUsed.getTime()) / 3600000 : 999;
    if (hoursElapsed < 24) {
      const nextAt = new Date(lastUsed!.getTime() + 24 * 3600000);
      res.status(400).json({
        error: "Free spin not yet available",
        code: "SPIN_NOT_READY",
        nextFreeSpinAt: nextAt.toISOString(),
        hoursUntilFree: Math.ceil(24 - hoursElapsed),
      });
      return;
    }
    await db.execute(sql.raw(`UPDATE users SET free_spin_last_used = NOW() WHERE id = '${userId}'`));
    const segment = generateReward(Boolean(u.is_gold_member));
    const spinId = newId();
    await db.execute(sql.raw(`
      INSERT INTO wheel_spins (id, user_id, spin_type, reward_label, discount_value, payment_amount, segment_index)
      VALUES ('${spinId}', '${userId}', 'free', '${segment.label.replace(/'/g, "''")}', ${segment.discountValue}, 0, ${segment.index})
    `));
    let promoId: string | null = null;
    if (segment.type === "discount") {
      promoId = newId();
      const expiry = new Date(Date.now() + 30 * 24 * 3600000).toISOString();
      await db.execute(sql.raw(`
        INSERT INTO promo_vault (id, user_id, type, discount_value, discount_type, description, expiry_date, spin_id)
        VALUES ('${promoId}', '${userId}', 'wheel', ${segment.discountValue}, 'percent',
          'Wheel of Fortune: ${segment.label.replace(/'/g, "''")}', '${expiry}', '${spinId}')
      `));
    }
    res.json({
      success: true, spinId, segmentIndex: segment.index, promoId,
      reward: { type: segment.type, label: segment.label, discountValue: segment.discountValue },
    });
  } catch (err) {
    console.error("Free spin error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /wheel/buy-spin — charge ₹0.99 from wallet, unlock a paid spin
router.post("/buy-spin", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const rows = toRows(await db.execute(sql.raw(`
      SELECT wallet_balance, name FROM users WHERE id = '${userId}' LIMIT 1
    `)));
    if (!rows.length) { res.status(404).json({ error: "User not found" }); return; }
    const balance = Number(rows[0].wallet_balance || 0);
    if (balance < PAID_SPIN_PRICE) {
      res.status(400).json({
        error: `Insufficient balance. Need ₹${PAID_SPIN_PRICE}. Available: ₹${balance.toFixed(2)}`,
        code: "INSUFFICIENT_BALANCE", required: PAID_SPIN_PRICE, available: balance,
      });
      return;
    }
    const updated = toRows(await db.execute(sql.raw(`
      UPDATE users
      SET wallet_balance = wallet_balance - ${PAID_SPIN_PRICE},
          paid_spin_balance = COALESCE(paid_spin_balance, 0) + 1
      WHERE id = '${userId}' AND wallet_balance >= ${PAID_SPIN_PRICE}
      RETURNING wallet_balance, paid_spin_balance
    `)));
    if (!updated.length) { res.status(400).json({ error: "Insufficient balance" }); return; }
    const newBal  = Number(updated[0].wallet_balance);
    const spinBal = Number(updated[0].paid_spin_balance);
    const txId = newId();
    await db.execute(sql.raw(`
      INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, description, status)
      VALUES ('${txId}', '${userId}', 'paid_spin', ${PAID_SPIN_PRICE}, ${newBal},
        'Wheel of Fortune extra spin', 'completed')
    `));
    const admins = toRows(await db.execute(sql.raw(`SELECT id FROM users WHERE is_admin = TRUE LIMIT 1`)));
    if (admins.length) {
      const aid = admins[0].id;
      const atx = newId();
      await db.execute(sql.raw(`UPDATE users SET wallet_balance = wallet_balance + ${PAID_SPIN_PRICE} WHERE id = '${aid}'`));
      await db.execute(sql.raw(`
        INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
        VALUES ('${atx}', '${aid}', 'spin_revenue', ${PAID_SPIN_PRICE},
          (SELECT wallet_balance FROM users WHERE id = '${aid}'),
          '${txId}', 'paid_spin',
          'Spin purchase from ${(rows[0].name || "Customer").replace(/'/g, "''")}', 'completed')
      `));
    }
    res.json({
      success: true, newWalletBalance: newBal, paidSpinBalance: spinBal,
      message: `Extra spin purchased! You have ${spinBal} spin${spinBal !== 1 ? "s" : ""} ready.`,
    });
  } catch (err) {
    console.error("Buy spin error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /wheel/paid-spin — consume 1 paid spin
router.post("/paid-spin", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const rows = toRows(await db.execute(sql.raw(`
      SELECT paid_spin_balance, is_gold_member FROM users WHERE id = '${userId}' LIMIT 1
    `)));
    if (!rows.length) { res.status(404).json({ error: "User not found" }); return; }
    if (Number(rows[0].paid_spin_balance || 0) < 1) {
      res.status(400).json({ error: "No paid spins available. Buy one first.", code: "NO_PAID_SPIN" });
      return;
    }
    const upd = toRows(await db.execute(sql.raw(`
      UPDATE users SET paid_spin_balance = paid_spin_balance - 1
      WHERE id = '${userId}' AND paid_spin_balance > 0
      RETURNING paid_spin_balance
    `)));
    if (!upd.length) { res.status(400).json({ error: "No paid spins" }); return; }
    const segment = generateReward(Boolean(rows[0].is_gold_member));
    const spinId = newId();
    await db.execute(sql.raw(`
      INSERT INTO wheel_spins (id, user_id, spin_type, reward_label, discount_value, payment_amount, segment_index)
      VALUES ('${spinId}', '${userId}', 'paid', '${segment.label.replace(/'/g, "''")}', ${segment.discountValue}, ${PAID_SPIN_PRICE}, ${segment.index})
    `));
    let promoId: string | null = null;
    if (segment.type === "discount") {
      promoId = newId();
      const expiry = new Date(Date.now() + 30 * 24 * 3600000).toISOString();
      await db.execute(sql.raw(`
        INSERT INTO promo_vault (id, user_id, type, discount_value, discount_type, description, expiry_date, spin_id)
        VALUES ('${promoId}', '${userId}', 'wheel', ${segment.discountValue}, 'percent',
          'Wheel of Fortune: ${segment.label.replace(/'/g, "''")}', '${expiry}', '${spinId}')
      `));
    }
    res.json({
      success: true, spinId, segmentIndex: segment.index, promoId,
      remainingPaidSpins: Number(upd[0].paid_spin_balance),
      reward: { type: segment.type, label: segment.label, discountValue: segment.discountValue },
    });
  } catch (err) {
    console.error("Paid spin error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /wheel/history
router.get("/history", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const rows = toRows(await db.execute(sql.raw(`
      SELECT * FROM wheel_spins WHERE user_id = '${userId}'
      ORDER BY created_at DESC LIMIT 50
    `)));
    res.json({
      history: rows.map(s => ({
        id: s.id, spinType: s.spin_type, rewardLabel: s.reward_label,
        discountValue: Number(s.discount_value || 0),
        paymentAmount: Number(s.payment_amount || 0),
        segmentIndex: s.segment_index, createdAt: s.created_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
