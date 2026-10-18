import { Router, type IRouter, type Request as ExpressRequest, type Response } from "express";
import { db } from "@workspace/db";
import { listingsTable, usersTable, reviewsTable } from "@workspace/db/schema";
import { eq, ne, and, or, gte, lte, ilike, inArray, sql } from "drizzle-orm";
import { authMiddleware } from "./users.js";
import { activeCatalog, isRetiredCategory } from "../lib/retiredCategories";

const router: IRouter = Router();
type Request = ExpressRequest<Record<string, string>>;

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

async function enrichListing(listing: typeof listingsTable.$inferSelect) {
  const provider = await db.select().from(usersTable).where(eq(usersTable.id, listing.providerId)).limit(1);
  const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.listingId, listing.id));
  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const providerReviews = await db.select().from(reviewsTable).where(eq(reviewsTable.providerId, listing.providerId));
  const providerRating = providerReviews.length > 0 ? providerReviews.reduce((s, r) => s + r.rating, 0) / providerReviews.length : null;

  return {
    id: listing.id,
    providerId: listing.providerId,
    providerName: provider[0]?.name || "Provider",
    providerPhone: provider[0]?.phone || "",
    providerRating: providerRating ? Math.round(providerRating * 10) / 10 : null,
    providerReviewCount: providerReviews.length,
    category: listing.category,
    subcategory: listing.subcategory,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    priceUnit: listing.priceUnit,
    images: (listing.images as string[]) || [],
    location: listing.location,
    latitude: listing.latitude != null ? Number(listing.latitude) : null,
    longitude: listing.longitude != null ? Number(listing.longitude) : null,
    rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
    reviewCount: reviews.length,
    isAvailable: listing.isAvailable,
    operatorIncluded: listing.operatorIncluded ?? false,
    fuelIncluded: listing.fuelIncluded ?? false,
    deliveryCharges: listing.deliveryCharges ?? null,
    engineSize: listing.engineSize ?? null,
    vehicleType: listing.vehicleType ?? null,
    createdAt: listing.createdAt.toISOString(),
  };
}

const VALID_CATEGORIES = ["cars", "equipment", "services"] as const;
type ValidCategory = typeof VALID_CATEGORIES[number];

router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, subcategory, search, minPrice, maxPrice, providerId, excludeProviderId } = req.query;

    let query = db.select().from(listingsTable);
    const conditions = [activeCatalog];

    if (category) {
      if (!VALID_CATEGORIES.includes(category as ValidCategory)) {
        res.json([]);
        return;
      }
      conditions.push(eq(listingsTable.category, category as ValidCategory));
    }
    if (subcategory) conditions.push(eq(listingsTable.subcategory, subcategory as string));
    if (providerId) conditions.push(eq(listingsTable.providerId, providerId as string));
    if (minPrice) conditions.push(gte(listingsTable.price, Number(minPrice)));
    if (maxPrice) conditions.push(lte(listingsTable.price, Number(maxPrice)));

    if (search) {
      const s = search as string;
      /* Find providers whose name or location match — so searching "Bathinda" or
         a provider's name also surfaces their listings */
      const matchingProviders = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(or(
          ilike(usersTable.name, `%${s}%`),
          ilike(usersTable.location, `%${s}%`),
        ));
      const providerIds = matchingProviders.map(p => p.id);

      conditions.push(
        or(
          ilike(listingsTable.title,       `%${s}%`),
          ilike(listingsTable.description, `%${s}%`),
          ilike(listingsTable.subcategory, `%${s}%`),
          ilike(listingsTable.location,    `%${s}%`),
          ...(providerIds.length > 0 ? [inArray(listingsTable.providerId, providerIds)] : []),
        )!
      );
    }

    // Exclude provider's own listings from customer feed
    if (excludeProviderId) conditions.push(ne(listingsTable.providerId, excludeProviderId as string));

    const listings = conditions.length > 0
      ? await db.select().from(listingsTable).where(and(...conditions))
      : await db.select().from(listingsTable);

    const enriched = await Promise.all(listings.map(enrichListing));
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Get listings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const listings = await db.select().from(listingsTable).where(eq(listingsTable.id, req.params.id)).limit(1);
    if (listings.length === 0 || isRetiredCategory(listings[0].subcategory)) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    const enriched = await enrichListing(listings[0]);
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Get listing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { category, subcategory, title, description, price, priceUnit, images, location, isAvailable,
            operatorIncluded, fuelIncluded, deliveryCharges, engineSize, vehicleType, latitude, longitude } = req.body;
    if (isRetiredCategory(subcategory)) {
      res.status(400).json({ error: "This equipment or service type is no longer offered" }); return;
    }

    if (!VALID_CATEGORIES.includes(category as ValidCategory)) {
      res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` });
      return;
    }

    const userRows = await db.execute(sql`SELECT role FROM users WHERE id = ${userId} LIMIT 1`);
    const userRole = (userRows as any)?.rows?.[0]?.role ?? (Array.isArray(userRows) ? (userRows as any)[0]?.role : null);
    if (!userRole || (userRole !== "provider" && userRole !== "both")) {
      res.status(403).json({ error: "Only providers can create listings" });
      return;
    }

    const listing = {
      id: generateId(),
      providerId: userId,
      category: category as ValidCategory,
      subcategory: subcategory || null,
      title,
      description: description || null,
      price: Number(price),
      priceUnit: (priceUnit || "per_day") as "per_day" | "per_hour",
      images: images || [],
      location,
      isAvailable: isAvailable !== false,
      operatorIncluded: operatorIncluded === true,
      fuelIncluded: fuelIncluded === true,
      deliveryCharges: deliveryCharges != null ? String(Number(deliveryCharges)) : null,
      engineSize: engineSize != null ? Number(engineSize) : null,
      vehicleType: vehicleType || null,
      latitude: latitude != null ? String(Number(latitude)) : null,
      longitude: longitude != null ? String(Number(longitude)) : null,
    };

    const inserted = await db.insert(listingsTable).values(listing).returning();
    const enriched = await enrichListing(inserted[0]);
    res.status(201).json(enriched);
  } catch (err) {
    req.log.error({ err }, "Create listing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      category, subcategory, title, description, price, priceUnit,
      images, location, isAvailable, operatorIncluded, fuelIncluded, deliveryCharges,
      engineSize, vehicleType, latitude, longitude,
    } = req.body;

    const existing = await db.select().from(listingsTable).where(eq(listingsTable.id, req.params.id)).limit(1);
    if (isRetiredCategory(subcategory) || isRetiredCategory(existing[0]?.subcategory)) {
      res.status(400).json({ error: "This equipment or service type is no longer offered" }); return;
    }
    if (category && !VALID_CATEGORIES.includes(category as ValidCategory)) {
      res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` });
      return;
    }

    const updated = await db.update(listingsTable)
      .set({
        ...(category !== undefined && { category: category as ValidCategory }),
        subcategory, title, description,
        price: Number(price), priceUnit, images, location, isAvailable,
        ...(operatorIncluded !== undefined && { operatorIncluded: operatorIncluded === true }),
        ...(fuelIncluded !== undefined && { fuelIncluded: fuelIncluded === true }),
        ...(deliveryCharges !== undefined && { deliveryCharges: deliveryCharges != null ? String(Number(deliveryCharges)) : null }),
        ...(engineSize !== undefined && { engineSize: engineSize != null ? Number(engineSize) : null }),
        ...(vehicleType !== undefined && { vehicleType: vehicleType || null }),
        ...(latitude !== undefined && { latitude: latitude != null ? String(Number(latitude)) : null }),
        ...(longitude !== undefined && { longitude: longitude != null ? String(Number(longitude)) : null }),
      })
      .where(eq(listingsTable.id, req.params.id))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }

    const enriched = await enrichListing(updated[0]);
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Update listing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    await db.delete(listingsTable).where(eq(listingsTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete listing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

function getServiceTypesForListing(
  title: string,
  category: string,
  subcategory: string | null,
  description: string | null
): string[] {
  const text = `${title} ${subcategory ?? ""} ${description ?? ""}`.toLowerCase();

  // ── Beauty & Salon ──────────────────────────────────────────────
  if (/beauty|salon|parlour|parlor|spa|mehendi|henna/.test(text)) {
    return ["Professional Hair Styling", "Facial & Skin Treatment", "Waxing Services", "Nail Care & Art", "Bridal Makeup", "Beauty Consultation"];
  }
  if (/hair/.test(text)) {
    return ["Professional Hair Styling", "Hair Coloring & Highlights", "Keratin / Smoothening", "Haircut & Trim", "Hair Treatment", "Bridal Hair Styling"];
  }
  if (/nail/.test(text)) {
    return ["Nail Art & Extensions", "Manicure", "Pedicure", "Gel Nails", "Nail Removal", "Nail Design Session"];
  }
  if (/facial|skin|bleach/.test(text)) {
    return ["Basic Facial", "Deep Cleansing Facial", "Anti-Ageing Treatment", "De-Tan & Brightening", "Hydra Facial", "Skin Consultation"];
  }
  if (/makeup|bridal/.test(text)) {
    return ["Bridal Makeup", "Party Makeup", "Engagement Look", "Airbrush Makeup", "Natural Day Look", "Makeup Trial"];
  }
  if (/massage|spa/.test(text)) {
    return ["Full Body Massage", "Head & Neck Massage", "Foot Massage", "Deep Tissue Massage", "Aromatherapy", "Couple Massage"];
  }

  // ── Agriculture / Farm Equipment ────────────────────────────────
  if (/tractor/.test(text)) {
    return ["Ploughing Service", "Sowing & Seeding", "Crop Harvesting", "Land Levelling", "Rotavation", "Multi-Day Farm Work"];
  }
  if (/combine|harvester|thresher/.test(text)) {
    return ["Wheat Harvesting", "Rice Harvesting", "Crop Cutting", "Threshing & Bundling", "Field Clearance", "Multi-Crop Harvest"];
  }

  // ── Heavy Machinery ─────────────────────────────────────────────
  if (/jcb|excavat|backhoe/.test(text)) {
    return ["Excavation Work", "Foundation Digging", "Land Clearing", "Trench Digging", "Loading & Transport", "Demolition Assist"];
  }
  if (/crane/.test(text)) {
    return ["Heavy Lifting", "Construction Crane", "Material Loading", "Event Setup Lift", "Industrial Use", "Bridge / Tower Work"];
  }
  if (/generator|genset/.test(text)) {
    return ["Backup Power Supply", "Event Power", "Construction Site Power", "Farm Irrigation", "Long-Term Rental", "Emergency Power"];
  }

  // ── Carpentry / Woodwork (must come before cars — "car" is in "carpenter") ──
  if (/carpenter|carpentry|woodwork|furniture|cabinet|joiner|timber|wood.?work/.test(text)) {
    return [
      "Furniture Making & Repair",
      "Door & Window Fitting",
      "Cabinet & Wardrobe Work",
      "Wooden Flooring",
      "Roof & Framework",
      "Custom Woodwork",
    ];
  }

  // ── Transport / Cars ────────────────────────────────────────────
  if (/truck|tempo|loader/.test(text)) {
    return ["Goods Transport", "House Shifting", "Factory Delivery", "Agricultural Transport", "Airport Cargo", "Long-Distance Haul"];
  }
  if (/bus|minibus/.test(text)) {
    return ["School / College Trip", "Wedding Convoy", "Corporate Transport", "Pilgrimage Tour", "Daily Commute", "Airport Shuttle"];
  }
  if (category === "cars" || /\bcar\b|vehicle|taxi|cab|suv|sedan/.test(text)) {
    return ["One-Way Trip", "Return Trip", "Airport Transfer", "Wedding / Event Hire", "City Tour", "Daily Commute"];
  }

  // ── Photography / Videography ───────────────────────────────────
  if (/photo|video|camera|shoot|film|studio/.test(text)) {
    return ["Wedding Photography", "Portrait Session", "Event Coverage", "Product Shoot", "Video Production", "Editing & Delivery"];
  }

  // ── Plumbing (must come before catering — "kitchen" appears in plumbing titles) ──
  if (/plumb|plumber|pipe|drain|water.?tank|pump|sanit|bathroom.repair|kitchen.repair|tap.repair|leakage/.test(text)) {
    return [
      "Pipe Repair & Leak Fix",
      "Bathroom Fitting & Installation",
      "Kitchen Sink & Tap Repair",
      "Drain & Sewer Cleaning",
      "Water Tank Service",
      "Emergency Plumbing Call",
    ];
  }

  // ── Catering / Food ("kitchen" removed — too generic, matched plumber listings) ──
  if (/cater|food|cook|chef|langar|meal|dhaba|tiffin/.test(text)) {
    return ["Wedding Catering", "Birthday Party", "Corporate Event", "Langar / Dawat", "Home Delivery", "Chef on Hire"];
  }

  // ── Electrical ──────────────────────────────────────────────────
  if (/electric|wiring|panel|switchboard/.test(text)) {
    return ["Electrical Wiring", "Panel & Board Repair", "Light & Fan Install", "AC Wiring", "Fault Diagnosis", "Safety Inspection"];
  }

  // ── Cleaning ────────────────────────────────────────────────────
  if (/clean|sweep|sanitiz|housekeep/.test(text)) {
    return ["Home Deep Clean", "Office Cleaning", "Carpet & Sofa Clean", "Kitchen & Bathroom", "Post-Construction Clean", "Regular Maintenance"];
  }

  // ── Construction / Labour ───────────────────────────────────────
  if (/construct|mason|plaster|cement|brick|flooring|tile|labour|labor/.test(text)) {
    return ["Foundation Work", "Brickwork & Masonry", "Plastering", "Flooring / Tiling", "Renovation", "Inspection & Estimate"];
  }

  // ── Painting ────────────────────────────────────────────────────
  if (/paint/.test(text)) {
    return ["Interior Painting", "Exterior Painting", "Wall Texture / Design", "Wood Polish & Paint", "Waterproofing", "Touch-Up & Repair"];
  }

  // ── AC / HVAC ───────────────────────────────────────────────────
  if (/\bac\b|air.condition|hvac|cooling|refriger/.test(text)) {
    return ["AC Installation", "AC Service & Gas Fill", "Deep Cleaning", "AC Repair", "Split AC Fitting", "Central AC Maintenance"];
  }

  // ── Welding / Fabrication ───────────────────────────────────────
  if (/weld|fabricat|iron|steel/.test(text)) {
    return ["Gate & Grill Welding", "Structural Welding", "Pipe Welding", "Sheet Metal Work", "Repair & Restoration", "Custom Fabrication"];
  }

  // ── Events / Decoration ─────────────────────────────────────────
  if (/event|decor|wedding|birthday|party|tent|stage|light/.test(text)) {
    return ["Wedding Decoration", "Birthday Setup", "Stage & Lighting", "Tent & Marquee", "Floral Arrangement", "Full Event Management"];
  }

  // ── Security ────────────────────────────────────────────────────
  if (/security|guard|cctv|surveillance/.test(text)) {
    return ["Event Security", "Property Guard", "CCTV Installation", "Night Patrol", "VIP Protection", "Warehouse Security"];
  }

  // ── Pest Control ────────────────────────────────────────────────
  if (/pest|termite|mosquito|cockroach|rat|fumig/.test(text)) {
    return ["General Pest Control", "Termite Treatment", "Mosquito Control", "Rodent Control", "Fumigation", "Annual AMC Plan"];
  }

  // ── Tailoring ───────────────────────────────────────────────────
  if (/tailor|stitch|sew|alter|suit|salwar|dress/.test(text)) {
    return ["Regular Stitching", "Bridal Dress", "Alteration & Repair", "Kids Clothes", "Ethnic Wear", "Express 24hr Delivery"];
  }

  // ── Tuition / Education ─────────────────────────────────────────
  if (/tuition|teach|coaching|class|education|maths|science|english/.test(text)) {
    return ["Home Tuition", "Group Coaching", "Online Session", "Exam Preparation", "Holiday Class", "Subject Consultation"];
  }

  // ── Category-level fallbacks ────────────────────────────────────
  if (category === "equipment") {
    return ["Rental Only", "With Operator", "Delivery Required", "Urgent Same Day", "Multi-Day Project", "Inspection / Demo"];
  }
  if (category === "services") {
    return ["Basic Service", "Premium Service", "Emergency Service", "Same Day Service", "Scheduled Visit", "Expert Consultation"];
  }

  // ── Default ─────────────────────────────────────────────────────
  return ["Standard Booking", "Priority Booking", "Express / Same Day", "Scheduled Service", "Package Deal", "Custom Arrangement"];
}

router.get("/:id/service-types", async (req: Request, res: Response) => {
  try {
    const listings = await db.select().from(listingsTable).where(eq(listingsTable.id, req.params.id)).limit(1);
    if (listings.length === 0 || isRetiredCategory(listings[0].subcategory)) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    const { category, subcategory, title, description } = listings[0];
    const serviceTypes = getServiceTypesForListing(title, category, subcategory, description);
    res.json({ category, serviceTypes });
  } catch (err) {
    req.log.error({ err }, "Get service types error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
