import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function genId() { return Date.now().toString() + Math.random().toString(36).slice(2, 9); }

function toRows<T = any>(result: any): T[] {
  if (Array.isArray(result)) return result as T[];
  return (result?.rows ?? []) as T[];
}

const SUPER_ADMIN_EMAILS = [
  "admin1@rentzilla.com",
  "admin2@rentzilla.com",
  "admin3@rentzilla.com",
  "admin@rentzilla.com",
];

async function adminMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const token = auth.replace("Bearer ", "");
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const userId = decoded.split(":")[0];
    if (!userId) { res.status(401).json({ error: "Invalid token" }); return; }
    const rows = toRows(await db.execute(sql`SELECT id, email FROM users WHERE id = ${userId}`));
    const user = rows[0];
    if (!user || !SUPER_ADMIN_EMAILS.includes(user.email)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    (req as any).userId = userId;
    (req as any).adminEmail = user.email;
    next();
  } catch {
    res.status(500).json({ error: "Auth error" });
  }
}

// ── GET /pricing/admin/rules — get all pricing rules ──────────────────────────
router.get("/admin/rules", adminMiddleware, async (req: Request, res: Response) => {
  noCache(res);
  try {
    const rows = toRows(await db.execute(sql`
      SELECT * FROM pricing_rules ORDER BY category, subcategory
    `));
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /pricing/admin/rules — upsert a pricing rule ────────────────────────
router.post("/admin/rules", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const ar = req as any;
    const {
      category, subcategory,
      base_fee = 0, hourly_rate = 0, daily_rate = 0,
      km_rate = 0, operator_fee = 0, fuel_fee = 0,
      material_fee = 0, urgency_fee = 0, delivery_fee = 0,
      platform_fee = 0, commission_percent = 10, security_deposit = 0,
    } = req.body;

    if (!category || !subcategory) {
      res.status(400).json({ error: "category and subcategory are required" }); return;
    }

    // Validate no negative values
    const numFields = [base_fee, hourly_rate, daily_rate, km_rate, operator_fee, fuel_fee, material_fee, urgency_fee, delivery_fee, platform_fee, commission_percent, security_deposit];
    if (numFields.some((v: number) => Number(v) < 0)) {
      res.status(400).json({ error: "Pricing values cannot be negative" }); return;
    }

    const existing = toRows(await db.execute(sql`
      SELECT id FROM pricing_rules WHERE category = ${category} AND subcategory = ${subcategory}
    `));

    if (existing.length > 0) {
      await db.execute(sql`
        UPDATE pricing_rules SET
          base_fee = ${base_fee}, hourly_rate = ${hourly_rate}, daily_rate = ${daily_rate},
          km_rate = ${km_rate}, operator_fee = ${operator_fee}, fuel_fee = ${fuel_fee},
          material_fee = ${material_fee}, urgency_fee = ${urgency_fee},
          delivery_fee = ${delivery_fee}, platform_fee = ${platform_fee},
          commission_percent = ${commission_percent}, security_deposit = ${security_deposit},
          updated_by = ${ar.adminEmail}, updated_at = NOW()
        WHERE category = ${category} AND subcategory = ${subcategory}
      `);
    } else {
      const id = genId();
      await db.execute(sql`
        INSERT INTO pricing_rules
          (id, category, subcategory, base_fee, hourly_rate, daily_rate, km_rate,
           operator_fee, fuel_fee, material_fee, urgency_fee, delivery_fee,
           platform_fee, commission_percent, security_deposit, updated_by, updated_at)
        VALUES
          (${id}, ${category}, ${subcategory}, ${base_fee}, ${hourly_rate}, ${daily_rate},
           ${km_rate}, ${operator_fee}, ${fuel_fee}, ${material_fee}, ${urgency_fee},
           ${delivery_fee}, ${platform_fee}, ${commission_percent}, ${security_deposit},
           ${ar.adminEmail}, NOW())
      `);
    }

    const result = toRows(await db.execute(sql`
      SELECT * FROM pricing_rules WHERE category = ${category} AND subcategory = ${subcategory}
    `));
    res.json(result[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Shared helper: disable all caching on pricing responses ──────────────────
function noCache(res: Response) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.removeHeader("ETag");
  res.removeHeader("Last-Modified");
}

// ── GET /pricing/rides — public: per-vehicle pricing for the Cars tab ─────────
// Returns base fare + per-km rate for each vehicle type (Bike/Auto/Car/SUV/Van)
// from pricing_rules (category='cars'). Falls back to defaults if no rule set.
const RIDE_FALLBACKS: Record<string, { baseFare: number; perKm: number }> = {
  Bike: { baseFare: 30, perKm: 6 },
  Auto: { baseFare: 40, perKm: 8 },
  Car:  { baseFare: 50, perKm: 12 },
  SUV:  { baseFare: 70, perKm: 16 },
  Van:  { baseFare: 90, perKm: 20 },
};

router.get("/rides", async (req: Request, res: Response) => {
  noCache(res);
  try {
    const rows = toRows(await db.execute(sql`
      SELECT subcategory, base_fee, km_rate, platform_fee, commission_percent
      FROM pricing_rules
      WHERE category = 'cars'
    `));

    // Build a map from DB rows, keyed by subcategory (vehicle type)
    const pricing: Record<string, { baseFare: number; perKm: number; platformFee: number; commissionPercent: number }> = {};
    for (const r of rows) {
      pricing[r.subcategory] = {
        baseFare: Number(r.base_fee) || RIDE_FALLBACKS[r.subcategory]?.baseFare || 50,
        perKm: Number(r.km_rate) || RIDE_FALLBACKS[r.subcategory]?.perKm || 12,
        platformFee: Number(r.platform_fee) || 0,
        commissionPercent: Number(r.commission_percent) || 10,
      };
    }

    // Fill in any missing vehicle types with fallbacks
    for (const [type, fallback] of Object.entries(RIDE_FALLBACKS)) {
      if (!pricing[type]) {
        pricing[type] = { ...fallback, platformFee: 0, commissionPercent: 10 };
      }
    }

    res.json(pricing);
  } catch (e: any) {
    // On error, always return the fallback pricing so the app still works
    const fallback = Object.fromEntries(
      Object.entries(RIDE_FALLBACKS).map(([k, v]) => [k, { ...v, platformFee: 0, commissionPercent: 10 }])
    );
    res.json(fallback);
  }
});

// ── GET /pricing/calculate — public price calculator ─────────────────────────
router.get("/calculate", async (req: Request, res: Response) => {
  noCache(res);
  try {
    const { category, subcategory, hours = "1", days = "1", distance_km = "0" } = req.query as any;

    if (!category || !subcategory) {
      res.status(400).json({ error: "category and subcategory are required" }); return;
    }

    const rows = toRows(await db.execute(sql`
      SELECT * FROM pricing_rules WHERE category = ${category} AND subcategory = ${subcategory}
    `));

    if (rows.length === 0) {
      res.json({ customer_price: 0, provider_payout: 0, app_commission: 0, found: false });
      return;
    }

    const r = rows[0];
    const h = Number(hours);
    const d = Number(days);
    const km = Number(distance_km);

    let customer_price = 0;

    if (category === "equipment") {
      customer_price =
        (d > 0 ? Number(r.daily_rate) * d : Number(r.hourly_rate) * h) +
        Number(r.delivery_fee) +
        Number(r.fuel_fee) +
        Number(r.operator_fee) +
        Number(r.platform_fee);
    } else {
      // services / professions
      customer_price =
        Number(r.base_fee) +
        Number(r.hourly_rate) * h +
        Number(r.material_fee) +
        Number(r.km_rate) * km +
        Number(r.urgency_fee) +
        Number(r.platform_fee);
    }

    const commission_percent = Number(r.commission_percent);
    const app_commission = Math.round(customer_price * commission_percent / 100);
    const provider_payout = Math.round(customer_price - app_commission);

    res.json({
      found: true,
      customer_price: Math.round(customer_price),
      provider_payout,
      app_commission,
      commission_percent,
      security_deposit: Number(r.security_deposit),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
