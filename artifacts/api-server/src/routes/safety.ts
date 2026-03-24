import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  blockedUsersTable, reportsTable, emergencyContactsTable,
  issuesTable, otpCodesTable, usersTable, userSettingsTable,
} from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { authMiddleware } from "./users.js";
import { randomUUID } from "crypto";

const router: IRouter = Router();
type AR = Request & { userId: string };

// ─── OTP / 2FA ───────────────────────────────────────────────────────────────

function gen6() { return String(Math.floor(100000 + Math.random() * 900000)); }

// POST /safety/2fa/send-otp — generate OTP (simulated, returns code for demo)
router.post("/2fa/send-otp", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const code = gen6();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.delete(otpCodesTable).where(eq(otpCodesTable.userId, userId));
    await db.insert(otpCodesTable).values({ id: randomUUID(), userId, code, expiresAt });
    // In production, send via email/SMS. For demo we return the code.
    res.json({ success: true, code, message: "OTP sent (demo mode — code returned in response)" });
  } catch (err) {
    req.log.error({ err }, "Send OTP error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /safety/2fa/verify-otp — verify OTP and enable 2FA
router.post("/2fa/verify-otp", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { code, enable } = req.body;
    const rows = await db.select().from(otpCodesTable).where(eq(otpCodesTable.userId, userId)).limit(1);
    if (!rows.length) { res.status(400).json({ error: "No OTP found. Please request a new one." }); return; }
    const otp = rows[0];
    if (otp.code !== String(code)) { res.status(400).json({ error: "Incorrect OTP code" }); return; }
    if (new Date() > otp.expiresAt) { res.status(400).json({ error: "OTP expired. Please request a new one." }); return; }
    await db.delete(otpCodesTable).where(eq(otpCodesTable.userId, userId));
    // Persist 2FA preference in user_settings
    const settings = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId)).limit(1);
    if (settings.length) {
      const prefs = { ...(settings[0].preferences as object), twoFaEnabled: !!enable };
      await db.update(userSettingsTable).set({ preferences: prefs, updatedAt: new Date() }).where(eq(userSettingsTable.userId, userId));
    } else {
      await db.insert(userSettingsTable).values({ userId, preferences: { twoFaEnabled: !!enable } });
    }
    res.json({ success: true, twoFaEnabled: !!enable });
  } catch (err) {
    req.log.error({ err }, "Verify OTP error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── BLOCKED USERS ───────────────────────────────────────────────────────────

// GET /safety/blocked — list users I've blocked
router.get("/blocked", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const rows = await db.select().from(blockedUsersTable)
      .where(eq(blockedUsersTable.blockerId, userId));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /safety/blocked — block a user
router.post("/blocked", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { blockedId } = req.body;
    if (!blockedId) { res.status(400).json({ error: "blockedId is required" }); return; }
    if (blockedId === userId) { res.status(400).json({ error: "Cannot block yourself" }); return; }
    // Get blocked user's name
    const users = await db.select().from(usersTable).where(eq(usersTable.id, blockedId)).limit(1);
    const blockedName = users[0]?.name ?? users[0]?.email ?? "Unknown User";
    // Check not already blocked
    const existing = await db.select().from(blockedUsersTable)
      .where(and(eq(blockedUsersTable.blockerId, userId), eq(blockedUsersTable.blockedId, blockedId))).limit(1);
    if (existing.length) { res.status(409).json({ error: "User already blocked" }); return; }
    const inserted = await db.insert(blockedUsersTable)
      .values({ id: randomUUID(), blockerId: userId, blockedId, blockedName })
      .returning();
    res.json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Block user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /safety/blocked/:id — unblock a user (by block record id)
router.delete("/blocked/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    await db.delete(blockedUsersTable)
      .where(and(eq(blockedUsersTable.id, req.params.id), eq(blockedUsersTable.blockerId, userId)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── REPORT USER ─────────────────────────────────────────────────────────────

// POST /safety/reports — file a report against another user
router.post("/reports", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { reportedUserId, reason, description } = req.body;
    if (!reportedUserId || !reason) { res.status(400).json({ error: "reportedUserId and reason are required" }); return; }
    const validReasons = ["spam", "fraud", "abuse", "fake_listing", "other"];
    if (!validReasons.includes(reason)) { res.status(400).json({ error: "Invalid reason" }); return; }
    const users = await db.select().from(usersTable).where(eq(usersTable.id, reportedUserId)).limit(1);
    const reportedUserName = users[0]?.name ?? users[0]?.email ?? "Unknown";
    const inserted = await db.insert(reportsTable).values({
      id: randomUUID(), reporterId: userId, reportedUserId,
      reportedUserName, reason, description,
    }).returning();
    res.json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Report user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── EMERGENCY CONTACT ───────────────────────────────────────────────────────

// GET /safety/emergency-contact
router.get("/emergency-contact", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const rows = await db.select().from(emergencyContactsTable).where(eq(emergencyContactsTable.userId, userId)).limit(1);
    res.json(rows[0] ?? null);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /safety/emergency-contact — upsert
router.put("/emergency-contact", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { name, phone, relation } = req.body;
    if (!name || !phone) { res.status(400).json({ error: "name and phone are required" }); return; }
    const existing = await db.select().from(emergencyContactsTable).where(eq(emergencyContactsTable.userId, userId)).limit(1);
    if (existing.length) {
      const updated = await db.update(emergencyContactsTable)
        .set({ name, phone, relation, updatedAt: new Date() })
        .where(eq(emergencyContactsTable.userId, userId))
        .returning();
      res.json(updated[0]);
    } else {
      const inserted = await db.insert(emergencyContactsTable)
        .values({ id: randomUUID(), userId, name, phone, relation })
        .returning();
      res.json(inserted[0]);
    }
  } catch (err) {
    req.log.error({ err }, "Emergency contact error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /safety/emergency-contact
router.delete("/emergency-contact", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    await db.delete(emergencyContactsTable).where(eq(emergencyContactsTable.userId, userId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── REPORT AN ISSUE ─────────────────────────────────────────────────────────

// POST /safety/issues
router.post("/issues", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { category, description } = req.body;
    if (!category || !description) { res.status(400).json({ error: "category and description are required" }); return; }
    const validCats = ["payment", "booking", "driver", "app_bug", "other"];
    if (!validCats.includes(category)) { res.status(400).json({ error: "Invalid category" }); return; }
    const inserted = await db.insert(issuesTable)
      .values({ id: randomUUID(), userId, category, description })
      .returning();
    res.json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Report issue error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── FAQS ────────────────────────────────────────────────────────────────────

const FAQS = [
  { id: 1, q: "How do I book a car on RentZilla?", a: "Go to the Cars tab, enter your pickup location and destination, choose a vehicle type (Bike, Auto, Car, SUV, or Van), then tap 'Book Ride Now'." },
  { id: 2, q: "Can I rent agricultural equipment?", a: "Yes! Browse and book tractors, harvesters, and other agricultural equipment from the Home tab. Search by category and location." },
  { id: 3, q: "How do I hire a plumber or electrician?", a: "Go to the Home tab, select the 'Services' category, and browse available professionals in your area." },
  { id: 4, q: "How do I list my equipment or vehicle?", a: "Switch to Provider mode in Settings or the Dashboard header. Tap '+ Add Listing' and fill in the details about your equipment or vehicle." },
  { id: 5, q: "When do I get paid as a provider?", a: "Earnings are shown in your Provider Dashboard. Payments are transferred after service completion, typically within 24-48 hours." },
  { id: 6, q: "What if I face an issue during a ride?", a: "Use 'Report an Issue' in Settings > Safety, or contact your emergency contact. You can also cancel the ride from the Cars tab." },
  { id: 7, q: "Can I cancel a booking?", a: "Yes, you can cancel a booking from the Bookings tab before the service date. Cancellation policies vary by provider." },
  { id: 8, q: "Are my payments secure?", a: "Yes, all transactions are secured. Your payment details are encrypted and processed securely through our payment gateway." },
  { id: 9, q: "How do I contact support?", a: "Use the 'Report an Issue' option in Settings, or email us at support@rentzilla.in. We respond within 24 hours." },
  { id: 10, q: "How does the Schedule ride feature work?", a: "In the Cars tab, tap 'Schedule' instead of 'Book Now'. Select your date (up to 7 days ahead) and a time slot. Your ride will be booked in advance." },
];

router.get("/faqs", async (_req: Request, res: Response) => {
  res.json(FAQS);
});

export default router;
