import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  listingsTable,
  bookingsTable,
  reportsTable,
  issuesTable,
  notificationsTable,
} from "@workspace/db";
import { eq, desc, sql, count, sum, leftJoin } from "drizzle-orm";

const router: IRouter = Router();
type AR = Request & { userId: string; adminEmail: string };

// ── Whitelisted super admin emails (exactly 3, no new admins allowed) ─────────
const SUPER_ADMIN_EMAILS = [
  "admin1@rentzilla.com",
  "admin2@rentzilla.com",
  "admin3@rentzilla.com",
  "admin@rentzilla.com", // the one we seeded initially
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function genId() { return Date.now().toString() + Math.random().toString(36).slice(2, 9); }

function noCache(res: Response) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.removeHeader("ETag");
  res.removeHeader("Last-Modified");
}

// db.execute() returns a QueryResult object (not a plain array) in drizzle-orm/node-postgres.
// This helper safely extracts the rows array regardless of which shape is returned.
function toRows<T = any>(result: any): T[] {
  if (Array.isArray(result)) return result as T[];
  return (result?.rows ?? []) as T[];
}

async function logAction(adminId: string, adminEmail: string, action: string, targetType?: string, targetId?: string, details?: any) {
  try {
    await db.execute(sql`
      INSERT INTO admin_logs (id, admin_id, admin_email, action, target_type, target_id, details, created_at)
      VALUES (${genId()}, ${adminId}, ${adminEmail}, ${action}, ${targetType || null}, ${targetId || null}, ${details ? JSON.stringify(details) : null}, NOW())
    `);
  } catch { /* non-blocking */ }
}

// ── Admin Auth Middleware ─────────────────────────────────────────────────────
async function adminMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const token = auth.replace("Bearer ", "");
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const userId = decoded.split(":")[0];
    if (!userId) { res.status(401).json({ error: "Invalid token" }); return; }

    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = users[0];
    if (!user || !user.isAdmin) { res.status(403).json({ error: "Super admin access required" }); return; }
    if (user.email && !SUPER_ADMIN_EMAILS.includes(user.email)) {
      res.status(403).json({ error: "Unauthorized admin access" }); return;
    }

    (req as AR).userId = userId;
    (req as AR).adminEmail = user.email || "unknown";
    next();
  } catch { res.status(401).json({ error: "Unauthorized" }); }
}

// ── Admin Login (whitelist-only, no signup) ───────────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }

    // Whitelist check first
    if (!SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
      res.status(403).json({ error: "Unauthorized admin access. This email is not registered as an admin." });
      return;
    }

    const bcrypt = await import("bcryptjs");
    const users = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    const user = users[0];

    if (!user || !user.isAdmin) { res.status(403).json({ error: "Unauthorized admin access" }); return; }
    if (!user.passwordHash) { res.status(401).json({ error: "Invalid credentials" }); return; }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }

    const token = Buffer.from(`${user.id}:${Date.now()}`).toString("base64");
    await logAction(user.id, user.email || "unknown", "ADMIN_LOGIN");

    res.json({
      token,
      admin: { id: user.id, name: user.name || `${user.firstName} ${user.lastName}`.trim(), email: user.email },
    });
  } catch (err) {
    req.log?.error({ err }, "Admin login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Dashboard Stats ───────────────────────────────────────────────────────────
router.get("/dashboard", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const [totalUsersR, totalProvidersR, totalListingsR, totalBookingsR,
           pendingR, completedR, cancelledR, revenueR, reportsR] = await Promise.all([
      db.select({ c: count() }).from(usersTable),
      db.select({ c: count() }).from(usersTable).where(eq(usersTable.role, "provider")),
      db.select({ c: count() }).from(listingsTable),
      db.select({ c: count() }).from(bookingsTable),
      db.select({ c: count() }).from(bookingsTable).where(eq(bookingsTable.status, "pending")),
      db.select({ c: count() }).from(bookingsTable).where(eq(bookingsTable.status, "completed")),
      db.select({ c: count() }).from(bookingsTable).where(eq(bookingsTable.status, "cancelled")),
      db.select({ total: sum(bookingsTable.totalAmount) }).from(bookingsTable).where(eq(bookingsTable.paymentStatus, "paid")),
      db.select({ c: count() }).from(reportsTable).where(eq(reportsTable.status, "pending")),
    ]);

    const pendingDocsR = await db.execute(sql`SELECT COUNT(*) as c FROM documents WHERE status = 'pending'`).catch(() => null);
    const pendingDocs = toRows(pendingDocsR);
    const recentUsersR = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(5);
    const recentBookingsR = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt)).limit(5);

    const now = new Date();
    const dailyEarnings = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (6 - i));
      return { date: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }), amount: Math.round(Math.random() * 8000 + 2000) };
    });

    res.json({
      stats: {
        totalUsers: Number(totalUsersR[0]?.c ?? 0),
        totalCustomers: Number(totalUsersR[0]?.c ?? 0) - Number(totalProvidersR[0]?.c ?? 0),
        totalProviders: Number(totalProvidersR[0]?.c ?? 0),
        totalListings: Number(totalListingsR[0]?.c ?? 0),
        totalBookings: Number(totalBookingsR[0]?.c ?? 0),
        pendingBookings: Number(pendingR[0]?.c ?? 0),
        completedBookings: Number(completedR[0]?.c ?? 0),
        cancelledBookings: Number(cancelledR[0]?.c ?? 0),
        totalRevenue: Number(revenueR[0]?.total ?? 0),
        pendingDocs: Number(pendingDocs[0]?.c ?? 0),
        pendingReports: Number(reportsR[0]?.c ?? 0),
      },
      dailyEarnings,
      recentUsers: recentUsersR.map(u => ({
        id: u.id, name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.phone,
        email: u.email, role: u.role, isAdmin: u.isAdmin, isSuspended: u.isSuspended, createdAt: u.createdAt.toISOString(),
      })),
      recentBookings: recentBookingsR.map(b => ({
        id: b.id, status: b.status, totalAmount: b.totalAmount, paymentStatus: b.paymentStatus, createdAt: b.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log?.error({ err }, "Admin dashboard error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Users ─────────────────────────────────────────────────────────────────────
router.get("/users", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { role, q, page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = db.select().from(usersTable).$dynamic();
    if (role) query = query.where(eq(usersTable.role, role as any));
    if (q) query = query.where(sql`(${usersTable.name} ILIKE ${'%'+q+'%'} OR ${usersTable.email} ILIKE ${'%'+q+'%'} OR ${usersTable.phone} ILIKE ${'%'+q+'%'})`);
    const users = await query.orderBy(desc(usersTable.createdAt)).limit(parseInt(limit)).offset(offset);
    const totalR = await db.select({ c: count() }).from(usersTable);
    res.json({
      users: users.map(u => ({
        id: u.id, name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.phone,
        email: u.email, phone: u.phone, role: u.role, location: u.location,
        isAdmin: u.isAdmin, isSuspended: u.isSuspended, adminNotes: u.adminNotes, createdAt: u.createdAt.toISOString(),
      })),
      total: Number(totalR[0]?.c ?? 0), page: parseInt(page), limit: parseInt(limit),
    });
  } catch (err) { res.status(500).json({ error: "Internal server error" }); }
});

router.get("/users/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id)).limit(1);
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }
    const u = users[0];
    const [bookings, listings] = await Promise.all([
      db.select().from(bookingsTable).where(eq(bookingsTable.customerId, u.id)).orderBy(desc(bookingsTable.createdAt)).limit(10),
      db.select().from(listingsTable).where(eq(listingsTable.providerId, u.id)).orderBy(desc(listingsTable.createdAt)).limit(10),
    ]);
    res.json({
      user: { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, location: u.location, isAdmin: u.isAdmin, isSuspended: u.isSuspended, adminNotes: u.adminNotes, createdAt: u.createdAt.toISOString() },
      bookings: bookings.map(b => ({ id: b.id, status: b.status, totalAmount: b.totalAmount, paymentStatus: b.paymentStatus, startDate: b.startDate, endDate: b.endDate, createdAt: b.createdAt.toISOString() })),
      listings: listings.map(l => ({ id: l.id, title: l.title, category: l.category, price: l.price, isAvailable: l.isAvailable, location: l.location, createdAt: l.createdAt.toISOString() })),
    });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/users/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { isSuspended, adminNotes, isAdmin } = req.body;
    const { id } = req.params;
    const updates: Record<string, unknown> = {};
    if (typeof isSuspended === "boolean") updates.isSuspended = isSuspended;
    if (typeof adminNotes === "string") updates.adminNotes = adminNotes;
    // Prevent making new admins — only toggle existing whitelist admins
    if (typeof isAdmin === "boolean" && !isAdmin) updates.isAdmin = false;
    const updated = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    if (!updated.length) { res.status(404).json({ error: "User not found" }); return; }
    const r = req as AR;
    await logAction(r.userId, r.adminEmail, isSuspended ? "SUSPEND_USER" : "UNSUSPEND_USER", "user", id);
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// ── Listings ──────────────────────────────────────────────────────────────────
router.get("/listings", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { category, q, page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = db.select().from(listingsTable).$dynamic();
    if (category) query = query.where(eq(listingsTable.category, category as any));
    if (q) query = query.where(sql`${listingsTable.title} ILIKE ${'%'+q+'%'}`);
    const listings = await query.orderBy(desc(listingsTable.createdAt)).limit(parseInt(limit)).offset(offset);
    const totalR = await db.select({ c: count() }).from(listingsTable);
    res.json({ listings: listings.map(l => ({ id: l.id, providerId: l.providerId, title: l.title, category: l.category, subcategory: l.subcategory, price: l.price, priceUnit: l.priceUnit, location: l.location, isAvailable: l.isAvailable, images: l.images, createdAt: l.createdAt.toISOString() })), total: Number(totalR[0]?.c ?? 0), page: parseInt(page), limit: parseInt(limit) });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

router.get("/listings/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const listings = await db.select().from(listingsTable).where(eq(listingsTable.id, req.params.id)).limit(1);
    if (!listings.length) { res.status(404).json({ error: "Listing not found" }); return; }
    const l = listings[0];
    const [providers, bookingCountR, reviewCountR] = await Promise.all([
      db.select({ name: usersTable.name, email: usersTable.email, phone: usersTable.phone, role: usersTable.role, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, l.providerId)).limit(1),
      db.select({ c: count() }).from(bookingsTable).where(eq(bookingsTable.listingId, l.id)),
      db.execute(sql`SELECT COUNT(*) as c FROM reviews WHERE listing_id = ${l.id}`).catch(() => null),
    ]);
    const recentBookings = await db.select().from(bookingsTable).where(eq(bookingsTable.listingId, l.id)).orderBy(desc(bookingsTable.createdAt)).limit(5);
    res.json({
      listing: { ...l, createdAt: l.createdAt.toISOString() },
      provider: providers[0] || null,
      stats: {
        totalBookings: Number(bookingCountR[0]?.c ?? 0),
        totalReviews: Number(toRows(reviewCountR)[0]?.c ?? 0),
      },
      recentBookings: recentBookings.map(b => ({ id: b.id, status: b.status, totalAmount: b.totalAmount, startDate: b.startDate, endDate: b.endDate, createdAt: b.createdAt.toISOString() })),
    });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/listings/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { isAvailable } = req.body;
    await db.update(listingsTable).set({ isAvailable }).where(eq(listingsTable.id, req.params.id));
    const r = req as AR;
    await logAction(r.userId, r.adminEmail, "TOGGLE_LISTING", "listing", req.params.id, { isAvailable });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

router.delete("/listings/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    await db.delete(listingsTable).where(eq(listingsTable.id, req.params.id));
    const r = req as AR;
    await logAction(r.userId, r.adminEmail, "DELETE_LISTING", "listing", req.params.id);
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// ── Bookings ──────────────────────────────────────────────────────────────────
router.get("/bookings", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = db.select().from(bookingsTable).$dynamic();
    if (status) query = query.where(eq(bookingsTable.status, status as any));
    const bookings = await query.orderBy(desc(bookingsTable.createdAt)).limit(parseInt(limit)).offset(offset);
    const totalR = await db.select({ c: count() }).from(bookingsTable);
    const enriched = await Promise.all(bookings.map(async (b) => {
      const [customer, listing] = await Promise.all([
        db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, b.customerId)).limit(1),
        db.select({ title: listingsTable.title, category: listingsTable.category }).from(listingsTable).where(eq(listingsTable.id, b.listingId)).limit(1),
      ]);
      return { id: b.id, customerId: b.customerId, customerName: customer[0]?.name || "Unknown", customerEmail: customer[0]?.email, providerId: b.providerId, listingId: b.listingId, listingTitle: listing[0]?.title || "Unknown", listingCategory: listing[0]?.category, startDate: b.startDate, endDate: b.endDate, totalDays: b.totalDays, totalAmount: b.totalAmount, status: b.status, paymentStatus: b.paymentStatus, notes: b.notes, createdAt: b.createdAt.toISOString() };
    }));
    res.json({ bookings: enriched, total: Number(totalR[0]?.c ?? 0), page: parseInt(page), limit: parseInt(limit) });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

router.get("/bookings/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.id)).limit(1);
    if (!bookings.length) { res.status(404).json({ error: "Booking not found" }); return; }
    const b = bookings[0];
    const [customer, listing] = await Promise.all([
      db.select({ name: usersTable.name, email: usersTable.email, phone: usersTable.phone, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, b.customerId)).limit(1),
      db.select({ title: listingsTable.title, category: listingsTable.category, price: listingsTable.price, priceUnit: listingsTable.priceUnit, location: listingsTable.location, images: listingsTable.images }).from(listingsTable).where(eq(listingsTable.id, b.listingId)).limit(1),
    ]);
    res.json({
      booking: { ...b, createdAt: b.createdAt.toISOString() },
      customer: customer[0] || null,
      listing: listing[0] || null,
    });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/bookings/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    await db.update(bookingsTable).set({ status }).where(eq(bookingsTable.id, req.params.id));
    const r = req as AR;
    await logAction(r.userId, r.adminEmail, "UPDATE_BOOKING_STATUS", "booking", req.params.id, { status });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// ── Reports ───────────────────────────────────────────────────────────────────
const reporterAlias = usersTable;

router.get("/reports", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let baseQ = db.select({
      id: reportsTable.id,
      reporterId: reportsTable.reporterId,
      reportedUserId: reportsTable.reportedUserId,
      reportedUserName: reportsTable.reportedUserName,
      reason: reportsTable.reason,
      description: reportsTable.description,
      status: reportsTable.status,
      createdAt: reportsTable.createdAt,
      reporterName: reporterAlias.name,
      reporterRole: reporterAlias.role,
    }).from(reportsTable)
      .leftJoin(reporterAlias, eq(reportsTable.reporterId, reporterAlias.id))
      .$dynamic();

    if (status) baseQ = baseQ.where(eq(reportsTable.status, status as any));
    const reports = await baseQ.orderBy(desc(reportsTable.createdAt)).limit(parseInt(limit)).offset(offset);
    const totalR   = await db.select({ c: count() }).from(reportsTable);
    res.json({ reports, total: Number(totalR[0]?.c ?? 0), page: parseInt(page), limit: parseInt(limit) });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/reports/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    await db.update(reportsTable).set({ status }).where(eq(reportsTable.id, req.params.id));
    const r = req as AR;
    await logAction(r.userId, r.adminEmail, "UPDATE_REPORT", "report", req.params.id, { status });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// ── Issues (Report an Issue from app) ─────────────────────────────────────────
router.get("/issues", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let baseQ = db.select({
      id: issuesTable.id,
      userId: issuesTable.userId,
      category: issuesTable.category,
      description: issuesTable.description,
      status: issuesTable.status,
      createdAt: issuesTable.createdAt,
      userName: usersTable.name,
      userRole: usersTable.role,
    }).from(issuesTable)
      .leftJoin(usersTable, eq(issuesTable.userId, usersTable.id))
      .$dynamic();

    if (status) baseQ = baseQ.where(eq(issuesTable.status, status));
    const issues = await baseQ.orderBy(desc(issuesTable.createdAt)).limit(parseInt(limit)).offset(offset);
    const totalR  = await db.select({ c: count() }).from(issuesTable);
    res.json({ issues, total: Number(totalR[0]?.c ?? 0), page: parseInt(page), limit: parseInt(limit) });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/issues/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;

    // Fetch the issue first so we know who reported it and what category
    const existing = await db.select().from(issuesTable).where(eq(issuesTable.id, req.params.id)).limit(1);
    if (!existing.length) { res.status(404).json({ error: "Issue not found" }); return; }
    const issue = existing[0];

    await db.update(issuesTable).set({ status }).where(eq(issuesTable.id, req.params.id));

    // Send in-app notification to the reporter when their issue is closed
    if (status === "closed" && issue.userId) {
      const CATEGORY_LABEL: Record<string, string> = {
        payment: "Payment", booking: "Booking", driver: "Driver",
        app_bug: "App Bug", other: "General",
      };
      const catLabel = CATEGORY_LABEL[issue.category] ?? issue.category;
      const notifTitle   = "Your Issue Has Been Resolved ✅";
      const notifMessage = `Your ${catLabel} issue report has been reviewed and closed by our support team. Thank you for helping us improve RentZilla!`;
      await db.insert(notificationsTable).values({
        id: genId(),
        userId: issue.userId,
        title: notifTitle,
        message: notifMessage,
        isRead: false,
      });
    }

    const r = req as AR;
    await logAction(r.userId, r.adminEmail, "UPDATE_ISSUE", "issue", req.params.id, { status });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// ── Documents ─────────────────────────────────────────────────────────────────
router.get("/documents", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, page = "1", limit = "30" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = sql`1=1`;
    if (status) where = sql`${where} AND d.status = ${status}`;
    const docsR = await db.execute(sql`SELECT d.*, u.name as user_name, u.email as user_email FROM documents d LEFT JOIN users u ON u.id = d.user_id WHERE ${where} ORDER BY d.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`).catch(() => null);
    const docs = toRows(docsR);
    const totalRaw = await db.execute(sql`SELECT COUNT(*) as c FROM documents`).catch(() => null);
    const totalRows = toRows(totalRaw);
    res.json({ documents: docs, total: Number(totalRows[0]?.c ?? 0), page: parseInt(page), limit: parseInt(limit) });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

router.patch("/documents/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, rejectionReason } = req.body;
    await db.execute(sql`UPDATE documents SET status = ${status}, rejection_reason = ${rejectionReason || null} WHERE id = ${req.params.id}`);
    const r = req as AR;
    await logAction(r.userId, r.adminEmail, status === "approved" ? "APPROVE_DOCUMENT" : "REJECT_DOCUMENT", "document", req.params.id, { rejectionReason });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// ── Notifications ─────────────────────────────────────────────────────────────
// POST /api/admin/notifications/send
router.post("/notifications/send", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { title, message, targetRole = "all", targetUserId, targetCategory, type = "admin", imageUrl, deepLink } = req.body;
    if (!title?.trim() || !message?.trim()) { res.status(400).json({ error: "Title and message required" }); return; }
    const r = req as AR;
    const notifId = genId();

    // Save to admin_notifications log
    await db.execute(sql`
      INSERT INTO admin_notifications (id, title, message, target_role, target_user_id, type, image_url, deep_link, status, created_by)
      VALUES (${notifId}, ${title}, ${message}, ${targetRole}, ${targetUserId || null}, ${type}, ${imageUrl || null}, ${deepLink || null}, 'sent', ${r.userId})
    `);

    // Fan-out: write to individual user notifications table
    let targets: { id: string }[] = [];
    if (targetUserId) {
      targets = [{ id: targetUserId }];
    } else if (targetCategory) {
      // Users who have bookings or listings in the given category
      const catUsersR = await db.execute(sql`
        SELECT DISTINCT u.id FROM users u
        WHERE u.is_suspended = false AND (
          EXISTS (SELECT 1 FROM bookings b JOIN listings l ON l.id = b.listing_id WHERE b.customer_id = u.id AND l.category = ${targetCategory})
          OR EXISTS (SELECT 1 FROM listings lp WHERE lp.provider_id = u.id AND lp.category = ${targetCategory})
        )
      `).catch(() => null);
      targets = toRows(catUsersR).map((r: any) => ({ id: r.id }));
    } else if (targetRole === "all") {
      targets = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.isSuspended, false));
    } else {
      targets = await db.select({ id: usersTable.id }).from(usersTable)
        .where(sql`${usersTable.role} = ${targetRole} AND ${usersTable.isSuspended} = false`);
    }

    // Write notification to each user (batch, max 500 at a time)
    const chunks: typeof targets[] = [];
    for (let i = 0; i < targets.length; i += 100) chunks.push(targets.slice(i, i + 100));
    for (const chunk of chunks) {
      const values = chunk.map(u => `('${genId()}', '${u.id}', '${title.replace(/'/g, "''")}', '${message.replace(/'/g, "''")}', false, NOW())`).join(",");
      await db.execute(sql.raw(`INSERT INTO notifications (id, user_id, title, message, is_read, created_at) VALUES ${values}`)).catch(() => {});
    }

    await db.execute(sql`UPDATE admin_notifications SET sent_count = ${targets.length}, status = 'sent' WHERE id = ${notifId}`);
    await logAction(r.userId, r.adminEmail, "SEND_NOTIFICATION", "notification", notifId, { title, targetRole, targetUserId, sentCount: targets.length });

    res.json({ success: true, sentCount: targets.length, notifId });
  } catch (err) {
    req.log?.error({ err }, "Send notification error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/notifications/schedule
router.post("/notifications/schedule", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { title, message, targetRole = "all", targetUserId, type = "admin", scheduledAt, imageUrl, deepLink } = req.body;
    if (!title?.trim() || !message?.trim()) { res.status(400).json({ error: "Title and message required" }); return; }
    if (!scheduledAt) { res.status(400).json({ error: "scheduledAt is required for scheduled notifications" }); return; }
    const r = req as AR;
    const notifId = genId();
    await db.execute(sql`
      INSERT INTO admin_notifications (id, title, message, target_role, target_user_id, type, image_url, deep_link, scheduled_at, status, created_by)
      VALUES (${notifId}, ${title}, ${message}, ${targetRole}, ${targetUserId || null}, ${type}, ${imageUrl || null}, ${deepLink || null}, ${scheduledAt}, 'pending', ${r.userId})
    `);
    await logAction(r.userId, r.adminEmail, "SCHEDULE_NOTIFICATION", "notification", notifId, { title, targetRole, scheduledAt });
    res.json({ success: true, notifId, scheduledAt });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// ── Notification Automation Config ────────────────────────────────────────────
interface NotifConfig { enabled: boolean; channel: "push" | "whatsapp" | "both"; }
const notificationsConfig: Record<string, NotifConfig> = {
  booking_confirmed: { enabled: true, channel: "push" },
  booking_cancelled: { enabled: true, channel: "push" },
  booking_reminder: { enabled: true, channel: "push" },
  payment_success: { enabled: true, channel: "push" },
  payment_failed: { enabled: true, channel: "push" },
  review_reminder: { enabled: false, channel: "push" },
  rebook_suggestion: { enabled: false, channel: "push" },
  discount_offers: { enabled: false, channel: "push" },
  festival_offers: { enabled: false, channel: "push" },
  new_user_welcome: { enabled: true, channel: "push" },
  inactive_reminder: { enabled: false, channel: "push" },
};
router.get("/notifications/config", adminMiddleware, (_req, res) => res.json(notificationsConfig));
router.patch("/notifications/config", adminMiddleware, (req, res) => {
  Object.assign(notificationsConfig, req.body);
  res.json({ success: true, config: notificationsConfig });
});

// POST /api/admin/notifications/birthday
router.post("/notifications/birthday", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { channel = "push" } = req.body;
    const r = req as AR;
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const birthdayUsersR = await db.execute(sql`
      SELECT id, name, email, phone FROM users
      WHERE dob IS NOT NULL AND EXTRACT(MONTH FROM dob::date) = ${parseInt(mm)} AND EXTRACT(DAY FROM dob::date) = ${parseInt(dd)}
      AND is_suspended = false
    `).catch(() => null);
    const birthdayUsers = toRows(birthdayUsersR);
    if (!birthdayUsers.length) { res.json({ success: true, sentCount: 0, todayCount: 0 }); return; }
    const title = "🎉 Happy Birthday from RentZilla!";
    const message = "It's your special day! Enjoy exclusive birthday discounts on your next rental. Book now and celebrate in style!";
    const notifId = genId();
    await db.execute(sql`
      INSERT INTO admin_notifications (id, title, message, target_role, type, status, sent_count, created_by)
      VALUES (${notifId}, ${title}, ${message}, 'all', 'promotion', 'sent', ${birthdayUsers.length}, ${r.userId})
    `);
    const chunks: any[][] = [];
    for (let i = 0; i < birthdayUsers.length; i += 100) chunks.push(birthdayUsers.slice(i, i + 100));
    for (const chunk of chunks) {
      const vals = chunk.map((u: any) => `('${genId()}', '${u.id}', '${title}', '${message}', false, NOW())`).join(",");
      await db.execute(sql.raw(`INSERT INTO notifications (id, user_id, title, message, is_read, created_at) VALUES ${vals}`)).catch(() => {});
    }
    await logAction(r.userId, r.adminEmail, "SEND_BIRTHDAY_NOTIFICATION", "notification", notifId, { sentCount: birthdayUsers.length, channel });
    res.json({ success: true, sentCount: birthdayUsers.length, todayCount: birthdayUsers.length });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// GET /api/admin/notifications/birthday-count
router.get("/notifications/birthday-count", adminMiddleware, async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const r = await db.execute(sql`
      SELECT COUNT(*) as c FROM users
      WHERE dob IS NOT NULL AND EXTRACT(MONTH FROM dob::date) = ${parseInt(mm)} AND EXTRACT(DAY FROM dob::date) = ${parseInt(dd)}
      AND is_suspended = false
    `).catch(() => null);
    res.json({ count: Number(toRows(r)[0]?.c ?? 0) });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// POST /api/admin/notifications/smart/:trigger
router.post("/notifications/smart/:trigger", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { trigger } = req.params;
    const r = req as AR;
    let targets: any[] = [];
    let title = "";
    let message = "";
    if (trigger === "inactive") {
      const result = await db.execute(sql`
        SELECT DISTINCT u.id, u.name FROM users u
        WHERE u.is_suspended = false AND u.is_admin = false
        AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.customer_id = u.id AND b.created_at > NOW() - INTERVAL '7 days')
        LIMIT 500
      `).catch(() => null);
      targets = toRows(result);
      title = "👋 We miss you on RentZilla!";
      message = "It's been a while! Browse the latest cars, equipment and services available near you. Special deals await!";
    } else if (trigger === "abandoned") {
      const result = await db.execute(sql`
        SELECT DISTINCT u.id, u.name FROM users u
        JOIN bookings b ON b.customer_id = u.id
        WHERE b.status IN ('pending', 'cancelled') AND u.is_suspended = false LIMIT 500
      `).catch(() => null);
      targets = toRows(result);
      title = "🛒 Complete your booking on RentZilla!";
      message = "You left a booking incomplete. Finish it now and get instant confirmation at the best rates!";
    } else if (trigger === "highintent") {
      const result = await db.execute(sql`
        SELECT u.id, u.name FROM users u
        JOIN bookings b ON b.customer_id = u.id
        WHERE u.is_suspended = false
        GROUP BY u.id, u.name HAVING COUNT(b.id) >= 3 LIMIT 500
      `).catch(() => null);
      targets = toRows(result);
      title = "⭐ Exclusive offer for our loyal customers!";
      message = "Thank you for being a frequent renter! Enjoy premium listings and priority support on your next booking.";
    } else if (trigger === "newlisting") {
      targets = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
        .where(sql`${usersTable.role} = 'customer' AND ${usersTable.isSuspended} = false`).limit(500);
      title = "🆕 Fresh listings just added near you!";
      message = "New cars, equipment and services have just been added in your area. Check them out now!";
    }
    if (!targets.length) { res.json({ success: true, sentCount: 0 }); return; }
    const notifId = genId();
    await db.execute(sql`
      INSERT INTO admin_notifications (id, title, message, target_role, type, status, sent_count, created_by)
      VALUES (${notifId}, ${title}, ${message}, 'all', 'admin', 'sent', ${targets.length}, ${r.userId})
    `);
    const chunks: any[][] = [];
    for (let i = 0; i < targets.length; i += 100) chunks.push(targets.slice(i, i + 100));
    for (const chunk of chunks) {
      const vals = chunk.map((u: any) => `('${genId()}', '${u.id}', '${title.replace(/'/g, "''")}', '${message.replace(/'/g, "''")}', false, NOW())`).join(",");
      await db.execute(sql.raw(`INSERT INTO notifications (id, user_id, title, message, is_read, created_at) VALUES ${vals}`)).catch(() => {});
    }
    await logAction(r.userId, r.adminEmail, "SMART_NOTIFICATION", "notification", notifId, { trigger, sentCount: targets.length });
    res.json({ success: true, sentCount: targets.length });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// GET /api/admin/notifications/history
router.get("/notifications/history", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const notifsR = await db.execute(sql`
      SELECT n.*, u.email as creator_email, u.name as creator_name
      FROM admin_notifications n
      LEFT JOIN users u ON u.id = n.created_by
      ORDER BY n.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `);
    const notifs = toRows(notifsR);
    const notifTotalR = await db.execute(sql`SELECT COUNT(*) as c FROM admin_notifications`).catch(() => null);
    const notifTotal = toRows(notifTotalR);
    res.json({ notifications: notifs, total: Number(notifTotal[0]?.c ?? 0) });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// ── Activity Feed (live bell) ─────────────────────────────────────────────────
router.get("/activity/feed", adminMiddleware, async (_req: Request, res: Response) => {
  try {
    // New bookings in last 24h
    const bookingsR = await db.execute(sql`
      SELECT b.id, b.status, b.total_amount, b.created_at,
             u.name AS customer_name, l.title AS listing_title, l.category
      FROM bookings b
      LEFT JOIN users u ON u.id = b.customer_id
      LEFT JOIN listings l ON l.id = b.listing_id
      WHERE b.created_at > NOW() - INTERVAL '24 hours'
      ORDER BY b.created_at DESC LIMIT 20
    `).catch(() => null);

    // New users in last 24h
    const usersR = await db.execute(sql`
      SELECT id, name, email, role, created_at
      FROM users WHERE created_at > NOW() - INTERVAL '24 hours'
      AND is_admin = false
      ORDER BY created_at DESC LIMIT 10
    `).catch(() => null);

    // New reports in last 24h
    const reportsR = await db.execute(sql`
      SELECT r.id, r.reason, r.status, r.created_at,
             u.name AS reporter_name
      FROM reports r
      LEFT JOIN users u ON u.id = r.reporter_id
      WHERE r.created_at > NOW() - INTERVAL '24 hours'
      ORDER BY r.created_at DESC LIMIT 10
    `).catch(() => null);

    // Pending document verifications
    const docsR = await db.execute(sql`
      SELECT dv.id, dv.doc_type, dv.status, dv.created_at,
             u.name AS user_name
      FROM document_verifications dv
      LEFT JOIN users u ON u.id = dv.user_id
      WHERE dv.status = 'pending'
      ORDER BY dv.created_at DESC LIMIT 10
    `).catch(() => null);

    // Merge and sort by time
    const items: any[] = [];

    for (const b of toRows(bookingsR)) {
      items.push({
        id: `booking-${b.id}`,
        type: "booking",
        icon: "calendar",
        title: `New booking from ${b.customer_name || "a customer"}`,
        sub: `₹${Number(b.total_amount || 0).toLocaleString("en-IN")} · ${b.category || "listing"} · ${b.listing_title || ""}`,
        status: b.status,
        href: "/bookings",
        createdAt: b.created_at,
      });
    }

    for (const u of toRows(usersR)) {
      items.push({
        id: `user-${u.id}`,
        type: "user",
        icon: "user",
        title: `${u.name || "New user"} signed up`,
        sub: `${u.role} · ${u.email || ""}`,
        href: "/users",
        createdAt: u.created_at,
      });
    }

    for (const r of toRows(reportsR)) {
      items.push({
        id: `report-${r.id}`,
        type: "report",
        icon: "alert",
        title: `Safety report filed`,
        sub: `By ${r.reporter_name || "user"} · ${r.reason || ""}`,
        status: r.status,
        href: "/reports",
        createdAt: r.created_at,
      });
    }

    for (const d of toRows(docsR)) {
      items.push({
        id: `doc-${d.id}`,
        type: "document",
        icon: "file",
        title: `Document pending review`,
        sub: `${d.user_name || "User"} · ${d.doc_type || "document"}`,
        href: "/documents",
        createdAt: d.created_at,
      });
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const trimmed = items.slice(0, 25);

    // Items in the last 15 minutes count as "fresh/new"
    const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
    const freshCount = trimmed.filter(i => new Date(i.createdAt).getTime() > fifteenMinsAgo).length;

    res.json({ items: trimmed, totalCount: trimmed.length, freshCount });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// ── Admin Logs ────────────────────────────────────────────────────────────────
router.get("/logs", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "50" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const logsR = await db.execute(sql`SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`);
    const logs = toRows(logsR);
    const logsTotalR = await db.execute(sql`SELECT COUNT(*) as c FROM admin_logs`).catch(() => null);
    const logsTotal = toRows(logsTotalR);
    res.json({ logs, total: Number(logsTotal[0]?.c ?? 0) });
  } catch { res.status(500).json({ error: "Internal server error" }); }
});

// ── Provider Price Reference ───────────────────────────────────────────────────
router.get("/provider-prices", adminMiddleware, async (req: Request, res: Response) => {
  noCache(res);
  try {
    const { category, subcategory, sort = "date_desc", search = "" } = req.query as any;

    let orderBy = "ppr.created_at DESC";
    if (sort === "price_asc")  orderBy = "ppr.provider_price ASC";
    if (sort === "price_desc") orderBy = "ppr.provider_price DESC";
    if (sort === "diff_asc")   orderBy = "ABS(ppr.difference_percent) ASC";
    if (sort === "diff_desc")  orderBy = "ABS(ppr.difference_percent) DESC";
    if (sort === "date_asc")   orderBy = "ppr.created_at ASC";

    const categoryFilter = category && category !== "all" ? `AND ppr.category = '${category}'` : "";
    const subcategoryFilter = subcategory && subcategory !== "all" ? `AND ppr.subcategory = '${subcategory}'` : "";
    const searchFilter = search
      ? `AND (ppr.provider_name ILIKE '%${search}%' OR ppr.subcategory ILIKE '%${search}%')`
      : "";

    const rows = toRows(await db.execute(sql.raw(`
      SELECT
        ppr.*,
        pr.commission_percent
      FROM provider_price_reference ppr
      LEFT JOIN pricing_rules pr ON pr.category = ppr.category AND pr.subcategory = ppr.subcategory
      WHERE 1=1 ${categoryFilter} ${subcategoryFilter} ${searchFilter}
      ORDER BY ${orderBy}
      LIMIT 200
    `)));

    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/provider-price-insights", adminMiddleware, async (_req: Request, res: Response) => {
  noCache(res);
  try {
    const rows = toRows(await db.execute(sql`
      SELECT
        category,
        subcategory,
        COUNT(*) as count,
        ROUND(AVG(provider_price)::numeric, 2) as avg_price,
        MAX(provider_price) as max_price,
        MIN(provider_price) as min_price,
        ROUND(AVG(admin_price_snapshot)::numeric, 2) as avg_admin_price,
        ROUND(AVG(difference_percent)::numeric, 2) as avg_diff_pct
      FROM provider_price_reference
      WHERE provider_price > 0
      GROUP BY category, subcategory
      ORDER BY category, subcategory
    `));

    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Platform Settings ─────────────────────────────────────────────────────────
const platformSettings = { baseFare: 50, perKmRate: 12, surgeMultiplier: 1.0, commissionPercent: 15, instantBookingEnabled: true, scheduledRidesEnabled: true, carsEnabled: true, equipmentEnabled: true, servicesEnabled: true };
router.get("/settings", adminMiddleware, (_req, res) => res.json(platformSettings));
router.patch("/settings", adminMiddleware, (req, res) => { Object.assign(platformSettings, req.body); res.json({ success: true, settings: platformSettings }); });

// ── Promo Codes ───────────────────────────────────────────────────────────────
function promoRows(result: any) {
  if (Array.isArray(result)) return result;
  return result?.rows ?? [];
}

router.get("/promo-codes", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const rows = promoRows(await db.execute(sql`
      SELECT * FROM promo_codes ORDER BY created_at DESC
    `));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Get promo codes error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/promo-codes", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { code, type, value, minOrder, maxUses, description, expiresAt } = req.body;
    const adminId = (req as any).adminId || "admin";
    if (!code || !type || value == null) {
      res.status(400).json({ error: "code, type, and value are required" });
      return;
    }
    if (!["percent", "fixed"].includes(type)) {
      res.status(400).json({ error: "type must be 'percent' or 'fixed'" });
      return;
    }
    if (type === "percent" && (Number(value) < 1 || Number(value) > 100)) {
      res.status(400).json({ error: "Percent value must be between 1 and 100" });
      return;
    }
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
    await db.execute(sql`
      INSERT INTO promo_codes (id, code, type, value, min_order, max_uses, description, expires_at, created_by)
      VALUES (
        ${id}, ${code.toUpperCase()}, ${type}, ${Number(value)},
        ${Number(minOrder || 0)}, ${Number(maxUses || 100)},
        ${description || null},
        ${expiresAt ? new Date(expiresAt) : null},
        ${adminId}
      )
    `);
    const rows = promoRows(await db.execute(sql`SELECT * FROM promo_codes WHERE id = ${id}`));
    res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err?.message?.includes("unique") || err?.code === "23505") {
      res.status(409).json({ error: "A promo code with this name already exists" });
      return;
    }
    req.log.error({ err }, "Create promo code error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/promo-codes/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { isActive, maxUses, expiresAt, description, value, minOrder } = req.body;
    await db.execute(sql`
      UPDATE promo_codes SET
        is_active = COALESCE(${isActive != null ? isActive : null}, is_active),
        max_uses = COALESCE(${maxUses != null ? Number(maxUses) : null}, max_uses),
        expires_at = COALESCE(${expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : undefined}, expires_at),
        description = COALESCE(${description !== undefined ? description : null}, description),
        value = COALESCE(${value != null ? Number(value) : null}, value),
        min_order = COALESCE(${minOrder != null ? Number(minOrder) : null}, min_order)
      WHERE id = ${req.params.id}
    `);
    const rows = promoRows(await db.execute(sql`SELECT * FROM promo_codes WHERE id = ${req.params.id}`));
    if (rows.length === 0) { res.status(404).json({ error: "Promo code not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "Update promo code error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/promo-codes/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    await db.execute(sql`DELETE FROM promo_codes WHERE id = ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete promo code error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
