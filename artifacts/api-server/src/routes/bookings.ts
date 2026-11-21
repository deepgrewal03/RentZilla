import { Router, type IRouter, type Request as ExpressRequest, type Response } from "express";
import { db } from "@workspace/db";
import { bookingsTable, listingsTable, usersTable } from "@workspace/db/schema";
import { eq, or, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { authMiddleware } from "./users.js";
import { isRetiredCategory } from "../lib/retiredCategories";
import {
  validateTransition,
  transitionBooking,
  isValidStatus,
  isPayoutEligible,
  hasDateOverlap,
  recalculateBaseAmount,
  cancelStalePendingBookings,
  type BookingStatus,
  InvalidTransitionError,
  UnauthorisedTransitionError,
} from "../lib/bookingStateMachine.js";

const router: IRouter = Router();
type Request = ExpressRequest<Record<string, string>>;

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function toRows<T = any>(result: any): T[] {
  if (Array.isArray(result)) return result as T[];
  return (result?.rows ?? []) as T[];
}

const TIME_SLOTS = [
  "08:00 AM – 09:00 AM",
  "09:00 AM – 10:00 AM",
  "10:00 AM – 11:00 AM",
  "11:00 AM – 12:00 PM",
  "12:00 PM – 01:00 PM",
  "01:00 PM – 02:00 PM",
  "02:00 PM – 03:00 PM",
  "03:00 PM – 04:00 PM",
  "04:00 PM – 05:00 PM",
  "05:00 PM – 06:00 PM",
];

async function enrichBooking(booking: typeof bookingsTable.$inferSelect) {
  const [listing, customer, provider] = await Promise.all([
    db.select().from(listingsTable).where(eq(listingsTable.id, booking.listingId)).limit(1),
    db.select().from(usersTable).where(eq(usersTable.id, booking.customerId)).limit(1),
    db.select().from(usersTable).where(eq(usersTable.id, booking.providerId)).limit(1),
  ]);

  const b = booking as any;
  // Drizzle ORM maps snake_case columns to camelCase; support both for raw SQL results too
  const rawTimeSlots = b.timeSlots ?? b.time_slots ?? null;
  const rawServiceTypes = b.serviceTypes ?? b.service_types ?? null;
  const parsedTimeSlots: string[] = rawTimeSlots ? safeParseJson(rawTimeSlots, []) : [];
  const parsedServiceTypes: string[] = rawServiceTypes ? safeParseJson(rawServiceTypes, []) : [];
  // totalHours = number of booked time slots (for hourly/service bookings)
  const totalHours = parsedTimeSlots.length > 0 ? parsedTimeSlots.length : null;
  const rawDiscountAmount = b.discountAmount ?? b.discount_amount ?? 0;
  const rawGoldDiscountAmount = b.goldDiscountAmount ?? b.gold_discount_amount ?? 0;
  const rawFinalAmount = b.finalAmount ?? b.final_amount;
  const rawPromoCode = b.promoCode ?? b.promo_code ?? null;
  const rawLocation = b.location ?? null;
  const rawLocationLat = b.locationLat ?? b.location_lat ?? null;
  const rawLocationLng = b.locationLng ?? b.location_lng ?? null;
  const goldDiscountAmount = Number(rawGoldDiscountAmount);
  const totalDiscount = Number(rawDiscountAmount);
  const promoDiscountAmount = Math.max(0, totalDiscount - goldDiscountAmount);
  const finalAmt = rawFinalAmount == null ? Number(booking.totalAmount) : Number(rawFinalAmount);
  return {
    id: booking.id,
    customerId: booking.customerId,
    customerName: customer[0]?.name || "Customer",
    customerPhone: customer[0]?.phone || "",
    providerId: booking.providerId,
    providerName: provider[0]?.name || "Provider",
    providerPhone: provider[0]?.phone || "",
    listingId: booking.listingId,
    listingTitle: listing[0]?.title || "Listing",
    listingCategory: listing[0]?.category || null,
    listingSubcategory: listing[0]?.subcategory || null,
    listingImage: ((listing[0]?.images as string[]) || [])[0] || null,
    startDate: booking.startDate,
    endDate: booking.endDate,
    totalDays: booking.totalDays,
    totalHours,
    totalAmount: booking.totalAmount,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentDueAmount: Number(b.paymentDueAmount ?? b.payment_due_amount ?? finalAmt),
    amountPaid: Number(b.amountPaid ?? b.amount_paid ?? 0),
    paidAt: b.paidAt ?? b.paid_at ?? null,
    invoiceId: b.invoiceId ?? b.invoice_id ?? null,
    notes: booking.notes,
    bookingDate: booking.bookingDate,
    timeSlot: booking.timeSlot,
    timeSlots: parsedTimeSlots.length > 0 ? parsedTimeSlots : null,
    serviceType: b.serviceType || b.service_type || parsedServiceTypes[0] || null,
    serviceTypes: parsedServiceTypes.length > 0 ? parsedServiceTypes : null,
    promoCode: rawPromoCode,
    discountAmount: totalDiscount,
    promoDiscountAmount,
    goldDiscountAmount,
    goldDiscountApplied: !!(b.goldDiscountApplied ?? b.gold_discount_applied),
    serviceFee: Number(b.serviceFee ?? b.service_fee ?? 0),
    extraCharges: (b.extraCharges ?? b.extra_charges) ? safeParseJson(b.extraCharges ?? b.extra_charges, []) : [],
    finalAmount: finalAmt,
    location: rawLocation,
    locationLat: rawLocationLat ? Number(rawLocationLat) : null,
    locationLng: rawLocationLng ? Number(rawLocationLng) : null,
    createdAt: booking.createdAt.toISOString(),
  };
}

function safeParseJson(str: string, fallback: any) {
  try { return JSON.parse(str); } catch { return fallback; }
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

// ── GET /bookings/availability ─────────────────────────────────────────────────
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

    const activeBookings = existing.filter((b) => b.status !== "cancelled");

    // Collect all booked slots from both single-slot and multi-slot bookings
    const bookedSlots = new Set<string>();
    for (const b of activeBookings) {
      const bany = b as any;
      // Old single-slot bookings
      if (b.timeSlot) bookedSlots.add(b.timeSlot);
      // New multi-slot bookings
      if (bany.time_slots) {
        const slots = safeParseJson(bany.time_slots, []) as string[];
        slots.forEach(s => bookedSlots.add(s));
      }
    }

    const slots = TIME_SLOTS.map((slot) => ({
      slot,
      available: !bookedSlots.has(slot),
    }));

    res.json({ date, slots });
  } catch (err) {
    req.log.error({ err }, "Availability check error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /bookings/validate-promo ─────────────────────────────────────────────
router.post("/validate-promo", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { code, amount } = req.body;
    if (!code) { res.status(400).json({ error: "code is required" }); return; }
    if (!amount || Number(amount) <= 0) { res.status(400).json({ error: "amount is required" }); return; }

    const rows = toRows(await db.execute(sql`
      SELECT * FROM promo_codes WHERE UPPER(code) = UPPER(${code}) LIMIT 1
    `));

    if (rows.length === 0) {
      res.json({ valid: false, message: "Invalid promo code" });
      return;
    }

    const promo = rows[0];

    if (!promo.is_active) {
      res.json({ valid: false, message: "This promo code is no longer active" });
      return;
    }

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      res.json({ valid: false, message: "This promo code has expired" });
      return;
    }

    if (Number(promo.used_count) >= Number(promo.max_uses)) {
      res.json({ valid: false, message: "This promo code has reached its usage limit" });
      return;
    }

    const orderAmount = Number(amount);
    if (orderAmount < Number(promo.min_order)) {
      res.json({
        valid: false,
        message: `Minimum order of ₹${Number(promo.min_order).toLocaleString("en-IN")} required for this code`,
      });
      return;
    }

    let discount = 0;
    if (promo.type === "percent" || promo.type === "percentage") {
      discount = Math.round(orderAmount * Number(promo.value) / 100);
    } else {
      discount = Math.min(Number(promo.value), orderAmount);
    }

    res.json({
      valid: true,
      code: promo.code,
      type: promo.type,
      value: Number(promo.value),
      discount,
      finalAmount: Math.max(0, orderAmount - discount),
      description: promo.description || null,
      message: (promo.type === "percent" || promo.type === "percentage")
        ? `${promo.value}% off applied — you save ₹${discount.toLocaleString("en-IN")}`
        : `Flat ₹${discount.toLocaleString("en-IN")} off applied`,
    });
  } catch (err) {
    req.log.error({ err }, "Validate promo error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /bookings/:id/accept — provider accepts a pending booking ─────────────
router.post("/:id/accept", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const rows = toRows(await db.execute(sql`SELECT * FROM bookings WHERE id = ${req.params.id} LIMIT 1`));
    if (rows.length === 0) { res.status(404).json({ error: "Booking not found" }); return; }
    const b = rows[0];

    if (b.provider_id !== userId) { res.status(403).json({ error: "Only the provider can accept this booking" }); return; }
    if (b.payment_status !== "paid") {
      res.status(409).json({ error: "The customer must complete payment before this booking can be accepted" });
      return;
    }

    const from = b.status as BookingStatus;
    const to: BookingStatus = "confirmed";
    try {
      await transitionBooking(req.params.id, from, to, userId, "provider accepted");
    } catch (e: any) {
      if (e instanceof InvalidTransitionError) {
        return void res.status(422).json({ error: e.message });
      }
      throw e;
    }

    // Notify customer
    try {
      const notifId = generateId();
      await db.execute(sql`
        INSERT INTO notifications (id, user_id, title, message, category, target_type, target_id)
        VALUES (${notifId}, ${b.customer_id},
          'Booking Accepted ✅',
          ${"Your booking has been accepted by the provider. Get ready!"}, 'bookings', 'booking', ${b.id})
      `);
    } catch { /* non-critical */ }

    const updated = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.id)).limit(1);
    res.json(await enrichBooking(updated[0]));
  } catch (err) {
    req.log.error({ err }, "Accept booking error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /bookings/:id/reject — provider rejects a pending booking ─────────────
router.post("/:id/reject", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { reason } = req.body;
    const rows = toRows(await db.execute(sql`SELECT * FROM bookings WHERE id = ${req.params.id} LIMIT 1`));
    if (rows.length === 0) { res.status(404).json({ error: "Booking not found" }); return; }
    const b = rows[0];

    if (b.provider_id !== userId) { res.status(403).json({ error: "Only the provider can reject this booking" }); return; }
    if (b.status !== "pending") { res.status(400).json({ error: `Cannot reject a booking with status "${b.status}"` }); return; }

    await transitionBooking(req.params.id, "pending", "cancelled", userId, reason || "rejected by provider");

    try {
      const notifId = generateId();
      await db.execute(sql`
        INSERT INTO notifications (id, user_id, title, message, category, target_type, target_id)
        VALUES (${notifId}, ${b.customer_id},
          'Booking Rejected',
          ${reason ? `Your booking was rejected: ${reason}` : "Your booking request was not accepted. Please try another provider."}, 'bookings', 'booking', ${b.id})
      `);
    } catch { /* non-critical */ }

    const updated = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.id)).limit(1);
    res.json(await enrichBooking(updated[0]));
  } catch (err: any) {
    if (err instanceof InvalidTransitionError) { res.status(422).json({ error: err.message }); return; }
    req.log.error({ err }, "Reject booking error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /bookings/:id/cancel — customer or provider cancels a booking ─────────
router.post("/:id/cancel", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { reason } = req.body;
    const rows = toRows(await db.execute(sql`SELECT * FROM bookings WHERE id = ${req.params.id} LIMIT 1`));
    if (rows.length === 0) { res.status(404).json({ error: "Booking not found" }); return; }
    const b = rows[0];

    const isCustomer = b.customer_id === userId;
    const isProvider = b.provider_id === userId;
    if (!isCustomer && !isProvider) { res.status(403).json({ error: "Not authorised to cancel this booking" }); return; }

    const from = b.status as BookingStatus;

    // Providers cancel in-progress/confirmed bookings via cancel_requested first
    let to: BookingStatus = "cancelled";
    if (isProvider && (from === "confirmed" || from === "in_progress")) {
      to = "cancel_requested";
    }

    try {
      await transitionBooking(req.params.id, from, to, userId, reason || "cancelled by user");
    } catch (e: any) {
      if (e instanceof InvalidTransitionError) { return void res.status(422).json({ error: e.message }); }
      throw e;
    }

    // Notify the other party
    const notifyUserId = isCustomer ? b.provider_id : b.customer_id;
    try {
      const notifId = generateId();
      const label = isCustomer ? "Customer" : "Provider";
      await db.execute(sql`
        INSERT INTO notifications (id, user_id, title, message, category, target_type, target_id)
        VALUES (${notifId}, ${notifyUserId},
          ${"Booking Cancelled"},
          ${reason ? `Booking cancelled by ${label}: ${reason}` : `The booking was cancelled by the ${label}.`}, 'bookings', 'booking', ${b.id})
      `);
    } catch { /* non-critical */ }

    const updated = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.id)).limit(1);
    res.json(await enrichBooking(updated[0]));
  } catch (err: any) {
    if (err instanceof InvalidTransitionError) { res.status(422).json({ error: err.message }); return; }
    req.log.error({ err }, "Cancel booking error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /bookings/cleanup/stale — admin: auto-cancel stale pending bookings ───
router.post("/cleanup/stale", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const callerRows = toRows(await db.execute(sql`SELECT is_admin FROM users WHERE id = ${userId} LIMIT 1`));
    if (!callerRows[0]?.is_admin) { res.status(403).json({ error: "Admin access required" }); return; }
    const maxAgeMinutes = Number(req.body.maxAgeMinutes) || 1440;
    const cancelled = await cancelStalePendingBookings(maxAgeMinutes);
    res.json({ cancelled, message: `${cancelled} stale pending bookings auto-cancelled` });
  } catch (err) {
    req.log.error({ err }, "Cleanup stale error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /bookings ─────────────────────────────────────────────────────────────
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const {
      listingId, startDate, endDate, notes,
      bookingDate, timeSlot, timeSlots,
      serviceType, serviceTypes,
      promoCode,
      idempotencyKey,
    } = req.body;

    // ── P1: Idempotency — prevent double-tap duplicate bookings ──────────────
    if (idempotencyKey) {
      const existingKey = toRows(await db.execute(sql`
        SELECT booking_id FROM idempotency_keys WHERE key = ${idempotencyKey} LIMIT 1
      `));
      if (existingKey.length > 0) {
        const existingBookings = await db
          .select()
          .from(bookingsTable)
          .where(eq(bookingsTable.id, existingKey[0].booking_id))
          .limit(1);
        if (existingBookings.length > 0) {
          if (existingBookings[0].customerId !== userId) {
            res.status(409).json({ error: "Idempotency key is already in use" });
            return;
          }
          const enriched = await enrichBooking(existingBookings[0]);
          return void res.status(200).json({ ...enriched, _idempotent: true });
        }
      }
    }

    // ── No duplicate check needed (callerRole removed; self-booking check below)

    const listings = await db.select().from(listingsTable).where(eq(listingsTable.id, listingId)).limit(1);
    if (listings.length === 0) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    const listing = listings[0];
    if (listing.category === "cars" && (listing.subcategory === "Bike" || listing.vehicleType === "Bike")) {
      res.status(400).json({ error: "Motorcycle rides must be booked through Book a Bike with a pickup and drop-off." });
      return;
    }
    if (isRetiredCategory(listing.subcategory)) {
      res.status(410).json({ error: "This equipment or service type is no longer offered" }); return;
    }

    // Block provider from booking their own listing
    if (listing.providerId === userId) {
      res.status(400).json({ error: "You cannot book your own listing" });
      return;
    }

    // Normalise slot arrays
    const slotsArray: string[] = Array.isArray(timeSlots) && timeSlots.length > 0
      ? timeSlots
      : timeSlot ? [timeSlot] : [];

    const servicesArray: string[] = Array.isArray(serviceTypes) && serviceTypes.length > 0
      ? serviceTypes
      : serviceType ? [serviceType] : [];

    if (bookingDate && slotsArray.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(bookingDate);
      if (selected < today) {
        res.status(400).json({ error: "Cannot book a past date" });
        return;
      }

      // Validate every slot
      for (const slot of slotsArray) {
        if (!TIME_SLOTS.includes(slot)) {
          res.status(400).json({ error: `Invalid time slot: ${slot}` });
          return;
        }
      }

      // Conflict check — fetch all active bookings for this listing+date
      const existing = await db
        .select()
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.listingId, listingId),
            eq(bookingsTable.bookingDate as any, bookingDate)
          )
        );
      const active = existing.filter((b) => b.status !== "cancelled");
      const occupiedSlots = new Set<string>();
      for (const b of active) {
        const bany = b as any;
        if (b.timeSlot) occupiedSlots.add(b.timeSlot);
        if (bany.time_slots) {
          const parsed = safeParseJson(bany.time_slots, []) as string[];
          parsed.forEach(s => occupiedSlots.add(s));
        }
      }
      const conflicting = slotsArray.filter(s => occupiedSlots.has(s));
      if (conflicting.length > 0) {
        res.status(409).json({
          error: `The following time slots are already booked: ${conflicting.join(", ")}. Please choose others.`,
        });
        return;
      }

      // Calculate base price
      const hours = slotsArray.length;
      const baseAmount = Number(listing.price) * hours;

      // Apply promo code if provided
      let discountAmount = 0;
      let appliedPromo: string | null = null;
      if (promoCode) {
        const promoRows = toRows(await db.execute(sql`
          SELECT * FROM promo_codes WHERE UPPER(code) = UPPER(${promoCode}) AND is_active = TRUE LIMIT 1
        `));
        if (promoRows.length > 0) {
          const promo = promoRows[0];
          const notExpired = !promo.expires_at || new Date(promo.expires_at) >= new Date();
          const hasUses = Number(promo.used_count) < Number(promo.max_uses);
          const meetsMin = baseAmount >= Number(promo.min_order);
          if (notExpired && hasUses && meetsMin) {
            discountAmount = (promo.type === "percent" || promo.type === "percentage")
              ? Math.round(baseAmount * Number(promo.value) / 100)
              : Math.min(Number(promo.value), baseAmount);
            appliedPromo = promoRows[0].code;
            // Redemption is recorded only after verified payment capture.
          }
        }
      }

      // Apply Gold Membership 4% discount (on post-promo subtotal)
      let goldDiscountAmount = 0;
      let goldDiscountApplied = false;
      const subtotalAfterPromo = Math.max(0, baseAmount - discountAmount);
      const customerGoldRows = toRows(await db.execute(sql`SELECT is_gold_member, gold_expires_at FROM users WHERE id = ${userId} LIMIT 1`));
      const _cgr = customerGoldRows[0];
      const _goldActive = _cgr?.is_gold_member && (_cgr?.gold_expires_at ? new Date(_cgr.gold_expires_at) > new Date() : false);
      if (_goldActive) {
        goldDiscountAmount = Math.round(subtotalAfterPromo * 0.04 * 100) / 100;
        goldDiscountApplied = true;
      }

      const totalDiscount = discountAmount + goldDiscountAmount;
      const finalAmount = Math.max(0, baseAmount - totalDiscount);

      const booking = {
        id: generateId(),
        customerId: userId,
        providerId: listing.providerId,
        listingId,
        startDate: bookingDate,
        endDate: bookingDate,
        totalDays: 1,
        totalAmount: baseAmount,
        status: "pending" as const,
        paymentStatus: "pending" as const,
        notes: notes || null,
        bookingDate,
        timeSlot: slotsArray[0], // first slot for backward compat
        serviceType: servicesArray[0] || null,
      } as any;

      // Store extended fields via raw SQL since ORM schema may not include them yet
      const inserted = await db.insert(bookingsTable).values(booking).returning();
      const bookingId = inserted[0].id;

      // Update extended columns
      await db.execute(sql`
        UPDATE bookings SET
          time_slots = ${JSON.stringify(slotsArray)},
          service_types = ${JSON.stringify(servicesArray)},
          promo_code = ${appliedPromo},
          discount_amount = ${totalDiscount},
          final_amount = ${finalAmount},
          gold_discount_applied = ${goldDiscountApplied},
          gold_discount_amount = ${goldDiscountAmount},
          payment_due_amount = ${finalAmount}
        WHERE id = ${bookingId}
      `);

      // ── Store idempotency key ─────────────────────────────────────────────────
      if (idempotencyKey) {
        await db.execute(sql`
          INSERT INTO idempotency_keys (key, booking_id, created_at)
          VALUES (${idempotencyKey}, ${bookingId}, NOW())
          ON CONFLICT (key) DO NOTHING
        `);
      }

      // ── Transition log — initial creation ───────────────────────────────────
      try {
        const logId = generateId();
        await db.execute(sql`
          INSERT INTO booking_transition_log
            (id, booking_id, from_status, to_status, actor_id, reason, created_at)
          VALUES (${logId}, ${bookingId}, 'none', 'pending', ${userId}, 'created', NOW())
        `);
      } catch { /* non-critical */ }

      const enriched = await enrichBooking(inserted[0]);
      return void res.status(201).json({
        ...enriched,
        timeSlots: slotsArray,
        serviceTypes: servicesArray,
        promoCode: appliedPromo,
        discountAmount: totalDiscount,
        promoDiscountAmount: discountAmount,
        goldDiscountAmount,
        goldDiscountApplied,
        finalAmount,
        totalAmount: baseAmount,
      });
    } else {
      // Legacy date-range booking — validate dates and amounts
      if (!startDate || !endDate) {
        return void res.status(400).json({ error: "Start date and end date are required" });
      }
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return void res.status(400).json({ error: "Invalid date format" });
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (start < today) {
        return void res.status(400).json({ error: "Start date cannot be in the past" });
      }
      if (end < start) {
        return void res.status(400).json({ error: "End date must be on or after start date" });
      }
      const { totalAmount: inputTotalAmount, finalAmount: inputFinalAmount } = req.body;
      if (inputTotalAmount !== undefined && Number(inputTotalAmount) < 0) {
        return void res.status(400).json({ error: "Booking amount cannot be negative" });
      }
      if (inputFinalAmount !== undefined && Number(inputFinalAmount) < 0) {
        return void res.status(400).json({ error: "Final amount cannot be negative" });
      }
      // ── Overlap detection — prevent double-booking same listing ────────────
      const overlap = await hasDateOverlap(listingId, startDate, endDate);
      if (overlap.conflict) {
        return void res.status(409).json({
          error: "These dates are not available — another booking already exists for this listing in the selected period",
          conflictingBookingId: overlap.conflictingId,
        });
      }

      const diffTime = end.getTime() - start.getTime();
      // Inclusive end-date convention: Apr 20 → Apr 21 = 2 service days
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
      // ── Server-side canonical base amount ───────────────────────────────────
      const serverBaseAmount = Number(listing.price) * diffDays;
      const { totalAmount: inputTA, finalAmount: _ignored } = req.body;
      // Reject if client sends an amount more than 25% below server calculation (manipulation guard)
      if (inputTA !== undefined && Number(inputTA) < serverBaseAmount * 0.75) {
        return void res.status(400).json({
          error: `Amount mismatch: client sent ₹${Number(inputTA).toFixed(2)} but server calculates ₹${serverBaseAmount.toFixed(2)} for ${diffDays} day(s) at ₹${listing.price}/day`,
        });
      }
      const baseAmount = serverBaseAmount;

      let discountAmount = 0;
      let appliedPromo: string | null = null;
      if (promoCode) {
        const promoRows = toRows(await db.execute(sql`
          SELECT * FROM promo_codes WHERE UPPER(code) = UPPER(${promoCode}) AND is_active = TRUE LIMIT 1
        `));
        if (promoRows.length > 0) {
          const promo = promoRows[0];
          const notExpired = !promo.expires_at || new Date(promo.expires_at) >= new Date();
          const hasUses = Number(promo.used_count) < Number(promo.max_uses);
          const meetsMin = baseAmount >= Number(promo.min_order);
          if (notExpired && hasUses && meetsMin) {
            discountAmount = (promo.type === "percent" || promo.type === "percentage")
              ? Math.round(baseAmount * Number(promo.value) / 100)
              : Math.min(Number(promo.value), baseAmount);
            appliedPromo = promo.code;
            // Redemption is recorded only after verified payment capture.
          }
        }
      }

      // Apply Gold Membership 4% discount (on post-promo subtotal)
      let goldDiscountAmount2 = 0;
      let goldDiscountApplied2 = false;
      const subtotalAfterPromo2 = Math.max(0, baseAmount - discountAmount);
      const custGoldRows2 = toRows(await db.execute(sql`SELECT is_gold_member, gold_expires_at FROM users WHERE id = ${userId} LIMIT 1`));
      const _cgr2 = custGoldRows2[0];
      const _goldActive2 = _cgr2?.is_gold_member && (_cgr2?.gold_expires_at ? new Date(_cgr2.gold_expires_at) > new Date() : false);
      if (_goldActive2) {
        goldDiscountAmount2 = Math.round(subtotalAfterPromo2 * 0.04 * 100) / 100;
        goldDiscountApplied2 = true;
      }

      const totalDiscount2 = discountAmount + goldDiscountAmount2;
      const finalAmount = Math.max(0, baseAmount - totalDiscount2);

      const booking = {
        id: generateId(),
        customerId: userId,
        providerId: listing.providerId,
        listingId,
        startDate,
        endDate,
        totalDays: diffDays,
        totalAmount: baseAmount,
        status: "pending" as const,
        paymentStatus: "pending" as const,
        notes: notes || null,
        bookingDate: bookingDate || null,
        timeSlot: timeSlot || null,
        serviceType: servicesArray[0] || serviceType || null,
      } as any;

      const inserted = await db.insert(bookingsTable).values(booking).returning();
      const bookingId = inserted[0].id;

      await db.execute(sql`
        UPDATE bookings SET
          service_types = ${JSON.stringify(servicesArray)},
          promo_code = ${appliedPromo},
          discount_amount = ${totalDiscount2},
          final_amount = ${finalAmount},
          gold_discount_applied = ${goldDiscountApplied2},
          gold_discount_amount = ${goldDiscountAmount2},
          payment_due_amount = ${finalAmount}
        WHERE id = ${bookingId}
      `);

      if (idempotencyKey) {
        await db.execute(sql`
          INSERT INTO idempotency_keys (key, booking_id, created_at)
          VALUES (${idempotencyKey}, ${bookingId}, NOW())
          ON CONFLICT (key) DO NOTHING
        `);
      }

      try {
        const logId = generateId();
        await db.execute(sql`
          INSERT INTO booking_transition_log
            (id, booking_id, from_status, to_status, actor_id, reason, created_at)
          VALUES (${logId}, ${bookingId}, 'none', 'pending', ${userId}, 'created', NOW())
        `);
      } catch { /* non-critical */ }

      const enriched = await enrichBooking(inserted[0]);
      return void res.status(201).json({
        ...enriched,
        serviceTypes: servicesArray,
        promoCode: appliedPromo,
        discountAmount: totalDiscount2,
        promoDiscountAmount: discountAmount,
        goldDiscountAmount: goldDiscountAmount2,
        goldDiscountApplied: goldDiscountApplied2,
        finalAmount,
        totalAmount: baseAmount,
      });
    }
  } catch (err) {
    req.log.error({ err }, "Create booking error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /bookings/:id/invoice — immutable paid transaction invoice ──────────
router.get("/:id/invoice", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const callerRows = toRows(await db.execute(sql`SELECT is_admin FROM users WHERE id = ${userId} LIMIT 1`));
    const isAdmin = callerRows[0]?.is_admin === true || callerRows[0]?.is_admin === "t";
    const rows = toRows(await db.execute(sql`
      SELECT i.*, b.customer_id, b.provider_id, l.title AS listing_title,
             u.name AS customer_name
      FROM invoices i
      JOIN bookings b ON b.id = i.booking_id
      LEFT JOIN listings l ON l.id = b.listing_id
      LEFT JOIN users u ON u.id = b.customer_id
      WHERE i.booking_id = ${req.params.id}
      LIMIT 1
    `));
    const invoice = rows[0];
    if (!invoice) {
      res.status(404).json({ error: "Invoice is not available until payment is verified" });
      return;
    }
    if (!isAdmin && invoice.customer_id !== userId) {
      res.status(403).json({ error: "Not authorised to view this invoice" });
      return;
    }
    const response = {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      bookingId: invoice.booking_id,
      listingTitle: invoice.listing_title,
      customerName: invoice.customer_name,
      paymentId: invoice.razorpay_payment_id,
      currency: invoice.currency,
      subtotal: Number(invoice.subtotal),
      discountAmount: Number(invoice.discount_amount),
      totalAmount: Number(invoice.total_amount),
      status: invoice.status,
      issuedAt: invoice.issued_at,
    };
    if (req.query.download === "1") {
      res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoice_number}.json"`);
    }
    res.json(response);
  } catch (err) {
    req.log.error({ err }, "Get booking invoice error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.id)).limit(1);
    if (bookings.length === 0) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }
    const callerRows = toRows(await db.execute(sql`SELECT is_admin FROM users WHERE id = ${userId} LIMIT 1`));
    const isAdmin = callerRows[0]?.is_admin === true || callerRows[0]?.is_admin === "t";
    if (!isAdmin && bookings[0].customerId !== userId && bookings[0].providerId !== userId) {
      res.status(403).json({ error: "Not authorised to view this booking" });
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
    const userId = (req as Request & { userId: string }).userId;
    const { status, reason } = req.body;
    if (req.body.paymentStatus !== undefined) {
      res.status(400).json({ error: "Payment status can only be changed by verified payment processing" });
      return;
    }

    // Fetch current booking — verify caller is participant or admin
    const rows = toRows(await db.execute(sql`SELECT * FROM bookings WHERE id = ${req.params.id} LIMIT 1`));
    if (rows.length === 0) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }
    const booking = rows[0];

    const callerUser = toRows(await db.execute(sql`SELECT role, is_admin FROM users WHERE id = ${userId} LIMIT 1`));
    const isAdmin = callerUser[0]?.is_admin === true || callerUser[0]?.is_admin === "t";
    const isParticipant = booking.customer_id === userId || booking.provider_id === userId;
    if (!isAdmin && !isParticipant) {
      res.status(403).json({ error: "Not authorised to update this booking" });
      return;
    }

    // Validate state machine transition
    if (status && status !== booking.status) {
      if (!isValidStatus(status)) {
        res.status(400).json({ error: `Unknown booking status: ${status}` });
        return;
      }
      if (!isValidStatus(booking.status)) {
        res.status(400).json({ error: `Booking has unknown current status: ${booking.status}` });
        return;
      }

      // Role guards — only providers can confirm; only customers/admins can cancel
      if (status === "confirmed" && !isAdmin && booking.provider_id !== userId) {
        res.status(403).json({ error: "Only the provider can confirm a booking" });
        return;
      }
      if (status === "confirmed" && booking.payment_status !== "paid") {
        res.status(409).json({ error: "Payment must be verified before this booking can be confirmed" });
        return;
      }
      if (status === "cancelled" && !isAdmin && booking.provider_id === userId && booking.customer_id !== userId) {
        // Provider cancellation → go through cancel_requested first
        if (booking.status === "confirmed" || booking.status === "in_progress") {
          res.status(400).json({ error: "Providers must use cancel_requested status first" });
          return;
        }
      }

      // Block review-before-completed via status change (reviews have their own endpoint)
      // Block payout-before-completed
      if ((status === "closed" || status === "refunded") && !isAdmin) {
        res.status(403).json({ error: "Only admins can close or refund bookings" });
        return;
      }

      try {
        await transitionBooking(
          req.params.id,
          booking.status as BookingStatus,
          status as BookingStatus,
          userId,
          reason
        );
      } catch (e: any) {
        if (e instanceof InvalidTransitionError) {
          res.status(422).json({ error: e.message });
          return;
        }
        throw e;
      }
    }

    const updated = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.id)).limit(1);
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

// ── POST /bookings/:id/open-job (provider marks booking as in-progress) ────────
router.post("/:id/open-job", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const rows = toRows(await db.execute(sql`SELECT * FROM bookings WHERE id = ${req.params.id} LIMIT 1`));
    if (rows.length === 0) { res.status(404).json({ error: "Booking not found" }); return; }
    const b = rows[0];
    if (b.provider_id !== userId) { res.status(403).json({ error: "Not your booking" }); return; }
    if (b.status !== "confirmed") { res.status(400).json({ error: "Booking must be confirmed to open" }); return; }

    // Use state machine for validated transition
    await transitionBooking(req.params.id, "confirmed", "in_progress", userId, "provider started job");

    const updated = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.id)).limit(1);
    const enriched = await enrichBooking(updated[0]);
    res.json(enriched);
  } catch (err: any) {
    if (err instanceof InvalidTransitionError) {
      res.status(422).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Open job error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /bookings/:id/complete-job (provider marks job done + commission split) ──
router.post("/:id/complete-job", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { serviceFee, extraCharges } = req.body;

    const rows = toRows(await db.execute(sql`SELECT * FROM bookings WHERE id = ${req.params.id} LIMIT 1`));
    if (rows.length === 0) { res.status(404).json({ error: "Booking not found" }); return; }
    const b = rows[0];
    if (b.provider_id !== userId) { res.status(403).json({ error: "Not your booking" }); return; }
    if (b.status !== "in_progress" && b.status !== "confirmed") {
      res.status(400).json({ error: "Booking must be confirmed or in progress" }); return;
    }

    // ── Guard: check payout eligibility (no fraud hold, no open dispute) ───
    if (b.fraud_hold) {
      res.status(403).json({ error: "This booking has a fraud hold and cannot be completed" }); return;
    }
    if (b.dispute_status && b.dispute_status !== "resolved") {
      res.status(403).json({ error: "Resolve the open dispute before completing this job" }); return;
    }

    // ── Amount calculation ─────────────────────────────────────────────────
    const baseAmount = Number(b.total_amount || 0);
    const discount = Number(b.discount_amount || 0);
    const extraFee = Number(serviceFee) || 0;
    const chargesArr: { label: string; amount: number; description?: string }[] =
      Array.isArray(extraCharges) ? extraCharges : [];
    const chargesTotal = chargesArr.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const finalAmount = Math.max(0, baseAmount + extraFee + chargesTotal - discount);
    const isPrepaid = b.payment_status === "paid";
    if (isPrepaid && (extraFee > 0 || chargesTotal > 0)) {
      res.status(409).json({
        error: "Extra charges require a separate customer payment and cannot be added to an already paid invoice",
      });
      return;
    }
    const settlementAmount = isPrepaid
      ? Number(b.amount_paid || b.final_amount || finalAmount)
      : finalAmount;

    // ── Commission calculation — use pricing_rules if available, else 15% ──
    let commissionRate = 15;
    try {
      const priceRule = toRows(await db.execute(sql`
        SELECT commission_percent FROM pricing_rules
        WHERE category = ${b.service_type || "General"} LIMIT 1
      `));
      if (priceRule.length && Number(priceRule[0].commission_percent) > 0) {
        commissionRate = Number(priceRule[0].commission_percent);
      }
    } catch { /* use default 15% */ }

    const commissionAmount = Math.round((settlementAmount * commissionRate / 100) * 100) / 100;
    const providerEarning = Math.max(0, settlementAmount - commissionAmount);

    // ── Pre-check customer wallet balance before opening transaction ────────
    let customerBalance = 0;
    if (!isPrepaid) {
      const walletCheck = toRows(await db.execute(sql`
        SELECT wallet_balance FROM users WHERE id = ${b.customer_id} LIMIT 1
      `));
      customerBalance = Number(walletCheck[0]?.wallet_balance ?? 0);
      if (customerBalance < settlementAmount) {
        res.status(400).json({
          error: `Customer has insufficient wallet balance. Required: ₹${settlementAmount.toFixed(2)}, Available: ₹${customerBalance.toFixed(2)}`,
        });
        return;
      }
    }

    // ── Idempotency: prevent double-completion via payment event log ─────────
    const completeEventKey = `complete-job:${req.params.id}`;
    const existingEvent = toRows(await db.execute(sql`
      SELECT id FROM payment_event_logs WHERE idempotency_key = ${completeEventKey} LIMIT 1
    `));
    if (existingEvent.length > 0) {
      const updated = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.id)).limit(1);
      const enriched = await enrichBooking(updated[0]);
      return void res.json({ ...enriched, commissionAmount, commissionRate, providerEarning, _idempotent: true });
    }

    // ── Atomic transaction: claim completion + settle exactly once ──────────
    const custTxId = `${Date.now()}c${Math.random().toString(36).slice(2, 6)}`;
    const txId = `${Date.now()}p${Math.random().toString(36).slice(2, 6)}`;
    const eventLogId = `${Date.now()}e${Math.random().toString(36).slice(2, 6)}`;

    const settlement = await db.transaction(async (tx) => {
      // 1. Claim the unique completion event before any balance mutation.
      // Concurrent retries block here; only one receives a returned row.
      const eventRows = toRows(await tx.execute(sql`
        INSERT INTO payment_event_logs
          (id, idempotency_key, booking_id, event_type, amount, actor_id, status)
        VALUES (
          ${eventLogId}, ${completeEventKey}, ${req.params.id},
          'complete_job', ${settlementAmount}, ${userId}, 'success'
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id
      `));
      if (eventRows.length === 0) {
        return { idempotent: true, newCustomerBalance: 0, newProviderBalance: 0 };
      }

      // 2. Mark booking completed with all financial fields. A zero-row result
      // rolls back the event claim, so no payout can happen for stale state.
      const completedRows = toRows(await tx.execute(sql`
        UPDATE bookings SET
          status = 'completed',
          completed_at = NOW(),
          updated_at = NOW(),
          service_fee = ${extraFee},
          extra_charges = ${JSON.stringify(chargesArr)},
          final_amount = ${settlementAmount},
          commission_amount = ${commissionAmount},
          commission_rate = ${commissionRate},
          provider_earning = ${providerEarning}
        WHERE id = ${req.params.id} AND status IN ('confirmed', 'in_progress')
        RETURNING id
      `));
      if (completedRows.length === 0) {
        throw new Error("BOOKING_ALREADY_COMPLETED");
      }

      // 3. Legacy unpaid bookings settle from wallet. Razorpay-paid bookings
      // were already collected, so completion must never charge the customer again.
      let newCustomerBalance = 0;
      if (!isPrepaid) {
        const custRows = toRows(await tx.execute(sql`
          UPDATE users SET wallet_balance = wallet_balance - ${settlementAmount}
          WHERE id = ${b.customer_id} AND wallet_balance >= ${settlementAmount}
          RETURNING wallet_balance
        `));
        if (custRows.length === 0) {
          throw new Error("INSUFFICIENT_WALLET_BALANCE");
        }
        newCustomerBalance = Number(custRows[0].wallet_balance);
      } else {
        newCustomerBalance = customerBalance;
      }

      // 4. Credit provider wallet atomically
      const provRows = toRows(await tx.execute(sql`
        UPDATE users SET wallet_balance = wallet_balance + ${providerEarning}
        WHERE id = ${userId}
        RETURNING wallet_balance
      `));
      const newProviderBalance = Number(provRows[0]?.wallet_balance ?? 0);

      // 5. Customer wallet debit record (legacy wallet settlement only)
      if (!isPrepaid) {
        await tx.execute(sql`
          INSERT INTO wallet_transactions
            (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
          VALUES (
            ${custTxId}, ${b.customer_id}, 'payment', ${settlementAmount}, ${newCustomerBalance},
            ${req.params.id}, 'booking',
            ${"Payment for booking – " + (b.listing_id || "service")},
            'completed'
          )
        `);
      }

      // 6. Provider wallet credit record
      await tx.execute(sql`
        INSERT INTO wallet_transactions
          (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
        VALUES (
          ${txId}, ${userId}, 'earning', ${providerEarning}, ${newProviderBalance},
          ${req.params.id}, 'booking',
          ${"Booking earning (after " + commissionRate + "% platform commission)"},
          'completed'
        )
      `);

      // 7. Transition audit log
      try {
        const logId = generateId();
        await tx.execute(sql`
          INSERT INTO booking_transition_log
            (id, booking_id, from_status, to_status, actor_id, reason)
          VALUES (${logId}, ${req.params.id}, ${b.status}, 'completed', ${userId}, 'job completed by provider')
        `);
      } catch { /* non-critical */ }

      return { idempotent: false, newCustomerBalance, newProviderBalance };
    });

    if (settlement.idempotent) {
      const updated = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.id)).limit(1);
      const enriched = await enrichBooking(updated[0]);
      return void res.json({ ...enriched, commissionAmount, commissionRate, providerEarning, _idempotent: true });
    }

    const updated = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.id)).limit(1);
    const enriched = await enrichBooking(updated[0]);
    res.json({
      ...enriched,
      commissionAmount,
      commissionRate,
      providerEarning,
      newProviderBalance: settlement.newProviderBalance,
      newCustomerBalance: settlement.newCustomerBalance,
    });

    // ── Fire-and-forget: process referral progress ─────────────────────────
    processReferralCompletion(b.customer_id, userId, req.params.id).catch(() => {});
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_WALLET_BALANCE") {
      res.status(409).json({ error: "Customer wallet balance changed — insufficient funds. Please retry." });
      return;
    }
    req.log.error({ err }, "Complete job error");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function processReferralCompletion(customerId: string, providerId: string, bookingId: string) {
  function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function toRowsLocal(r: any) { return Array.isArray(r) ? r : (r?.rows ?? []); }
  const THRESHOLD = 5;
  const REWARD_PCT = 10;

  // ── Customer referral check ────────────────────────────────────────────────
  try {
    const custRows = toRowsLocal(await db.execute(sql`
      SELECT referred_by, referral_first_completion_counted FROM users WHERE id = ${customerId} LIMIT 1
    `));
    const cust = custRows[0];
    if (cust?.referred_by && !cust.referral_first_completion_counted) {
      // Mark customer's first completion as counted
      await db.execute(sql`UPDATE users SET referral_first_completion_counted = TRUE WHERE id = ${customerId}`);
      // Update referral record
      await db.execute(sql`
        UPDATE referrals SET first_completion_done = TRUE
        WHERE id = (
          SELECT id FROM referrals
          WHERE referred_user_id = ${customerId} AND first_completion_done = FALSE
          LIMIT 1
        )
      `);
      // Find referrer
      const refRows = toRowsLocal(await db.execute(sql`
        SELECT u.id, u.referral_progress FROM users u
        JOIN referrals r ON r.referrer_id = u.id
        WHERE r.referred_user_id = ${customerId} LIMIT 1
      `));
      if (refRows.length) {
        const referrer = refRows[0];
        const newProgress = Number(referrer.referral_progress || 0) + 1;
        await db.execute(sql`UPDATE users SET referral_progress = ${newProgress} WHERE id = ${referrer.id}`);

        // Notify referrer
        const nId = genId();
        await db.execute(sql.raw(`
          INSERT INTO notifications (id, user_id, title, message)
          VALUES ('${nId}', '${referrer.id}', '🎁 Referral Progress!',
            'One of your referred friends completed their first booking! Progress: ${newProgress % THRESHOLD}/${THRESHOLD}')
        `));

        // Check if reward threshold met
        if (newProgress % THRESHOLD === 0) {
          await db.execute(sql`UPDATE users SET pending_referral_reward = TRUE, total_referral_rewards = total_referral_rewards + 1 WHERE id = ${referrer.id}`);
          const rwId = genId();
          await db.execute(sql.raw(`
            INSERT INTO referral_rewards (id, user_id, reward_type, reward_value, status)
            VALUES ('${rwId}', '${referrer.id}', 'booking_discount', ${REWARD_PCT}, 'pending')
          `));
          // Add to promo vault as 10% off
          const pvId = genId();
          await db.execute(sql.raw(`
            INSERT INTO promo_vault (id, user_id, type, discount_value, discount_type, description, expiry_date)
            VALUES ('${pvId}', '${referrer.id}', 'referral', ${REWARD_PCT}, 'percent', 'Referral Reward – 10% off next booking', NOW() + INTERVAL '30 days')
          `));
          const rn2 = genId();
          await db.execute(sql.raw(`
            INSERT INTO notifications (id, user_id, title, message)
            VALUES ('${rn2}', '${referrer.id}', '🏆 Referral Reward Unlocked!',
              'You referred 5 friends who completed their first booking! 10% off your next booking has been added to your promo vault.')
          `));
        }
      }
    }
  } catch { /* non-critical */ }

  // ── Provider referral check ────────────────────────────────────────────────
  try {
    const provRows = toRowsLocal(await db.execute(sql`
      SELECT referred_by, referral_first_completion_counted FROM users WHERE id = ${providerId} LIMIT 1
    `));
    const prov = provRows[0];
    if (prov?.referred_by && !prov.referral_first_completion_counted) {
      await db.execute(sql`UPDATE users SET referral_first_completion_counted = TRUE WHERE id = ${providerId}`);
      await db.execute(sql`
        UPDATE referrals SET first_completion_done = TRUE
        WHERE id = (
          SELECT id FROM referrals
          WHERE referred_user_id = ${providerId} AND first_completion_done = FALSE
          LIMIT 1
        )
      `);
      const refRows = toRowsLocal(await db.execute(sql`
        SELECT u.id, u.referral_progress FROM users u
        JOIN referrals r ON r.referrer_id = u.id
        WHERE r.referred_user_id = ${providerId} LIMIT 1
      `));
      if (refRows.length) {
        const referrer = refRows[0];
        const newProgress = Number(referrer.referral_progress || 0) + 1;
        await db.execute(sql`UPDATE users SET referral_progress = ${newProgress} WHERE id = ${referrer.id}`);

        const nId = genId();
        await db.execute(sql.raw(`
          INSERT INTO notifications (id, user_id, title, message)
          VALUES ('${nId}', '${referrer.id}', '🎁 Provider Referral Progress!',
            'One of your referred providers completed their first job! Progress: ${newProgress % THRESHOLD}/${THRESHOLD}')
        `));

        if (newProgress % THRESHOLD === 0) {
          await db.execute(sql`UPDATE users SET pending_referral_reward = TRUE, total_referral_rewards = total_referral_rewards + 1 WHERE id = ${referrer.id}`);
          const rwId = genId();
          await db.execute(sql.raw(`
            INSERT INTO referral_rewards (id, user_id, reward_type, reward_value, status)
            VALUES ('${rwId}', '${referrer.id}', 'provider_bonus', ${REWARD_PCT}, 'pending')
          `));
          const pvId = genId();
          await db.execute(sql.raw(`
            INSERT INTO promo_vault (id, user_id, type, discount_value, discount_type, description, expiry_date)
            VALUES ('${pvId}', '${referrer.id}', 'referral', ${REWARD_PCT}, 'percent', 'Provider Referral Bonus – 10% on next earnings', NOW() + INTERVAL '30 days')
          `));
          const rn2 = genId();
          await db.execute(sql.raw(`
            INSERT INTO notifications (id, user_id, title, message)
            VALUES ('${rn2}', '${referrer.id}', '🏆 Provider Referral Reward!',
              '5 providers you referred completed their first job! +10% bonus applies to your next booking payout.')
          `));
        }
      }
    }
  } catch { /* non-critical */ }
}

export default router;
