import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  listingsTable,
  bookingsTable,
  reportsTable,
} from "@workspace/db";
import { eq, desc, sql, and, like, count, sum, ne } from "drizzle-orm";

const router: IRouter = Router();
type AR = Request & { userId: string; isAdmin: boolean };

// ── Admin Auth Middleware ────────────────────────────────────────────────────
async function adminMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const token = auth.replace("Bearer ", "");
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const userId = decoded.split(":")[0];
    if (!userId) { res.status(401).json({ error: "Invalid token" }); return; }

    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!users.length || !users[0].isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    (req as AR).userId = userId;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// ── Admin Login ─────────────────────────────────────────────────────────────
// POST /api/admin/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }
    const bcrypt = await import("bcryptjs");
    const users = await db.select().from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!users.length) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const user = users[0];
    if (!user.isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    if (!user.passwordHash) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString("base64");
    res.json({
      token,
      admin: {
        id: user.id,
        name: user.name || `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
      },
    });
  } catch (err) {
    req.log?.error({ err }, "Admin login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Dashboard Stats ──────────────────────────────────────────────────────────
// GET /api/admin/dashboard
router.get("/dashboard", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const [
      totalUsersResult,
      totalProvidersResult,
      totalListingsResult,
      totalBookingsResult,
      pendingBookingsResult,
      completedBookingsResult,
      cancelledBookingsResult,
      revenueResult,
      pendingDocsResult,
      reportsResult,
      recentUsersResult,
      recentBookingsResult,
    ] = await Promise.all([
      db.select({ c: count() }).from(usersTable),
      db.select({ c: count() }).from(usersTable).where(eq(usersTable.role, "provider")),
      db.select({ c: count() }).from(listingsTable),
      db.select({ c: count() }).from(bookingsTable),
      db.select({ c: count() }).from(bookingsTable).where(eq(bookingsTable.status, "pending")),
      db.select({ c: count() }).from(bookingsTable).where(eq(bookingsTable.status, "completed")),
      db.select({ c: count() }).from(bookingsTable).where(eq(bookingsTable.status, "cancelled")),
      db.select({ total: sum(bookingsTable.totalAmount) }).from(bookingsTable)
        .where(eq(bookingsTable.paymentStatus, "paid")),
      db.execute(sql`SELECT COUNT(*) as c FROM documents WHERE status = 'pending'`).catch(() => [{ c: 0 }]),
      db.select({ c: count() }).from(reportsTable).where(eq(reportsTable.status, "pending")),
      db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(5),
      db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt)).limit(5),
    ]);

    const totalUsers = Number(totalUsersResult[0]?.c ?? 0);
    const totalProviders = Number(totalProvidersResult[0]?.c ?? 0);
    const totalListings = Number(totalListingsResult[0]?.c ?? 0);
    const totalBookings = Number(totalBookingsResult[0]?.c ?? 0);
    const pendingBookings = Number(pendingBookingsResult[0]?.c ?? 0);
    const completedBookings = Number(completedBookingsResult[0]?.c ?? 0);
    const cancelledBookings = Number(cancelledBookingsResult[0]?.c ?? 0);
    const totalRevenue = Number(revenueResult[0]?.total ?? 0);
    const pendingDocs = Number((pendingDocsResult as any)[0]?.c ?? 0);
    const pendingReports = Number(reportsResult[0]?.c ?? 0);

    // Fake daily earnings for chart (last 7 days)
    const now = new Date();
    const dailyEarnings = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      return {
        date: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        amount: Math.round(Math.random() * 8000 + 2000),
      };
    });

    res.json({
      stats: {
        totalUsers,
        totalCustomers: totalUsers - totalProviders,
        totalProviders,
        totalListings,
        totalBookings,
        pendingBookings,
        completedBookings,
        cancelledBookings,
        totalRevenue,
        pendingDocs,
        pendingReports,
      },
      dailyEarnings,
      recentUsers: recentUsersResult.map(u => ({
        id: u.id,
        name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || u.phone,
        email: u.email,
        role: u.role,
        isAdmin: u.isAdmin,
        isSuspended: u.isSuspended,
        createdAt: u.createdAt.toISOString(),
      })),
      recentBookings: recentBookingsResult.map(b => ({
        id: b.id,
        status: b.status,
        totalAmount: b.totalAmount,
        paymentStatus: b.paymentStatus,
        createdAt: b.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log?.error({ err }, "Admin dashboard error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Users Management ─────────────────────────────────────────────────────────
// GET /api/admin/users?role=customer|provider&q=&page=1&limit=20
router.get("/users", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { role, q, page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db.select().from(usersTable).$dynamic();
    if (role) query = query.where(eq(usersTable.role, role as "customer" | "provider"));
    if (q) {
      const like_q = `%${q}%`;
      query = query.where(
        sql`(${usersTable.name} ILIKE ${like_q} OR ${usersTable.email} ILIKE ${like_q} OR ${usersTable.phone} ILIKE ${like_q})`
      );
    }
    const users = await query.orderBy(desc(usersTable.createdAt)).limit(parseInt(limit)).offset(offset);

    const totalResult = await db.select({ c: count() }).from(usersTable);
    const total = Number(totalResult[0]?.c ?? 0);

    res.json({
      users: users.map(u => ({
        id: u.id,
        name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.phone,
        email: u.email,
        phone: u.phone,
        role: u.role,
        location: u.location,
        profileImage: u.profileImage,
        isAdmin: u.isAdmin,
        isSuspended: u.isSuspended,
        adminNotes: u.adminNotes,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    req.log?.error({ err }, "Admin users list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/users/:id
router.get("/users/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const users = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }
    const u = users[0];

    const bookings = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.customerId, id))
      .orderBy(desc(bookingsTable.createdAt))
      .limit(10);

    const listings = await db.select().from(listingsTable)
      .where(eq(listingsTable.providerId, id))
      .orderBy(desc(listingsTable.createdAt))
      .limit(10);

    res.json({
      user: {
        id: u.id,
        name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.phone,
        email: u.email,
        phone: u.phone,
        role: u.role,
        location: u.location,
        profileImage: u.profileImage,
        isAdmin: u.isAdmin,
        isSuspended: u.isSuspended,
        adminNotes: u.adminNotes,
        createdAt: u.createdAt.toISOString(),
      },
      bookings: bookings.map(b => ({
        id: b.id,
        status: b.status,
        totalAmount: b.totalAmount,
        paymentStatus: b.paymentStatus,
        startDate: b.startDate,
        endDate: b.endDate,
        createdAt: b.createdAt.toISOString(),
      })),
      listings: listings.map(l => ({
        id: l.id,
        title: l.title,
        category: l.category,
        price: l.price,
        priceUnit: l.priceUnit,
        isAvailable: l.isAvailable,
        location: l.location,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/admin/users/:id  — suspend/unsuspend/add notes
router.patch("/users/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isSuspended, adminNotes, isAdmin } = req.body;
    const updates: Record<string, unknown> = {};
    if (typeof isSuspended === "boolean") updates.isSuspended = isSuspended;
    if (typeof adminNotes === "string") updates.adminNotes = adminNotes;
    if (typeof isAdmin === "boolean") updates.isAdmin = isAdmin;

    const updated = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    if (!updated.length) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ success: true, user: updated[0] });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Listings Management ──────────────────────────────────────────────────────
// GET /api/admin/listings?category=&q=&page=1&limit=20
router.get("/listings", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { category, q, page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db.select().from(listingsTable).$dynamic();
    if (category) query = query.where(eq(listingsTable.category, category as "cars" | "equipment" | "services"));
    if (q) query = query.where(sql`${listingsTable.title} ILIKE ${`%${q}%`}`);

    const listings = await query.orderBy(desc(listingsTable.createdAt)).limit(parseInt(limit)).offset(offset);
    const totalResult = await db.select({ c: count() }).from(listingsTable);
    const total = Number(totalResult[0]?.c ?? 0);

    res.json({
      listings: listings.map(l => ({
        id: l.id,
        providerId: l.providerId,
        title: l.title,
        category: l.category,
        subcategory: l.subcategory,
        price: l.price,
        priceUnit: l.priceUnit,
        location: l.location,
        isAvailable: l.isAvailable,
        images: l.images,
        createdAt: l.createdAt.toISOString(),
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/admin/listings/:id — toggle availability
router.patch("/listings/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;
    const updated = await db.update(listingsTable).set({ isAvailable }).where(eq(listingsTable.id, id)).returning();
    if (!updated.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/listings/:id
router.delete("/listings/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(listingsTable).where(eq(listingsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Bookings Management ──────────────────────────────────────────────────────
// GET /api/admin/bookings?status=&page=1&limit=20
router.get("/bookings", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db.select().from(bookingsTable).$dynamic();
    if (status) query = query.where(eq(bookingsTable.status, status as any));

    const bookings = await query.orderBy(desc(bookingsTable.createdAt)).limit(parseInt(limit)).offset(offset);
    const totalResult = await db.select({ c: count() }).from(bookingsTable);
    const total = Number(totalResult[0]?.c ?? 0);

    // Enrich with user/listing names
    const enriched = await Promise.all(bookings.map(async (b) => {
      const [customer, listing] = await Promise.all([
        db.select({ name: usersTable.name, email: usersTable.email })
          .from(usersTable).where(eq(usersTable.id, b.customerId)).limit(1),
        db.select({ title: listingsTable.title, category: listingsTable.category })
          .from(listingsTable).where(eq(listingsTable.id, b.listingId)).limit(1),
      ]);
      return {
        id: b.id,
        customerId: b.customerId,
        customerName: customer[0]?.name || "Unknown",
        customerEmail: customer[0]?.email,
        providerId: b.providerId,
        listingId: b.listingId,
        listingTitle: listing[0]?.title || "Unknown",
        listingCategory: listing[0]?.category,
        startDate: b.startDate,
        endDate: b.endDate,
        totalDays: b.totalDays,
        totalAmount: b.totalAmount,
        status: b.status,
        paymentStatus: b.paymentStatus,
        notes: b.notes,
        createdAt: b.createdAt.toISOString(),
      };
    }));

    res.json({ bookings: enriched, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/admin/bookings/:id — cancel booking
router.patch("/bookings/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await db.update(bookingsTable).set({ status }).where(eq(bookingsTable.id, id)).returning();
    if (!updated.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Reports / Safety ─────────────────────────────────────────────────────────
// GET /api/admin/reports?status=pending
router.get("/reports", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db.select().from(reportsTable).$dynamic();
    if (status) query = query.where(eq(reportsTable.status, status as any));

    const reports = await query.orderBy(desc(reportsTable.createdAt)).limit(parseInt(limit)).offset(offset);
    const totalResult = await db.select({ c: count() }).from(reportsTable);
    const total = Number(totalResult[0]?.c ?? 0);

    res.json({ reports, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/admin/reports/:id — update status
router.patch("/reports/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await db.update(reportsTable).set({ status }).where(eq(reportsTable.id, id)).returning();
    if (!updated.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Documents ─────────────────────────────────────────────────────────────────
// Proxy to documents route logic
router.get("/documents", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, serviceType, page = "1", limit = "30" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = sql`1=1`;
    if (status) whereClause = sql`${whereClause} AND d.status = ${status}`;
    if (serviceType) whereClause = sql`${whereClause} AND d.service_type = ${serviceType}`;

    const docs = await db.execute(sql`
      SELECT d.*, u.name as user_name, u.email as user_email
      FROM documents d
      LEFT JOIN users u ON u.id = d.user_id
      WHERE ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `).catch(() => []);

    const totalResult = await db.execute(sql`SELECT COUNT(*) as c FROM documents WHERE 1=1`).catch(() => [{ c: 0 }]);
    const total = Number((totalResult as any)[0]?.c ?? 0);

    res.json({ documents: docs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/admin/documents/:id — approve/reject
router.patch("/documents/:id", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    await db.execute(sql`
      UPDATE documents SET status = ${status}, rejection_reason = ${rejectionReason || null}
      WHERE id = ${id}
    `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Platform Settings ─────────────────────────────────────────────────────────
// GET /api/admin/settings
const platformSettings = {
  baseFare: 50,
  perKmRate: 12,
  surgeMultiplier: 1.0,
  commissionPercent: 15,
  instantBookingEnabled: true,
  scheduledRidesEnabled: true,
  carsEnabled: true,
  equipmentEnabled: true,
  servicesEnabled: true,
};

router.get("/settings", adminMiddleware, (_req: Request, res: Response) => {
  res.json(platformSettings);
});

router.patch("/settings", adminMiddleware, (req: Request, res: Response) => {
  Object.assign(platformSettings, req.body);
  res.json({ success: true, settings: platformSettings });
});

export default router;
