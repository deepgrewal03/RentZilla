import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createHmac } from "crypto";
import { db } from "@workspace/db";
import { usersTable, reviewsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { TOKEN_SECRET } from "./auth.js";

const router: IRouter = Router();

function getUserIdFromToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.replace("Bearer ", "");
  try {
    const dotIdx = token.lastIndexOf(".");
    if (dotIdx === -1) {
      const decoded = Buffer.from(token, "base64").toString("utf8");
      const userId = decoded.split(":")[0];
      return userId || null;
    }
    const payload = token.slice(0, dotIdx);
    const providedSig = token.slice(dotIdx + 1);
    const expectedSig = createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex").slice(0, 16);
    if (providedSig !== expectedSig) return null;
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    const userId = decoded.split(":")[0];
    return userId || null;
  } catch {
    return null;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const userId = getUserIdFromToken(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as Request & { userId: string }).userId = userId;
  next();
}

async function getUserRating(userId: string): Promise<{ rating: number | null; reviewCount: number }> {
  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.providerId, userId));
  if (reviews.length === 0) return { rating: null, reviewCount: 0 };
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  return { rating: Math.round(avg * 10) / 10, reviewCount: reviews.length };
}

// /profile alias → same as /me (mobile uses /users/profile)
router.get("/profile", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (users.length === 0) { res.status(404).json({ error: "User not found" }); return; }
    const user = users[0];
    const { rating, reviewCount } = await getUserRating(userId);
    // Fetch referral fields directly (not all are in Drizzle schema types)
    const refRow = await db.execute(sql`SELECT referral_code, referred_by, referral_progress, total_referral_rewards FROM users WHERE id = ${userId} LIMIT 1`);
    const refData = (refRow as any)?.rows?.[0] ?? {};
    res.json({
      id: user.id, phone: user.phone, email: user.email,
      firstName: user.firstName, lastName: user.lastName,
      name: user.name, role: user.role,
      roles: user.role === "both" ? ["customer", "provider"] : [user.role],
      location: user.location, profileImage: user.profileImage,
      rating, reviewCount, createdAt: user.createdAt.toISOString(),
      referral_code: refData.referral_code ?? null,
      referralCode: refData.referral_code ?? null,
      referredBy: refData.referred_by ?? null,
      referralProgress: refData.referral_progress ?? 0,
      totalReferralRewards: refData.total_referral_rewards ?? 0,
      isAdmin: !!(user as any).is_admin ?? false,
    });
  } catch (err) {
    req.log.error({ err }, "Get user profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /profile — alias for /me PATCH
router.patch("/profile", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { name, location, profileImage, email, firstName, lastName } = req.body;
    const updated = await db.update(usersTable)
      .set({ name, location, profileImage, ...(email ? { email } : {}), ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}) })
      .where(eq(usersTable.id, userId))
      .returning();
    if (updated.length === 0) { res.status(404).json({ error: "User not found" }); return; }
    const user = updated[0];
    res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, location: user.location, profileImage: user.profileImage } });
  } catch (err) {
    req.log.error({ err }, "Update user profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (users.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = users[0];
    const { rating, reviewCount } = await getUserRating(userId);
    const refRow2 = await db.execute(sql`SELECT referral_code, referred_by, referral_progress, total_referral_rewards FROM users WHERE id = ${userId} LIMIT 1`);
    const refData2 = (refRow2 as any)?.rows?.[0] ?? {};
    res.json({
      id: user.id,
      phone: user.phone,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      role: user.role,
      roles: user.role === "both" ? ["customer", "provider"] : [user.role],
      location: user.location,
      profileImage: user.profileImage,
      rating,
      reviewCount,
      createdAt: user.createdAt.toISOString(),
      referral_code: refData2.referral_code ?? null,
      referralCode: refData2.referral_code ?? null,
      referredBy: refData2.referred_by ?? null,
      referralProgress: refData2.referral_progress ?? 0,
      totalReferralRewards: refData2.total_referral_rewards ?? 0,
      isAdmin: !!(user as any).is_admin ?? false,
    });
  } catch (err) {
    req.log.error({ err }, "Get user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { name, location, profileImage } = req.body;

    const updated = await db
      .update(usersTable)
      .set({ name, location, profileImage })
      .where(eq(usersTable.id, userId))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const user = updated[0];
    const { rating, reviewCount } = await getUserRating(userId);
    res.json({
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      location: user.location,
      profileImage: user.profileImage,
      rating,
      reviewCount,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Update user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /users/me — permanently delete account + all data ─────────────────
router.delete("/me", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    // Soft-log the deletion reason before wiping
    const reason: string = (req.body?.reason as string) || "No reason given";
    await db.execute(sql.raw(`
      INSERT INTO notifications (id, user_id, title, message)
      VALUES ('del_${Date.now()}', 'system', 'Account Deleted',
        'User ${userId} deleted their account. Reason: ${reason.replace(/'/g, "''")}')
      ON CONFLICT DO NOTHING
    `));
  } catch { /* non-critical */ }

  const tables: [string, string][] = [
    ["wallet_transactions", "user_id"],
    ["notifications",       "user_id"],
    ["promo_vault",         "user_id"],
    ["wheel_spins",         "user_id"],
    ["referral_rewards",    "user_id"],
    ["favorites",           "user_id"],
    ["chats",               "user_id"],
  ];

  for (const [table, col] of tables) {
    try {
      await db.execute(sql.raw(`DELETE FROM ${table} WHERE ${col} = '${userId}'`));
    } catch { /* table may not exist – skip */ }
  }

  // referrals — two columns
  try {
    await db.execute(sql.raw(`DELETE FROM referrals WHERE referrer_id = '${userId}' OR referred_user_id = '${userId}'`));
  } catch { /* skip */ }

  // reviews — two columns
  try {
    await db.execute(sql.raw(`DELETE FROM reviews WHERE reviewer_id = '${userId}' OR reviewee_id = '${userId}'`));
  } catch { /* skip */ }

  // messages / chat_messages — sender or receiver
  for (const t of ["messages", "chat_messages"]) {
    try {
      await db.execute(sql.raw(`DELETE FROM ${t} WHERE sender_id = '${userId}' OR receiver_id = '${userId}'`));
    } catch { /* skip */ }
  }

  // bookings — anonymise rather than hard-delete to preserve provider history
  try {
    await db.execute(sql.raw(`
      UPDATE bookings SET customer_id = 'deleted_user', customer_name = 'Deleted User'
      WHERE customer_id = '${userId}'
    `));
  } catch { /* skip */ }

  // listings — delete provider's listings
  try {
    await db.execute(sql.raw(`DELETE FROM listings WHERE provider_id = '${userId}'`));
  } catch { /* skip */ }

  // finally delete the user
  await db.execute(sql.raw(`DELETE FROM users WHERE id = '${userId}'`));

  res.json({ success: true, message: "Account and all associated data deleted." });
});

export default router;
