import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { bookingsTable, listingsTable, usersTable } from "@workspace/db";
import { eq, or, and } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router: IRouter = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const TIME_SLOTS = [
  "08:00 AM – 10:00 AM",
  "10:00 AM – 12:00 PM",
  "12:00 PM – 02:00 PM",
  "02:00 PM – 04:00 PM",
  "04:00 PM – 06:00 PM",
];

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
    bookingDate: booking.bookingDate,
    timeSlot: booking.timeSlot,
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

router.get("/availability", async (req: Request, res: Response) => {
  try {
    const { listingId, date } = req.query;
    if (!listingId || !date) {
      res.status(400).json({ error: "listingId and date are required" });
      return;
    }

    const existing = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.listingId, listingId as string),
          eq(bookingsTable.bookingDate as any, date as string)
        )
      );

    const bookedSlots = existing
      .filter((b) => b.status !== "cancelled")
      .map((b) => b.timeSlot)
      .filter(Boolean) as string[];

    const slots = TIME_SLOTS.map((slot) => ({
      slot,
      available: !bookedSlots.includes(slot),
    }));

    res.json({ date, slots });
  } catch (err) {
    req.log.error({ err }, "Availability check error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { listingId, startDate, endDate, notes, bookingDate, timeSlot } = req.body;

    const listings = await db.select().from(listingsTable).where(eq(listingsTable.id, listingId)).limit(1);
    if (listings.length === 0) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }

    const listing = listings[0];

    if (bookingDate && timeSlot) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(bookingDate);
      if (selected < today) {
        res.status(400).json({ error: "Cannot book a past date" });
        return;
      }

      if (!TIME_SLOTS.includes(timeSlot)) {
        res.status(400).json({ error: "Invalid time slot" });
        return;
      }

      const conflict = await db
        .select()
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.listingId, listingId),
            eq(bookingsTable.bookingDate as any, bookingDate),
            eq(bookingsTable.timeSlot as any, timeSlot)
          )
        );

      const activeConflict = conflict.filter((b) => b.status !== "cancelled");
      if (activeConflict.length > 0) {
        res.status(409).json({ error: "This time slot is already booked. Please choose another." });
        return;
      }

      const booking = {
        id: generateId(),
        customerId: userId,
        providerId: listing.providerId,
        listingId,
        startDate: bookingDate,
        endDate: bookingDate,
        totalDays: 1,
        totalAmount: listing.price,
        status: "pending" as const,
        paymentStatus: "pending" as const,
        notes: notes || null,
        bookingDate,
        timeSlot,
      };

      const inserted = await db.insert(bookingsTable).values(booking).returning();
      const enriched = await enrichBooking(inserted[0]);
      res.status(201).json(enriched);
    } else {
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
        bookingDate: bookingDate || null,
        timeSlot: timeSlot || null,
      };

      const inserted = await db.insert(bookingsTable).values(booking).returning();
      const enriched = await enrichBooking(inserted[0]);
      res.status(201).json(enriched);
    }
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
