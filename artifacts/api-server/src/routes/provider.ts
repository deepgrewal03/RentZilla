import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router: IRouter = Router();
type AR = Request & { userId: string };

router.get("/summary", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    // Only users with provider or both role can access provider dashboard
    const roleResult = await db.execute(sql`SELECT role FROM users WHERE id = ${userId} LIMIT 1`);
    const userRole = (roleResult as any)?.rows?.[0]?.role;
    if (!userRole || !['provider', 'both'].includes(userRole)) {
      res.status(403).json({ error: "Provider access required" });
      return;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();
    const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();

    const [earningsRes, thisMonthRes, lastMonthRes, bookingsRes, listingsRes, ridesRes, todayRidesRes] = await Promise.all([
      // All-time earnings from rental bookings
      db.execute(`
        SELECT COALESCE(SUM(total_amount), 0) as total
        FROM bookings
        WHERE provider_id = '${userId}' AND status = 'completed'
      `),
      // This month's rental earnings
      db.execute(`
        SELECT COALESCE(SUM(total_amount), 0) as total
        FROM bookings
        WHERE provider_id = '${userId}' AND status = 'completed'
        AND created_at >= '${monthStart}'
      `),
      // Last month's rental earnings
      db.execute(`
        SELECT COALESCE(SUM(total_amount), 0) as total
        FROM bookings
        WHERE provider_id = '${userId}' AND status = 'completed'
        AND created_at >= '${lastMonthStart}' AND created_at <= '${lastMonthEnd}'
      `),
      // Booking counts
      db.execute(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'confirmed') as active,
          COUNT(DISTINCT customer_id) as customers
        FROM bookings
        WHERE provider_id = '${userId}'
      `),
      // Listing count
      db.execute(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_available = true) as active
        FROM listings
        WHERE provider_id = '${userId}'
      `),
      // Completed ride count and earnings
      db.execute(`
        SELECT
          COUNT(*) as total_trips,
          COALESCE(SUM(fare), 0) as ride_earnings
        FROM rides
        WHERE driver_id = '${userId}' AND status = 'completed'
      `),
      // Today's ride earnings
      db.execute(`
        SELECT COALESCE(SUM(fare), 0) as today_earnings
        FROM rides
        WHERE driver_id = '${userId}' AND status = 'completed'
        AND completed_at >= '${todayStart}'
      `),
    ]);

    const rentalEarnings = Number((earningsRes.rows as any[])[0]?.total ?? 0);
    const thisMonth = Number((thisMonthRes.rows as any[])[0]?.total ?? 0);
    const lastMonth = Number((lastMonthRes.rows as any[])[0]?.total ?? 0);
    const rideEarnings = Number((ridesRes.rows as any[])[0]?.ride_earnings ?? 0);
    const totalEarnings = rentalEarnings + rideEarnings;
    const growthPct = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : (thisMonth > 0 ? 100 : 0);

    const bStats = (bookingsRes.rows as any[])[0] ?? {};
    const lStats = (listingsRes.rows as any[])[0] ?? {};
    const rStats = (ridesRes.rows as any[])[0] ?? {};
    const todayEarnings = Number((todayRidesRes.rows as any[])[0]?.today_earnings ?? 0);

    res.json({
      earnings: {
        total: totalEarnings,
        rentalEarnings,
        rideEarnings,
        thisMonth,
        lastMonth,
        growthPct,
        todayRideEarnings: todayEarnings,
      },
      bookings: {
        total: Number(bStats.total ?? 0),
        pending: Number(bStats.pending ?? 0),
        active: Number(bStats.active ?? 0),
        customers: Number(bStats.customers ?? 0),
      },
      listings: {
        total: Number(lStats.total ?? 0),
        active: Number(lStats.active ?? 0),
      },
      rides: {
        totalTrips: Number(rStats.total_trips ?? 0),
        todayEarnings,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Provider summary error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Quick check: does this provider have any car listings?
router.get("/has-cars", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const result = await db.execute(`
      SELECT COUNT(*) as count
      FROM listings
      WHERE provider_id = '${userId}' AND category = 'cars'
    `);
    const count = Number((result.rows as any[])[0]?.count ?? 0);
    res.json({ hasCars: count > 0, count });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Recent bookings for provider (last 10)
router.get("/recent-bookings", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const result = await db.execute(`
      SELECT
        b.id, b.status, b.total_amount, b.final_amount, b.service_fee,
        b.extra_charges, b.service_type, b.start_date, b.end_date,
        b.total_days, b.created_at,
        l.title as listing_title, l.images as listing_images,
        u.name as customer_name, u.phone as customer_phone, u.email as customer_email
      FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      JOIN users u ON u.id = b.customer_id
      WHERE b.provider_id = '${userId}'
      ORDER BY b.created_at DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /provider/price-reference — save provider's expected price ────────────
router.post("/price-reference", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { category, subcategory, listing_id, provider_price } = req.body;

    if (!category || !subcategory || provider_price === undefined) {
      res.status(400).json({ error: "category, subcategory, and provider_price are required" }); return;
    }
    if (Number(provider_price) < 0) {
      res.status(400).json({ error: "Price cannot be negative" }); return;
    }

    // Get provider name
    const userRows: any[] = (await db.execute(sql`SELECT name FROM users WHERE id = ${userId}`)).rows as any[];
    const providerName = userRows[0]?.name ?? "Unknown";

    // Fetch admin price snapshot if it exists
    const priceRows: any[] = (await db.execute(sql`
      SELECT platform_fee, commission_percent, base_fee, hourly_rate, daily_rate
      FROM pricing_rules WHERE category = ${category} AND subcategory = ${subcategory}
    `)).rows as any[];
    const pr = priceRows[0];
    let adminPriceSnapshot = 0;
    if (pr) {
      if (category === "equipment") {
        adminPriceSnapshot = Number(pr.daily_rate) + Number(pr.delivery_fee ?? 0) + Number(pr.fuel_fee ?? 0) + Number(pr.operator_fee ?? 0) + Number(pr.platform_fee);
      } else {
        adminPriceSnapshot = Number(pr.base_fee) + Number(pr.hourly_rate) + Number(pr.platform_fee);
      }
    }

    const pPrice = Number(provider_price);
    const diffPct = adminPriceSnapshot > 0
      ? Math.round(((pPrice - adminPriceSnapshot) / adminPriceSnapshot) * 10000) / 100
      : 0;

    const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
    await db.execute(sql`
      INSERT INTO provider_price_reference
        (id, provider_id, provider_name, listing_id, category, subcategory, provider_price, admin_price_snapshot, difference_percent, created_at)
      VALUES
        (${id}, ${userId}, ${providerName}, ${listing_id ?? null}, ${category}, ${subcategory}, ${pPrice}, ${adminPriceSnapshot}, ${diffPct}, NOW())
    `);

    res.json({ success: true, id, difference_percent: diffPct });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
