import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { sendSupportTicketEmail } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import { authMiddleware } from "./users.js";

const SUPER_ADMIN_EMAILS = ["admin@rentzilla.com","admin1@rentzilla.com","admin2@rentzilla.com","admin3@rentzilla.com"];

async function adminGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const rows = await db.select({ isAdmin: usersTable.isAdmin, email: usersTable.email })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const u = rows[0];
    if (!u?.isAdmin || !SUPER_ADMIN_EMAILS.includes(u.email ?? "")) {
      res.status(403).json({ error: "Admin access required" }); return;
    }
    next();
  } catch { res.status(500).json({ error: "Auth check failed" }); }
}

const router: IRouter = Router();
function genId() { return Date.now().toString() + Math.random().toString(36).slice(2, 9); }
function toRows<T = any>(r: any): T[] { return Array.isArray(r) ? r : (r?.rows ?? []); }

// ── Simple in-memory rate limiter: max 3 tickets per 10 min per key ──────────
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitize(s: string) {
  return s.trim().replace(/[<>]/g, "").slice(0, 1000);
}

// ── POST /support-ticket — submit a ticket (auth optional) ──────────────────
router.post("/support-ticket", async (req: Request, res: Response) => {
  const userId = (req as any).userId ?? null;

  // Rate limit by userId if logged in, otherwise by IP
  const rateLimitKey = userId ?? (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown");
  if (!checkRateLimit(rateLimitKey)) {
    return res.status(429).json({ error: "rate limit exceeded — please wait 10 minutes before sending another request." });
  }

  const {
    name, contact, issue_type, subject, message,
    platform = "unknown", app_version = "1.0",
  } = req.body as {
    name: string; contact: string; issue_type: string;
    subject?: string; message: string;
    platform?: string; app_version?: string;
  };

  // Field validation
  if (!name?.trim()) return res.status(400).json({ error: "Name is required." });
  if (!contact?.trim() || !EMAIL_REGEX.test(contact.trim())) return res.status(400).json({ error: "A valid email address is required." });
  if (!message?.trim() || message.trim().length < 10) return res.status(400).json({ error: "Message must be at least 10 characters." });

  const cleanName     = sanitize(name);
  const cleanContact  = sanitize(contact).toLowerCase();
  const cleanIssue    = sanitize(issue_type || "General");
  const cleanSubject  = sanitize(subject || issue_type || "General Enquiry");
  const cleanMessage  = sanitize(message);
  const cleanPlatform = sanitize(platform);
  const cleanVersion  = sanitize(app_version);

  const id = genId();
  const timestamp = new Date().toISOString();

  // 1. Save ticket to DB
  await db.execute(sql.raw(`
    INSERT INTO support_tickets (id, user_id, name, contact, issue_type, message)
    VALUES ('${id}', ${userId ? `'${userId}'` : "NULL"},
      '${cleanName.replace(/'/g, "''")}',
      '${cleanContact.replace(/'/g, "''")}',
      '${cleanSubject.replace(/'/g, "''")}',
      '${cleanMessage.replace(/'/g, "''")}'
    )
  `));

  // 2. Try to send email (to admin + confirmation to user)
  let emailSent = false;
  try {
    emailSent = await sendSupportTicketEmail({
      name: cleanName,
      contact: cleanContact,
      issue_type: cleanIssue,
      subject: cleanSubject,
      message: cleanMessage,
      ticket_id: id,
      user_id: userId,
      platform: cleanPlatform,
      app_version: cleanVersion,
      timestamp,
    });
  } catch (err) {
    logger.error({ err, ticket_id: id }, "Support email send threw unexpectedly");
  }

  // 3. If email failed AND user is logged in → create an in-app notification
  if (!emailSent && userId) {
    try {
      await db.insert(notificationsTable).values({
        id: genId(),
        userId,
        title: "Support Request Received",
        message: `Your "${cleanSubject}" request (#${id}) was saved. Our team will follow up at ${cleanContact} within 24 hours. For urgent help email info.rentzilla@gmail.com.`,
        isRead: false,
      });
    } catch (notifErr) {
      logger.warn({ notifErr }, "Could not create fallback notification for support ticket");
    }
  }

  res.status(201).json({ ok: true, id, emailSent });
});

// ── GET /admin/support-tickets — admin view all tickets ─────────────────────
router.get("/admin/support-tickets", authMiddleware, adminGuard, async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string) || "all";
    const whereClause = status !== "all" ? `WHERE status = '${status}'` : "";
    const rows = toRows(await db.execute(sql.raw(`
      SELECT id, user_id, name, contact, issue_type, message, status, admin_notes, created_at, resolved_at
      FROM support_tickets
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 200
    `)));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /admin/support-tickets failed");
    res.status(500).json({ error: "Failed to fetch support tickets" });
  }
});

// ── PATCH /admin/support-tickets/:id — update status/notes ──────────────────
router.patch("/admin/support-tickets/:id", authMiddleware, adminGuard, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body as { status?: string; admin_notes?: string };

    const ticketRows = toRows<{ user_id: string | null; issue_type: string; name: string }>(
      await db.execute(sql.raw(`SELECT user_id, issue_type, name FROM support_tickets WHERE id = '${id}'`))
    );
    const ticket = ticketRows[0] ?? null;

    const resolvedAt = status === "resolved" ? `, resolved_at = NOW()` : "";
    const notesSql = admin_notes !== undefined
      ? `, admin_notes = '${admin_notes.replace(/'/g, "''")}'` : "";
    await db.execute(sql.raw(`
      UPDATE support_tickets
      SET status = COALESCE('${status ?? ""}', status) ${notesSql} ${resolvedAt}
      WHERE id = '${id}'
    `));

    if (ticket?.user_id && (status === "in_progress" || status === "resolved")) {
      const shortId = id.slice(-8).toUpperCase();
      const notifTitle = status === "resolved" ? "Support Ticket Resolved ✅" : "Support Ticket Update 🔄";
      const notifMessage = status === "resolved"
        ? `Your support request #${shortId} (${ticket.issue_type}) has been resolved. Thank you for your patience!`
        : `Your support request #${shortId} (${ticket.issue_type}) is now being reviewed. We'll get back to you shortly.`;
      try {
        await db.insert(notificationsTable).values({ id: genId(), userId: ticket.user_id, title: notifTitle, message: notifMessage, isRead: false });
        logger.info({ ticket_id: id, user_id: ticket.user_id, status }, "Support status notification sent");
      } catch (notifErr) { logger.warn({ notifErr, ticket_id: id }, "Failed to create support notification"); }
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PATCH /admin/support-tickets/:id failed");
    res.status(500).json({ error: "Failed to update support ticket" });
  }
});

export default router;
