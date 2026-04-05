import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router = Router();
const REFERRAL_THRESHOLD = 5;
const REFERRAL_REWARD_PCT = 10;

function toRows(r: any): any[] {
  return Array.isArray(r) ? r : (r?.rows ?? []);
}
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function generateReferralCode(name: string): string {
  const prefix = (name || "USER").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4).padEnd(4, "R");
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}${suffix}`;
}

// ── Ensure user has a referral code ───────────────────────────────────────────
async function ensureReferralCode(userId: string, name: string): Promise<string> {
  const rows = toRows(await db.execute(sql`SELECT referral_code FROM users WHERE id = ${userId} LIMIT 1`));
  if (rows[0]?.referral_code) return rows[0].referral_code;

  let code = generateReferralCode(name);
  let attempts = 0;
  while (attempts < 10) {
    const existing = toRows(await db.execute(sql`SELECT id FROM users WHERE referral_code = ${code} LIMIT 1`));
    if (!existing.length) break;
    code = generateReferralCode(name);
    attempts++;
  }
  await db.execute(sql`UPDATE users SET referral_code = ${code} WHERE id = ${userId}`);
  return code;
}

// ── GET /referral/status ───────────────────────────────────────────────────────
router.get("/status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const userRows = toRows(await db.execute(sql`
      SELECT name, role, referral_code, referred_by, referral_progress, pending_referral_reward, total_referral_rewards
      FROM users WHERE id = ${userId} LIMIT 1
    `));
    if (!userRows.length) { res.status(404).json({ error: "User not found" }); return; }
    const user = userRows[0];

    const code = await ensureReferralCode(userId, user.name || "");

    const referrals = toRows(await db.execute(sql`
      SELECT r.*, u.name as referred_name, u.email as referred_email, u.role as referred_role
      FROM referrals r
      LEFT JOIN users u ON u.id = r.referred_user_id
      WHERE r.referrer_id = ${userId}
      ORDER BY r.created_at DESC
    `));

    const completed = referrals.filter((r: any) => r.first_completion_done).length;
    const total = referrals.length;
    const progress = Number(user.referral_progress || 0);
    const progressInCycle = progress % REFERRAL_THRESHOLD;
    const pendingReward = Boolean(user.pending_referral_reward);
    const totalRewards = Number(user.total_referral_rewards || 0);

    const pendingRewardRows = toRows(await db.execute(sql`
      SELECT * FROM referral_rewards
      WHERE user_id = ${userId} AND status = 'pending'
      ORDER BY unlocked_at DESC LIMIT 1
    `));

    res.json({
      referralCode: code,
      referredBy: user.referred_by ?? null,
      totalReferred: total,
      totalCompleted: completed,
      progressInCycle,
      threshold: REFERRAL_THRESHOLD,
      rewardPercent: REFERRAL_REWARD_PCT,
      pendingReward,
      pendingRewardDetails: pendingRewardRows[0] ?? null,
      totalRewards,
      referrals: referrals.map((r: any) => ({
        id: r.id,
        name: r.referred_name || "Unknown",
        email: r.referred_email || "",
        role: r.referred_role || "",
        firstCompletionDone: Boolean(r.first_completion_done),
        createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /referral/apply ───────────────────────────────────────────────────────
router.post("/apply", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { code } = req.body;
    if (!code || typeof code !== "string") {
      res.status(400).json({ error: "Referral code is required" }); return;
    }
    const upperCode = code.trim().toUpperCase();

    const meRows = toRows(await db.execute(sql`SELECT referred_by, name FROM users WHERE id = ${userId} LIMIT 1`));
    if (!meRows.length) { res.status(404).json({ error: "User not found" }); return; }
    if (meRows[0].referred_by) {
      res.status(400).json({ error: "You have already applied a referral code." }); return;
    }

    const referrerRows = toRows(await db.execute(sql`
      SELECT id, name FROM users WHERE referral_code = ${upperCode} LIMIT 1
    `));
    if (!referrerRows.length) {
      res.status(404).json({ error: "Invalid referral code. Please check and try again." }); return;
    }
    const referrer = referrerRows[0];

    if (referrer.id === userId) {
      res.status(400).json({ error: "You cannot use your own referral code." }); return;
    }

    const existing = toRows(await db.execute(sql`
      SELECT id FROM referrals WHERE referrer_id = ${referrer.id} AND referred_user_id = ${userId} LIMIT 1
    `));
    if (existing.length) {
      res.status(400).json({ error: "This referral has already been recorded." }); return;
    }

    await db.execute(sql`UPDATE users SET referred_by = ${upperCode} WHERE id = ${userId}`);

    const refId = genId();
    await db.execute(sql.raw(`
      INSERT INTO referrals (id, referrer_id, referred_user_id, referral_code)
      VALUES ('${refId}', '${referrer.id}', '${userId}', '${upperCode}')
    `));

    const notifId = genId();
    await db.execute(sql.raw(`
      INSERT INTO notifications (id, user_id, title, message)
      VALUES ('${notifId}', '${referrer.id}',
        '🎁 New Referral!',
        '${(meRows[0].name || "Someone").replace(/'/g, "''")} signed up using your referral code. Complete their first booking to count towards your reward!')
    `));

    res.json({ success: true, message: `Referral code applied! You were referred by ${referrer.name || "a friend"}.` });
  } catch (err: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /referral/history ──────────────────────────────────────────────────────
router.get("/history", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const rewards = toRows(await db.execute(sql`
      SELECT * FROM referral_rewards WHERE user_id = ${userId} ORDER BY unlocked_at DESC LIMIT 50
    `));
    const referrals = toRows(await db.execute(sql`
      SELECT r.*, u.name as referred_name FROM referrals r
      LEFT JOIN users u ON u.id = r.referred_user_id
      WHERE r.referrer_id = ${userId} ORDER BY r.created_at DESC LIMIT 50
    `));
    res.json({ rewards, referrals });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /referral/admin/stats ──────────────────────────────────────────────────
router.get("/admin/stats", authMiddleware, async (req: Request, res: Response) => {
  try {
    const adminCheck = toRows(await db.execute(sql`SELECT is_admin FROM users WHERE id = ${(req as any).userId} LIMIT 1`));
    if (!adminCheck[0]?.is_admin) { res.status(403).json({ error: "Forbidden" }); return; }

    const [totalReferrals, totalCompleted, totalRewards, topReferrers] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as count FROM referrals`),
      db.execute(sql`SELECT COUNT(*) as count FROM referrals WHERE first_completion_done = TRUE`),
      db.execute(sql`SELECT COUNT(*) as count FROM referral_rewards`),
      db.execute(sql`
        SELECT u.name, u.email, COUNT(r.id) as referral_count, COUNT(CASE WHEN r.first_completion_done THEN 1 END) as completed_count
        FROM referrals r JOIN users u ON u.id = r.referrer_id
        GROUP BY u.id, u.name, u.email
        ORDER BY completed_count DESC LIMIT 10
      `),
    ]);

    res.json({
      totalReferrals: Number(toRows(totalReferrals)[0]?.count || 0),
      totalCompleted: Number(toRows(totalCompleted)[0]?.count || 0),
      totalRewards: Number(toRows(totalRewards)[0]?.count || 0),
      topReferrers: toRows(topReferrers),
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export { ensureReferralCode };
export default router;
