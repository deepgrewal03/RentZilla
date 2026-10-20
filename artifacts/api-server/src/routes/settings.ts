import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { userSettingsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { authMiddleware } from "./users.js";

const router: IRouter = Router();

type AuthRequest = Request & { userId: string };

async function getOrCreateSettings(userId: string) {
  const rows = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId)).limit(1);
  if (rows.length > 0) return rows[0];
  const inserted = await db.insert(userSettingsTable).values({ userId }).returning();
  return inserted[0];
}

// GET /api/settings — get user settings
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const settings = await getOrCreateSettings(userId);
    res.json({
      notificationManagement: "device",
      // Older installed apps dereference this object while rendering Settings.
      // Compatibility data only: OS permissions remain authoritative and the
      // retired PATCH endpoint must not change notification delivery.
      notifications: {
        bookingRequests: true,
        bookingConfirmations: true,
        messages: true,
        paymentUpdates: true,
        promotions: true,
        ...(settings.notifications as object ?? {}),
      },
      privacy: settings.privacy,
      preferences: settings.preferences,
    });
  } catch (err) {
    req.log.error({ err }, "Get settings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/settings/notifications
router.patch("/notifications", authMiddleware, async (req: Request, res: Response) => {
  res.status(410).json({ error: "Notifications are managed through your device settings." });
});

// PATCH /api/settings/privacy
router.patch("/privacy", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const current = await getOrCreateSettings(userId);
    const merged = { ...(current.privacy as object), ...req.body };
    await db.update(userSettingsTable)
      .set({ privacy: merged, updatedAt: new Date() })
      .where(eq(userSettingsTable.userId, userId));
    res.json({ privacy: merged });
  } catch (err) {
    req.log.error({ err }, "Update privacy error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/settings/preferences
router.patch("/preferences", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const current = await getOrCreateSettings(userId);
    const merged = { ...(current.preferences as object), ...req.body };
    await db.update(userSettingsTable)
      .set({ preferences: merged, updatedAt: new Date() })
      .where(eq(userSettingsTable.userId, userId));
    res.json({ preferences: merged });
  } catch (err) {
    req.log.error({ err }, "Update preferences error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/settings/password — change password
router.patch("/password", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "currentPassword and newPassword are required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }
    const user = users[0];
    if (!user.passwordHash) {
      res.status(400).json({ error: "No password set on this account" });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Current password is incorrect" }); return; }
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Change password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/settings/account — only names are editable; email is immutable here.
router.patch("/account", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { firstName, lastName, email } = req.body;
    const current = (await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0];
    if (!current) { res.status(404).json({ error: "User not found" }); return; }
    // Accept an unchanged email from older app versions, but never write it.
    if (email !== undefined && email !== current.email) {
      res.status(400).json({ error: "Email cannot be changed in Account Settings" }); return;
    }
    if ([firstName, lastName].some(value => value !== undefined && typeof value !== "string")) {
      res.status(400).json({ error: "Names must be text" }); return;
    }
    if (firstName === undefined && lastName === undefined) {
      res.status(400).json({ error: "Provide a name to update" }); return;
    }
    const updates: Record<string, string> = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (firstName !== undefined || lastName !== undefined) {
      const fn = firstName ?? current.firstName ?? "";
      const ln = lastName ?? current.lastName ?? "";
      updates.name = [fn, ln].filter(Boolean).join(" ");
    }
    await db.update(usersTable).set(updates as any).where(eq(usersTable.id, userId));
    const updated = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const u = updated[0];
    res.json({ firstName: u.firstName, lastName: u.lastName, email: u.email, name: u.name });
  } catch (err) {
    req.log.error({ err }, "Update account error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/settings/account — delete account
router.delete("/account", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { password } = req.body;
    if (!password) { res.status(400).json({ error: "Password required to delete account" }); return; }
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }
    const valid = await bcrypt.compare(password, users[0].passwordHash || "");
    if (!valid) { res.status(401).json({ error: "Incorrect password" }); return; }
    await db.delete(userSettingsTable).where(eq(userSettingsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete account error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
