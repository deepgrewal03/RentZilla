import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { usersTable } from "@workspace/db/schema";
import { isRetiredCategory } from "../lib/retiredCategories";

const router = Router();
router.use((req, res, next) => {
  if (isRetiredCategory(req.query.subcategory) || isRetiredCategory(req.body?.subcategory)) {
    res.status(410).json({ error: "This equipment or service type is no longer offered" }); return;
  }
  next();
});

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
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = users[0];
    if (!user || !user.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    if (user.email && !SUPER_ADMIN_EMAILS.includes(user.email)) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    (req as any).userId = userId;
    (req as any).adminEmail = user.email ?? "unknown";
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
    res.json(rows.filter(row => !isRetiredCategory(row.subcategory)));
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

// ── Static service-type map (subcategory → service types) ────────────────────
const SERVICE_TYPE_MAP: Record<string, string[]> = {
  // ── Services ──────────────────────────────────────────────────────────────
  "Plumbing":     ["Pipe Repair & Leak Fix", "Bathroom Fitting & Installation", "Kitchen Sink & Tap Repair", "Drain & Sewer Cleaning", "Water Tank Service", "Emergency Plumbing Call"],
  "Electrician":  ["Electrical Wiring", "Panel & Board Repair", "Light & Fan Install", "AC Wiring", "Fault Diagnosis", "Safety Inspection"],
  "Beauty":       ["Professional Hair Styling", "Facial & Skin Treatment", "Waxing Services", "Nail Care & Art", "Bridal Makeup", "Beauty Consultation"],
  "Carpenter":    ["Furniture Making & Repair", "Door & Window Fitting", "Cabinet & Wardrobe Work", "Wooden Flooring", "Roof & Framework", "Custom Woodwork"],
  "AC Repair":    ["AC Installation", "AC Service & Gas Fill", "Deep Cleaning", "AC Repair", "Split AC Fitting", "Central AC Maintenance"],
  // ── Professions ───────────────────────────────────────────────────────────
  "Doctor (Home Visit)": ["General Consultation", "Paediatric Visit", "Elderly Care Visit", "Post-Surgery Follow-up", "Prescription Renewal", "Emergency Home Visit"],
  "Lawyer":              ["Legal Consultation", "Property & Land Dispute", "Civil Case Representation", "Family & Divorce Law", "Contract Drafting & Review", "Criminal Defense"],
  "Accountant":          ["Tax Filing & Returns", "GST Registration & Filing", "Bookkeeping & Accounts", "Business Audit", "Payroll Management", "Financial Planning"],
  "Tutor":               ["School Subject Tutoring", "Competitive Exam Prep", "English Language Classes", "Maths & Science Coaching", "Online Live Sessions", "Home Visit Tutoring"],
  "Photographer":        ["Wedding Photography", "Product & Commercial Shoot", "Portrait Session", "Event Coverage", "Real Estate Photography", "Passport / ID Photos"],
  "Event Manager":       ["Wedding Planning", "Corporate Event", "Birthday Party Setup", "Theme Decoration", "Catering Coordination", "Full Event Management"],
  "Nutritionist":        ["Diet Plan & Consultation", "Weight Loss Programme", "Sports Nutrition", "Diabetic / Clinical Diet", "Online Follow-up Session", "Meal Planning"],
  "Yoga Trainer":        ["Morning Yoga Session", "Therapeutic Yoga", "Prenatal Yoga", "Yoga for Kids", "Online Live Class", "Corporate Wellness Session"],
  // ── Equipment ─────────────────────────────────────────────────────────────
  "Tractor":      ["Ploughing Service", "Sowing & Seeding", "Crop Harvesting", "Land Levelling", "Rotavation", "Multi-Day Farm Work"],
  "Harvester":    ["Wheat Harvesting", "Rice Harvesting", "Crop Cutting", "Threshing & Bundling", "Field Clearance", "Multi-Crop Harvest"],
  "Rotavator":    ["Soil Preparation", "Field Rotavation", "Seedbed Preparation", "Stubble Management", "Inter-Row Cultivation", "Multi-Day Rotavation"],
  "Plough":       ["Deep Ploughing", "Disc Ploughing", "Field Preparation", "Subsoil Breaking", "Irrigation Channels", "Multi-Day Ploughing"],
  "Cultivator":   ["Soil Aeration", "Weed Control", "Pre-Sowing Cultivation", "Inter-Row Cultivation", "Field Levelling", "Stubble Incorporation"],
  "JCB":          ["Excavation Work", "Foundation Digging", "Land Clearing", "Trench Digging", "Loading & Transport", "Demolition Assist"],
  "Excavator":    ["Excavation Work", "Foundation Digging", "Land Clearing", "Trench Digging", "Loading & Transport", "Demolition Assist"],
  "Poclain":      ["Heavy Excavation", "Foundation Digging", "Rock Cutting", "Trench Work", "Canal Digging", "Deep Earth Moving"],
  "Chhota Hathi": ["Local Goods Transport", "House Shifting", "Market Delivery", "Construction Material", "Agricultural Produce", "Short Distance Haul"],
  "Loader":       ["Material Loading", "Bulk Handling", "Site Cleanup", "Loading & Unloading", "Agricultural Loading", "Construction Material"],
  "Backhoe":      ["Trenching", "Foundation Digging", "Pipe Laying", "Land Clearing", "Drainage Work", "Excavation Work"],
  "Roller":       ["Road Compaction", "Soil Compaction", "Site Levelling", "Asphalt Rolling", "Agricultural Land Compaction", "Multi-Day Compaction"],
  "Crane":        ["Heavy Lifting", "Construction Crane", "Material Loading", "Event Setup Lift", "Industrial Use", "Bridge / Tower Work"],
  "Dump Truck":   ["Earth Transport", "Construction Waste", "Aggregate Delivery", "Agricultural Produce", "Mining Material", "Long-Distance Haul"],
};

// ── GET /pricing/admin/service-types — list service types for a subcategory ───
// No auth required — this is a static read-only lookup of hardcoded data.
router.get("/admin/service-types", async (req: Request, res: Response) => {
  const { subcategory } = req.query as any;
  if (!subcategory) { res.status(400).json({ error: "subcategory is required" }); return; }
  const types = SERVICE_TYPE_MAP[subcategory] ?? [];
  res.json({ subcategory, serviceTypes: types });
});

// ── GET /pricing/admin/service-type-rules — all rules for a subcategory ────────
router.get("/admin/service-type-rules", adminMiddleware, async (req: Request, res: Response) => {
  noCache(res);
  const { category, subcategory } = req.query as any;
  if (!category || !subcategory) { res.status(400).json({ error: "category and subcategory are required" }); return; }
  try {
    const rows = toRows(await db.execute(sql`
      SELECT * FROM pricing_service_type_rules
      WHERE category = ${category} AND subcategory = ${subcategory}
      ORDER BY service_type
    `));
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /pricing/admin/service-type-rules — upsert a service-type rule ────────
router.post("/admin/service-type-rules", adminMiddleware, async (req: Request, res: Response) => {
  try {
    const ar = req as any;
    const {
      category, subcategory, service_type,
      base_fee = 0, hourly_rate = 0, daily_rate = 0,
      km_rate = 0, operator_fee = 0, fuel_fee = 0,
      material_fee = 0, urgency_fee = 0, delivery_fee = 0,
      platform_fee = 0, commission_percent = 10, security_deposit = 0,
    } = req.body;

    if (!category || !subcategory || !service_type) {
      res.status(400).json({ error: "category, subcategory and service_type are required" }); return;
    }

    const existing = toRows(await db.execute(sql`
      SELECT id FROM pricing_service_type_rules
      WHERE category = ${category} AND subcategory = ${subcategory} AND service_type = ${service_type}
    `));

    if (existing.length > 0) {
      await db.execute(sql`
        UPDATE pricing_service_type_rules SET
          base_fee = ${base_fee}, hourly_rate = ${hourly_rate}, daily_rate = ${daily_rate},
          km_rate = ${km_rate}, operator_fee = ${operator_fee}, fuel_fee = ${fuel_fee},
          material_fee = ${material_fee}, urgency_fee = ${urgency_fee},
          delivery_fee = ${delivery_fee}, platform_fee = ${platform_fee},
          commission_percent = ${commission_percent}, security_deposit = ${security_deposit},
          updated_by = ${ar.adminEmail}, updated_at = NOW()
        WHERE category = ${category} AND subcategory = ${subcategory} AND service_type = ${service_type}
      `);
    } else {
      const id = genId();
      await db.execute(sql`
        INSERT INTO pricing_service_type_rules
          (id, category, subcategory, service_type, base_fee, hourly_rate, daily_rate, km_rate,
           operator_fee, fuel_fee, material_fee, urgency_fee, delivery_fee,
           platform_fee, commission_percent, security_deposit, updated_by, updated_at)
        VALUES
          (${id}, ${category}, ${subcategory}, ${service_type}, ${base_fee}, ${hourly_rate},
           ${daily_rate}, ${km_rate}, ${operator_fee}, ${fuel_fee}, ${material_fee},
           ${urgency_fee}, ${delivery_fee}, ${platform_fee}, ${commission_percent},
           ${security_deposit}, ${ar.adminEmail}, NOW())
      `);
    }

    const result = toRows(await db.execute(sql`
      SELECT * FROM pricing_service_type_rules
      WHERE category = ${category} AND subcategory = ${subcategory} AND service_type = ${service_type}
    `));
    res.json(result[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /pricing/service-types — public: list service types + prices for a subcategory ──
// Used by the mobile booking screen to show available service types with prices.
router.get("/service-types", async (req: Request, res: Response) => {
  noCache(res);
  const { category, subcategory } = req.query as any;
  if (!subcategory) { res.status(400).json({ error: "subcategory is required" }); return; }

  const serviceTypeList = SERVICE_TYPE_MAP[subcategory] ?? [];

  try {
    // Fetch any admin-set prices for these service types
    const rows = category && subcategory ? toRows(await db.execute(sql`
      SELECT service_type, base_fee, hourly_rate, daily_rate, km_rate,
             operator_fee, fuel_fee, material_fee, urgency_fee, delivery_fee,
             platform_fee, commission_percent, security_deposit
      FROM pricing_service_type_rules
      WHERE category = ${category} AND subcategory = ${subcategory}
    `)) : [];

    const priceMap: Record<string, any> = {};
    for (const r of rows) {
      const isEquipment = category === "equipment";
      let estimatedPrice = 0;
      if (isEquipment) {
        estimatedPrice = Number(r.daily_rate) + Number(r.delivery_fee) + Number(r.fuel_fee) + Number(r.operator_fee) + Number(r.platform_fee);
      } else {
        estimatedPrice = Number(r.base_fee) + Number(r.hourly_rate) + Number(r.material_fee) + Number(r.platform_fee);
      }
      priceMap[r.service_type] = {
        hasPrice: true,
        estimatedPrice: Math.round(estimatedPrice),
        commission_percent: Number(r.commission_percent),
        base_fee: Number(r.base_fee),
        hourly_rate: Number(r.hourly_rate),
        daily_rate: Number(r.daily_rate),
      };
    }

    const result = serviceTypeList.map(st => ({
      name: st,
      ...(priceMap[st] ?? { hasPrice: false, estimatedPrice: 0 }),
    }));

    res.json({ subcategory, category: category ?? null, serviceTypes: result });
  } catch (e: any) {
    // On error still return service types without prices
    res.json({
      subcategory, category: category ?? null,
      serviceTypes: serviceTypeList.map(st => ({ name: st, hasPrice: false, estimatedPrice: 0 })),
    });
  }
});

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
    const { category, subcategory, service_type, hours = "1", days = "1", distance_km = "0" } = req.query as any;

    if (!category || !subcategory) {
      res.status(400).json({ error: "category and subcategory are required" }); return;
    }

    // If a service_type is provided, try its specific rule first
    let rows: any[] = [];
    if (service_type) {
      rows = toRows(await db.execute(sql`
        SELECT * FROM pricing_service_type_rules
        WHERE category = ${category} AND subcategory = ${subcategory} AND service_type = ${service_type}
      `));
    }
    // Fall back to subcategory-level rule
    if (rows.length === 0) {
      rows = toRows(await db.execute(sql`
        SELECT * FROM pricing_rules WHERE category = ${category} AND subcategory = ${subcategory}
      `));
    }

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
    } else if (category === "services") {
      // Services support both day-based and hour-based billing.
      // If daily_rate is set, use it. If not, fall back to hourly_rate × 8 hrs/day.
      let rateAmount = 0;
      if (d > 0) {
        const effectiveDailyRate = Number(r.daily_rate) > 0
          ? Number(r.daily_rate)
          : Number(r.hourly_rate) * 8;       // fallback: 8-hour workday
        rateAmount = effectiveDailyRate * d;
      } else {
        rateAmount = Number(r.hourly_rate) * h;
      }
      customer_price =
        Number(r.base_fee) +
        rateAmount +
        Number(r.material_fee) +
        Number(r.km_rate) * km +
        Number(r.urgency_fee) +
        Number(r.platform_fee);
    } else {
      // professions / other
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
