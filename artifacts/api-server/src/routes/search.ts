import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { listingsTable, usersTable, reviewsTable } from "@workspace/db/schema";
import { eq, ilike, or, and, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

const PUNJAB_LOCATIONS = [
  "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda",
  "Mohali", "Hoshiarpur", "Gurdaspur", "Firozpur", "Moga",
  "Pathankot", "Sangrur", "Faridkot", "Kapurthala", "Barnala",
  "Ropar (Rupnagar)", "Fatehgarh Sahib", "Mansa", "Muktsar", "Nawanshahr",
  "Tarn Taran", "Fazilka", "Sri Muktsar Sahib", "Zirakpur", "Khanna",
  "Abohar", "Rajpura", "Phagwara", "Nabha", "Samrala",
];

const SERVICE_KEYWORDS = ["plumber", "electrician", "mechanic", "beauty", "parlor",
  "carpenter", "painter", "tailor", "cleaner", "driver", "cook", "helper",
  "ac repair", "construction", "welder", "Mason", "gardener"];

const VEHICLE_KEYWORDS = ["car", "swift", "honda", "toyota", "hyundai", "suzuki",
  "tata", "mahindra", "maruti", "innova", "fortuner", "ertiga", "i20", "verna",
  "truck", "van", "tractor", "harvester", "rotavator", "sprayer", "suv", "sedan",
  "bus", "tempo", "jeep", "pickup", "auto", "bike",
  "jcb", "excavator", "bulldozer", "loader", "backhoe", "roller", "crane",
  "dump truck", "earth mover", "earth movers", "digging machine", "digger",
  "construction equipment", "heavy machine", "backhoe loader"];

function detectIntent(q: string): "vehicles" | "services" | "location" | "general" {
  const lower = q.toLowerCase();
  if (SERVICE_KEYWORDS.some(k => lower.includes(k))) return "services";
  if (VEHICLE_KEYWORDS.some(k => lower.includes(k))) return "vehicles";
  if (PUNJAB_LOCATIONS.some(loc => lower.includes(loc.toLowerCase()))) return "location";
  return "general";
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || "").trim();
    const limit = Math.min(Number(req.query.limit) || 10, 20);

    if (!q || q.length < 1) {
      res.json({ vehicles: [], services: [], providers: [], locations: [], intent: "general" });
      return;
    }

    const intent = detectIntent(q);

    const listingResults = await db
      .select()
      .from(listingsTable)
      .where(
        or(
          ilike(listingsTable.title, `%${q}%`),
          ilike(listingsTable.description, `%${q}%`),
          ilike(listingsTable.subcategory, `%${q}%`),
          ilike(listingsTable.location, `%${q}%`),
        )
      )
      .orderBy(desc(listingsTable.createdAt))
      .limit(limit * 4);

    const providerIdSet = [...new Set(listingResults.map((l) => l.providerId))];

    let providerMap = new Map<string, { name: string | null; location: string | null }>();
    if (providerIdSet.length > 0) {
      const provRows = await db
        .select({ id: usersTable.id, name: usersTable.name, location: usersTable.location })
        .from(usersTable)
        .where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(providerIdSet.map(id => sql`${id}`), sql`, `)}])`);
      providerMap = new Map(provRows.map((p) => [p.id, p]));
    }

    const toSuggestion = (l: typeof listingResults[0]) => ({
      id: l.id,
      type: "listing" as const,
      category: l.category,
      subcategory: l.subcategory,
      title: l.title,
      subtitle: `₹${Math.round(l.price).toLocaleString("en-IN")}/${l.priceUnit === "per_day" ? "day" : "hr"} · ${l.location}`,
      location: l.location,
      price: l.price,
      priceUnit: l.priceUnit,
      providerName: providerMap.get(l.providerId)?.name ?? null,
    });

    const vehicles = listingResults
      .filter((l) => l.category === "cars" || l.category === "equipment")
      .slice(0, limit)
      .map(toSuggestion);

    const services = listingResults
      .filter((l) => l.category === "services")
      .slice(0, limit)
      .map(toSuggestion);

    const providerResults = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        location: usersTable.location,
        role: usersTable.role,
      })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.role, "provider"),
          or(
            ilike(usersTable.name, `%${q}%`),
            ilike(usersTable.location, `%${q}%`),
          )
        )
      )
      .limit(limit);

    const providers = providerResults.map((p) => ({
      id: p.id,
      type: "provider" as const,
      title: p.name ?? "Provider",
      subtitle: p.location ?? "Punjab",
      location: p.location,
    }));

    const lowerQ = q.toLowerCase();
    const locations = PUNJAB_LOCATIONS.filter((loc) =>
      loc.toLowerCase().includes(lowerQ)
    )
      .slice(0, 5)
      .map((loc) => ({
        id: loc,
        type: "location" as const,
        title: loc,
        subtitle: "Punjab, India",
      }));

    res.json({ vehicles, services, providers, locations, intent });
  } catch (err) {
    req.log?.error({ err }, "Search error");
    res.status(500).json({ error: "Search failed" });
  }
});

router.get("/popular", async (_req: Request, res: Response) => {
  try {
    const recent = await db
      .select({ category: listingsTable.category, subcategory: listingsTable.subcategory })
      .from(listingsTable)
      .orderBy(desc(listingsTable.createdAt))
      .limit(50);

    const popularSearches = [
      { label: "Tractor", icon: "tractor", category: "equipment" },
      { label: "Plumbing", icon: "water-outline", category: "services" },
      { label: "Electrician", icon: "flash-outline", category: "services" },
      { label: "Beauty", icon: "sparkles-outline", category: "services" },
      { label: "Painter", icon: "brush-outline", category: "services" },
      { label: "Harvester", icon: "tractor", category: "equipment" },
      { label: "Carpenter", icon: "hammer-outline", category: "services" },
      { label: "JCB", icon: "construct-outline", category: "equipment" },
      { label: "Ludhiana", icon: "location-outline", category: "location" },
      { label: "Amritsar", icon: "location-outline", category: "location" },
    ];

    res.json({ popular: popularSearches });
  } catch (err) {
    res.status(500).json({ error: "Failed to get popular searches" });
  }
});

/* ── GET /search/locations ──────────────────────────────────────────────────
   Returns distinct districts + cities/towns parsed from the `location` field
   of users and listings. Format stored is "City, District" (from sign-up).  */
router.get("/locations", async (_req: Request, res: Response) => {
  try {
    const [userRows, listingRows] = await Promise.all([
      db.selectDistinct({ location: usersTable.location }).from(usersTable)
        .where(sql`${usersTable.location} IS NOT NULL AND TRIM(${usersTable.location}) != ''`),
      db.selectDistinct({ location: listingsTable.location }).from(listingsTable)
        .where(sql`${listingsTable.location} IS NOT NULL AND TRIM(${listingsTable.location}) != ''`),
    ]);

    const allLocations = [
      ...userRows.map(r => r.location),
      ...listingRows.map(r => r.location),
    ].filter(Boolean) as string[];

    const districtCount: Record<string, number> = {};
    const citySet = new Set<string>();

    for (const loc of allLocations) {
      const parts = loc.split(",").map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const district = parts[parts.length - 1];
        const city    = parts[0];
        districtCount[district] = (districtCount[district] || 0) + 1;
        citySet.add(city);
      } else if (parts.length === 1) {
        districtCount[parts[0]] = (districtCount[parts[0]] || 0) + 1;
      }
    }

    const districts = Object.entries(districtCount)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));

    const cities = [...citySet].sort();

    res.json({ districts, cities });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

export default router;
