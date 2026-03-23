import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { reviewsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router: IRouter = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const { listingId, providerId } = req.query;
    const conditions = [];
    if (listingId) conditions.push(eq(reviewsTable.listingId, listingId as string));
    if (providerId) conditions.push(eq(reviewsTable.providerId, providerId as string));

    const reviews = conditions.length > 0
      ? await db.select().from(reviewsTable).where(and(...conditions))
      : await db.select().from(reviewsTable);

    const enriched = await Promise.all(reviews.map(async (r) => {
      const user = await db.select().from(usersTable).where(eq(usersTable.id, r.userId)).limit(1);
      return {
        id: r.id,
        userId: r.userId,
        userName: user[0]?.name || "Customer",
        providerId: r.providerId,
        listingId: r.listingId,
        bookingId: r.bookingId,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
      };
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Get reviews error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { providerId, listingId, bookingId, rating, comment } = req.body;

    const review = {
      id: generateId(),
      userId,
      providerId: providerId || null,
      listingId: listingId || null,
      bookingId: bookingId || null,
      rating: Number(rating),
      comment: comment || null,
    };

    const inserted = await db.insert(reviewsTable).values(review).returning();
    const r = inserted[0];
    const user = await db.select().from(usersTable).where(eq(usersTable.id, r.userId)).limit(1);

    res.status(201).json({
      id: r.id,
      userId: r.userId,
      userName: user[0]?.name || "Customer",
      providerId: r.providerId,
      listingId: r.listingId,
      bookingId: r.bookingId,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Create review error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
