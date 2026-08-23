import { Router, type IRouter, type Request as ExpressRequest, type Response } from "express";
import { db } from "@workspace/db";
import { favoritesTable, listingsTable, usersTable, reviewsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router: IRouter = Router();
type Request = ExpressRequest<Record<string, string>>;

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// GET /api/favorites — get current user's favourite listings
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const favs = await db
      .select()
      .from(favoritesTable)
      .where(eq(favoritesTable.userId, userId));

    // Enrich with listing details
    const enriched = await Promise.all(
      favs.map(async (f) => {
        const listings = await db
          .select()
          .from(listingsTable)
          .where(eq(listingsTable.id, f.listingId))
          .limit(1);
        if (listings.length === 0) return null;
        const listing = listings[0];
        const provider = await db.select().from(usersTable).where(eq(usersTable.id, listing.providerId)).limit(1);
        const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.listingId, listing.id));
        const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

        return {
          favoriteId: f.id,
          favoritedAt: f.createdAt.toISOString(),
          id: listing.id,
          providerId: listing.providerId,
          providerName: provider[0]?.name || "Provider",
          providerPhone: provider[0]?.phone || "",
          providerRating: null,
          providerReviewCount: 0,
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
          createdAt: listing.createdAt.toISOString(),
        };
      })
    );

    res.json(enriched.filter(Boolean));
  } catch (err) {
    req.log.error({ err }, "Get favorites error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/favorites — toggle favorite (add if not exists, remove if exists)
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { listingId } = req.body;

    if (!listingId) {
      res.status(400).json({ error: "listingId is required" });
      return;
    }

    const existing = await db
      .select()
      .from(favoritesTable)
      .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.listingId, listingId)))
      .limit(1);

    if (existing.length > 0) {
      // Remove favorite
      await db.delete(favoritesTable).where(eq(favoritesTable.id, existing[0].id));
      res.json({ action: "removed", isFavorite: false });
    } else {
      // Add favorite
      const inserted = await db
        .insert(favoritesTable)
        .values({ id: generateId(), userId, listingId })
        .returning();
      res.status(201).json({ action: "added", isFavorite: true, favoriteId: inserted[0].id });
    }
  } catch (err) {
    req.log.error({ err }, "Toggle favorite error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/favorites/:listingId — explicitly remove a favorite
router.delete("/:listingId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { listingId } = req.params;

    const existing = await db
      .select()
      .from(favoritesTable)
      .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.listingId, listingId)))
      .limit(1);

    if (existing.length === 0) {
      res.json({ action: "removed", isFavorite: false, message: "Not in favorites" });
      return;
    }

    await db.delete(favoritesTable).where(eq(favoritesTable.id, existing[0].id));
    res.json({ action: "removed", isFavorite: false });
  } catch (err) {
    req.log.error({ err }, "Delete favorite error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/favorites/check/:listingId — check if favorited
router.get("/check/:listingId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const existing = await db
      .select()
      .from(favoritesTable)
      .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.listingId, req.params.listingId)))
      .limit(1);

    res.json({ isFavorite: existing.length > 0 });
  } catch (err) {
    req.log.error({ err }, "Check favorite error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
