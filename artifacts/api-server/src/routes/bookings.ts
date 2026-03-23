import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { bookingsTable, listingsTable, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router: IRouter = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

async function enrichBooking(booking: typeof bookingsTable.$inferSelect) {
  const listing = await db.select().from(listingsTable).where(eq(listingsTable.id, booking.listingId)).limit(1);
  const customer = await db.select().from(usersTable).where(eq(usersTable.id, booking.customerId)).limit(1);

  return {
    id: booking.id,
    customerId: booking.customerId,
    customerName: customer[0]?.name || "Customer",
    customerPhone: customer[0]?.phone || "",
    providerId: booking.providerId,
    listingId: booking.listingId,
    listingTitle: listing[0]?.title || "Listing",
    listingImage: ((listing[0]?.images as string[]) || [])[0] || null,
    startDate: booking.startDate,
    endDate: booking.endDate,
    totalDays: booking.totalDays,
    totalAmount: booking.totalAmount,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    notes: booking.notes,
    createdAt: booking.createdAt.toISOString(),
  };
}

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { role } = req.query;

    let bookings;
    if (role === "provider") {
      bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.providerId, userId));
    } else {
      bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.customerId, userId));
    }

    const enriched = await Promise.all(bookings.map(enrichBooking));
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Get bookings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { listingId, startDate, endDate, notes } = req.body;

    const listings = await db.select().from(listingsTable).where(eq(listingsTable.id, listingId)).limit(1);
    if (listings.length === 0) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }

    const listing = listings[0];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const totalAmount = listing.price * diffDays;

    const booking = {
      id: generateId(),
      customerId: userId,
      providerId: listing.providerId,
      listingId,
      startDate,
      endDate,
      totalDays: diffDays,
      totalAmount,
      status: "pending" as const,
      paymentStatus: "pending" as const,
      notes: notes || null,
    };

    const inserted = await db.insert(bookingsTable).values(booking).returning();
    const enriched = await enrichBooking(inserted[0]);
    res.status(201).json(enriched);
  } catch (err) {
    req.log.error({ err }, "Create booking error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.id)).limit(1);
    if (bookings.length === 0) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }
    const enriched = await enrichBooking(bookings[0]);
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Get booking error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, paymentStatus } = req.body;
    const updateData: Record<string, unknown> = { status };
    if (paymentStatus) updateData.paymentStatus = paymentStatus;

    const updated = await db.update(bookingsTable)
      .set(updateData as { status: typeof bookingsTable.$inferSelect["status"]; paymentStatus?: typeof bookingsTable.$inferSelect["paymentStatus"] })
      .where(eq(bookingsTable.id, req.params.id))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    const enriched = await enrichBooking(updated[0]);
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Update booking error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
