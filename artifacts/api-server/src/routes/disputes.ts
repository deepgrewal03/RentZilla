import { Router, type IRouter, type Request as ExpressRequest, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable, bookingsTable, notificationsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authMiddleware } from "./users.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();
type Request = ExpressRequest<Record<string, string>>;
function genId() { return Date.now().toString() + Math.random().toString(36).slice(2, 9); }
function toRows<T = any>(r: any): T[] { return Array.isArray(r) ? r : (r?.rows ?? []); }

const SUPER_ADMIN_EMAILS = ["admin@rentzilla.com","admin1@rentzilla.com","admin2@rentzilla.com","admin3@rentzilla.com"];

async function isAdmin(userId: string): Promise<boolean> {
  const rows = await db.select({ isAdmin: usersTable.isAdmin, email: usersTable.email })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const u = rows[0];
  return Boolean(u?.isAdmin && SUPER_ADMIN_EMAILS.includes(u.email ?? ""));
}

// ── GET /disputes/:bookingId ─ get dispute thread + status ──────────────────
router.get("/:bookingId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = (req as any).userId;

    const bookings = toRows(await db.execute(sql`
      SELECT b.*, l.title AS listing_title, l.images AS listing_images,
        cu.name AS customer_name, cu.profile_image AS customer_photo,
        pu.name AS provider_name, pu.profile_image AS provider_photo
      FROM bookings b
      LEFT JOIN listings l ON l.id = b.listing_id
      LEFT JOIN users cu ON cu.id = b.customer_id
      LEFT JOIN users pu ON pu.id = b.provider_id
      WHERE b.id = ${bookingId}
      LIMIT 1
    `));
    const booking = bookings[0];
    if (!booking) return void res.status(404).json({ error: "Booking not found" });

    const admin = await isAdmin(userId);
    if (!admin && booking.customer_id !== userId && booking.provider_id !== userId) {
      return void res.status(403).json({ error: "Access denied" });
    }

    const messages = toRows(await db.execute(sql`
      SELECT dm.*, u.name AS sender_name, u.profile_image AS sender_photo
      FROM dispute_messages dm
      LEFT JOIN users u ON u.id = dm.sender_id
      WHERE dm.booking_id = ${bookingId}
      ORDER BY dm.created_at ASC
    `));

    res.json({ booking, messages });
  } catch (err) {
    logger.error({ err }, "GET /disputes/:bookingId failed");
    res.status(500).json({ error: "Failed to load dispute" });
  }
});

// ── POST /disputes/:bookingId/open ─ customer opens a dispute ───────────────
router.post("/:bookingId/open", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = (req as any).userId;
    const { reason, message } = req.body as { reason: string; message: string };

    if (!reason?.trim()) return void res.status(400).json({ error: "Reason is required" });
    if (!message?.trim() || message.trim().length < 10) return void res.status(400).json({ error: "Message must be at least 10 characters" });

    const bookings = toRows(await db.execute(sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`));
    const booking = bookings[0];
    if (!booking) return void res.status(404).json({ error: "Booking not found" });
    if (booking.customer_id !== userId) return void res.status(403).json({ error: "Only the customer can open a dispute" });
    if (!["confirmed","completed"].includes(booking.status)) {
      return void res.status(400).json({ error: "Disputes can only be opened on confirmed or completed bookings" });
    }
    if (booking.dispute_status === "open" || booking.dispute_status === "under_review") {
      return void res.status(400).json({ error: "A dispute is already open for this booking" });
    }

    await db.execute(sql`
      UPDATE bookings SET
        dispute_status = 'open',
        dispute_reason = ${reason.trim()},
        dispute_opened_at = NOW(),
        updated_at = NOW()
      WHERE id = ${bookingId}
    `);

    const msgId = genId();
    await db.execute(sql`
      INSERT INTO dispute_messages (id, booking_id, sender_id, sender_role, content, created_at)
      VALUES (${msgId}, ${bookingId}, ${userId}, 'customer', ${message.trim()}, NOW())
    `);

    // Notify provider
    await db.insert(notificationsTable).values({
      id: genId(),
      userId: booking.provider_id,
      title: "Dispute Opened ⚠️",
      message: `A customer has opened a dispute for booking #${bookingId.slice(-8).toUpperCase()}. Reason: ${reason}. Please respond within 48 hours.`,
      isRead: false,
    }).catch(() => {});

    // Notify admin
    for (const email of SUPER_ADMIN_EMAILS.slice(0, 1)) {
      const admins = toRows(await db.execute(sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`));
      if (admins[0]?.id) {
        await db.insert(notificationsTable).values({
          id: genId(), userId: admins[0].id,
          title: "New Dispute Filed 🚨",
          message: `Booking #${bookingId.slice(-8).toUpperCase()}: ${reason}`,
          isRead: false,
        }).catch(() => {});
      }
    }

    res.status(201).json({ ok: true, messageId: msgId });
  } catch (err) {
    logger.error({ err }, "POST /disputes/:bookingId/open failed");
    res.status(500).json({ error: "Failed to open dispute" });
  }
});

// ── POST /disputes/:bookingId/message ─ add a message to the thread ─────────
router.post("/:bookingId/message", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = (req as any).userId;
    const { content } = req.body as { content: string };

    if (!content?.trim() || content.trim().length < 2) return void res.status(400).json({ error: "Message too short" });

    const bookings = toRows(await db.execute(sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`));
    const booking = bookings[0];
    if (!booking) return void res.status(404).json({ error: "Booking not found" });

    const admin = await isAdmin(userId);
    let senderRole = "admin";
    if (!admin) {
      if (booking.customer_id === userId) senderRole = "customer";
      else if (booking.provider_id === userId) senderRole = "provider";
      else return void res.status(403).json({ error: "Access denied" });
    }

    if (!["open","under_review"].includes(booking.dispute_status)) {
      return void res.status(400).json({ error: "Dispute is not active" });
    }

    const msgId = genId();
    await db.execute(sql`
      INSERT INTO dispute_messages (id, booking_id, sender_id, sender_role, content, created_at)
      VALUES (${msgId}, ${bookingId}, ${userId}, ${senderRole}, ${content.trim()}, NOW())
    `);

    // If provider responds, move to under_review
    if (senderRole === "provider" && booking.dispute_status === "open") {
      await db.execute(sql`UPDATE bookings SET dispute_status='under_review', updated_at=NOW() WHERE id=${bookingId}`);
    }

    // Notify the other parties
    const notifyIds = new Set<string>();
    if (senderRole !== "customer") notifyIds.add(booking.customer_id);
    if (senderRole !== "provider") notifyIds.add(booking.provider_id);

    const roleLabel = senderRole === "admin" ? "Admin" : senderRole === "customer" ? "Customer" : "Provider";
    for (const uid of notifyIds) {
      await db.insert(notificationsTable).values({
        id: genId(), userId: uid,
        title: "Dispute Update 💬",
        message: `${roleLabel} replied to dispute #${bookingId.slice(-8).toUpperCase()}: "${content.slice(0,80)}${content.length > 80 ? "…" : ""}"`,
        isRead: false,
      }).catch(() => {});
    }

    res.status(201).json({ ok: true, id: msgId, senderRole });
  } catch (err) {
    logger.error({ err }, "POST /disputes/:bookingId/message failed");
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ── PATCH /disputes/:bookingId/resolve ─ admin resolves the dispute ──────────
router.patch("/:bookingId/resolve", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = (req as any).userId;
    const { resolution, refundAmount, refundTo, adminNote } = req.body as {
      resolution: "refund_customer" | "refund_provider" | "dismiss";
      refundAmount?: number;
      refundTo?: "customer" | "provider";
      adminNote?: string;
    };

    if (!(await isAdmin(userId))) return void res.status(403).json({ error: "Admin access required" });

    const bookings = toRows(await db.execute(sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`));
    const booking = bookings[0];
    if (!booking) return void res.status(404).json({ error: "Booking not found" });

    // Process refund if applicable
    if ((resolution === "refund_customer" || resolution === "refund_provider") && refundAmount && refundAmount > 0) {
      const targetUserId = refundTo === "provider" ? booking.provider_id : booking.customer_id;
      const targetRole = refundTo === "provider" ? "Provider" : "Customer";

      // Credit wallet
      await db.execute(sql`UPDATE users SET wallet_balance = wallet_balance + ${refundAmount} WHERE id = ${targetUserId}`);
      await db.execute(sql`
        INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status, created_at)
        SELECT ${genId()}, ${targetUserId}, 'refund', ${refundAmount}, wallet_balance,
               ${bookingId}, 'booking_dispute_refund',
               ${"Dispute refund — Booking #" + bookingId.slice(-8).toUpperCase()},
               'completed', NOW()
        FROM users WHERE id = ${targetUserId}
      `);

      await db.insert(notificationsTable).values({
        id: genId(), userId: targetUserId,
        title: "Dispute Resolved — Refund Issued 💰",
        message: `Your dispute for booking #${bookingId.slice(-8).toUpperCase()} has been resolved. ₹${refundAmount} refunded to your wallet.`,
        isRead: false,
      }).catch(() => {});
    }

    // Post resolution message to thread
    if (adminNote) {
      await db.execute(sql`
        INSERT INTO dispute_messages (id, booking_id, sender_id, sender_role, content, created_at)
        VALUES (${genId()}, ${bookingId}, ${userId}, 'admin', ${adminNote.trim()}, NOW())
      `);
    }

    const resolutionLabel = resolution === "dismiss" ? "Dismissed" :
      resolution === "refund_customer" ? "Resolved — Customer Refunded" :
      "Resolved — Provider Credited";

    await db.execute(sql`
      UPDATE bookings SET
        dispute_status = 'resolved',
        dispute_resolution = ${resolutionLabel},
        dispute_resolved_at = NOW(),
        dispute_resolved_by = ${userId},
        refund_amount = ${refundAmount ?? 0},
        updated_at = NOW()
      WHERE id = ${bookingId}
    `);

    // Notify both parties
    for (const uid of [booking.customer_id, booking.provider_id]) {
      await db.insert(notificationsTable).values({
        id: genId(), userId: uid,
        title: "Dispute Resolved ✅",
        message: `Dispute for booking #${bookingId.slice(-8).toUpperCase()} has been ${resolutionLabel.toLowerCase()}.${adminNote ? " Admin note: " + adminNote.slice(0,80) : ""}`,
        isRead: false,
      }).catch(() => {});
    }

    res.json({ ok: true, resolution: resolutionLabel });
  } catch (err) {
    logger.error({ err }, "PATCH /disputes/:bookingId/resolve failed");
    res.status(500).json({ error: "Failed to resolve dispute" });
  }
});

// ── GET /disputes ─ admin: list all disputes ─────────────────────────────────
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!(await isAdmin(userId))) return void res.status(403).json({ error: "Admin access required" });

    const status = (req.query.status as string) || "all";
    const whereClause = status !== "all" ? `WHERE b.dispute_status = '${status}'` : `WHERE b.dispute_status IS NOT NULL AND b.dispute_status != ''`;

    const rows = toRows(await db.execute(sql.raw(`
      SELECT b.id, b.dispute_status, b.dispute_reason, b.dispute_opened_at,
             b.dispute_resolution, b.dispute_resolved_at, b.refund_amount,
             b.total_amount, b.final_amount, b.status AS booking_status,
             l.title AS listing_title, l.images AS listing_images,
             cu.name AS customer_name, cu.profile_image AS customer_photo, cu.id AS customer_id,
             pu.name AS provider_name, pu.profile_image AS provider_photo, pu.id AS provider_id,
             (SELECT COUNT(*) FROM dispute_messages WHERE booking_id = b.id) AS message_count
      FROM bookings b
      LEFT JOIN listings l ON l.id = b.listing_id
      LEFT JOIN users cu ON cu.id = b.customer_id
      LEFT JOIN users pu ON pu.id = b.provider_id
      ${whereClause}
      ORDER BY b.dispute_opened_at DESC NULLS LAST
      LIMIT 200
    `)));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /disputes failed");
    res.status(500).json({ error: "Failed to list disputes" });
  }
});

export default router;
