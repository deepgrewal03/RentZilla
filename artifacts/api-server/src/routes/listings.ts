import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { listingsTable, usersTable, reviewsTable } from "@workspace/db";
import { eq, ne, and, gte, lte, like, sql } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router: IRouter = Router();

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
    rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
    reviewCount: reviews.length,
    isAvailable: listing.isAvailable,
    operatorIncluded: listing.operatorIncluded ?? false,
    fuelIncluded: listing.fuelIncluded ?? false,
    deliveryCharges: listing.deliveryCharges ?? null,
    createdAt: listing.createdAt.toISOString(),
  };
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, subcategory, search, minPrice, maxPrice, providerId, excludeProviderId } = req.query;

    let query = db.select().from(listingsTable);
    const conditions = [];

    if (category) conditions.push(eq(listingsTable.category, category as "cars" | "equipment" | "services"));
    if (subcategory) conditions.push(eq(listingsTable.subcategory, subcategory as string));
    if (providerId) conditions.push(eq(listingsTable.providerId, providerId as string));
    if (minPrice) conditions.push(gte(listingsTable.price, Number(minPrice)));
    if (maxPrice) conditions.push(lte(listingsTable.price, Number(maxPrice)));
    if (search) conditions.push(like(listingsTable.title, `%${search}%`));
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
    if (listings.length === 0) {
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
            operatorIncluded, fuelIncluded, deliveryCharges } = req.body;

    const listing = {
      id: generateId(),
      providerId: userId,
      category: category as "cars" | "equipment" | "services",
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
      deliveryCharges: deliveryCharges != null ? Number(deliveryCharges) : null,
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
    } = req.body;

    const updated = await db.update(listingsTable)
      .set({
        category, subcategory, title, description,
        price: Number(price), priceUnit, images, location, isAvailable,
        ...(operatorIncluded !== undefined && { operatorIncluded: operatorIncluded === true }),
        ...(fuelIncluded !== undefined && { fuelIncluded: fuelIncluded === true }),
        ...(deliveryCharges !== undefined && { deliveryCharges: deliveryCharges != null ? Number(deliveryCharges) : null }),
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

export default router;
