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

// ── GET /pricing/calculate — public price calculator ─────────────────────────
router.get("/calculate", async (req: Request, res: Response) => {
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
