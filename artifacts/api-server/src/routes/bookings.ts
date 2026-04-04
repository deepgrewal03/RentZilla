import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { bookingsTable, listingsTable, usersTable } from "@workspace/db";
import { eq, or, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router: IRouter = Router();

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
  const listing = await db.select().from(listingsTable).where(eq(listingsTable.id, booking.listingId)).limit(1);
  const customer = await db.select().from(usersTable).where(eq(usersTable.id, booking.customerId)).limit(1);

  const b = booking as any;
  return {
    id: booking.id,
    customerId: booking.customerId,
    customerName: customer[0]?.name || "Customer",
    customerPhone: customer[0]?.phone || "",
    providerId: booking.providerId,
    listingId: booking.listingId,
    listingTitle: listing[0]?.title || "Listing",
    listingCategory: listing[0]?.category || null,
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
    timeSlots: b.time_slots ? safeParseJson(b.time_slots, []) : null,
    serviceType: b.serviceType || b.service_type || null,
    serviceTypes: b.service_types ? safeParseJson(b.service_types, []) : null,
    promoCode: b.promo_code || null,
    discountAmount: Number(b.discount_amount || 0),
    serviceFee: Number(b.service_fee || 0),
    extraCharges: b.extra_charges ? safeParseJson(b.extra_charges, []) : [],
    finalAmount: Number(b.final_amount || 0) || Number(booking.totalAmount),
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
    if (promo.type === "percent") {
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
      message: promo.type === "percent"
        ? `${promo.value}% off applied — you save ₹${discount.toLocaleString("en-IN")}`
        : `Flat ₹${discount.toLocaleString("en-IN")} off applied`,
    });
  } catch (err) {
    req.log.error({ err }, "Validate promo error");
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
    } = req.body;

    const listings = await db.select().from(listingsTable).where(eq(listingsTable.id, listingId)).limit(1);
    if (listings.length === 0) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    const listing = listings[0];

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
            discountAmount = promo.type === "percent"
              ? Math.round(baseAmount * Number(promo.value) / 100)
              : Math.min(Number(promo.value), baseAmount);
            appliedPromo = promoRows[0].code;
            // Increment used_count
            await db.execute(sql`
              UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ${promo.id}
            `);
          }
        }
      }

      const finalAmount = Math.max(0, baseAmount - discountAmount);

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
          discount_amount = ${discountAmount},
          final_amount = ${finalAmount}
        WHERE id = ${bookingId}
      `);

      const enriched = await enrichBooking(inserted[0]);
      return res.status(201).json({
        ...enriched,
        timeSlots: slotsArray,
        serviceTypes: servicesArray,
        promoCode: appliedPromo,
        discountAmount,
        finalAmount,
        totalAmount: baseAmount,
      });
    } else {
      // Legacy date-range booking
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
      const baseAmount = Number(listing.price) * diffDays;

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
            discountAmount = promo.type === "percent"
              ? Math.round(baseAmount * Number(promo.value) / 100)
              : Math.min(Number(promo.value), baseAmount);
            appliedPromo = promo.code;
            await db.execute(sql`UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ${promo.id}`);
          }
        }
      }

      const finalAmount = Math.max(0, baseAmount - discountAmount);

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
          discount_amount = ${discountAmount},
          final_amount = ${finalAmount}
        WHERE id = ${bookingId}
      `);

      const enriched = await enrichBooking(inserted[0]);
      return res.status(201).json({
        ...enriched,
        serviceTypes: servicesArray,
        promoCode: appliedPromo,
        discountAmount,
        finalAmount,
        totalAmount: baseAmount,
      });
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

// ── POST /bookings/:id/open-job (provider marks booking as in-progress) ────────
router.post("/:id/open-job", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const rows = toRows(await db.execute(sql`SELECT * FROM bookings WHERE id = ${req.params.id} LIMIT 1`));
    if (rows.length === 0) { res.status(404).json({ error: "Booking not found" }); return; }
    const b = rows[0];
    if (b.provider_id !== userId) { res.status(403).json({ error: "Not your booking" }); return; }
    if (b.status !== "confirmed") { res.status(400).json({ error: "Booking must be confirmed to open" }); return; }
    await db.execute(sql`UPDATE bookings SET status = 'in_progress' WHERE id = ${req.params.id}`);
    const updated = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.id)).limit(1);
    const enriched = await enrichBooking(updated[0]);
    res.json(enriched);
  } catch (err) {
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

    // ── Amount calculation ─────────────────────────────────────────────────
    const baseAmount = Number(b.total_amount || 0);
    const discount = Number(b.discount_amount || 0);
    const extraFee = Number(serviceFee) || 0;
    const chargesArr: { label: string; amount: number; description?: string }[] =
      Array.isArray(extraCharges) ? extraCharges : [];
    const chargesTotal = chargesArr.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const finalAmount = Math.max(0, baseAmount + extraFee + chargesTotal - discount);

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
    } catch { /* use default */ }

    const commissionAmount = Math.round((finalAmount * commissionRate / 100) * 100) / 100;
    const providerEarning = Math.max(0, finalAmount - commissionAmount);

    // ── Update booking ─────────────────────────────────────────────────────
    await db.execute(sql`
      UPDATE bookings SET
        status = 'completed',
        service_fee = ${extraFee},
        extra_charges = ${JSON.stringify(chargesArr)},
        final_amount = ${finalAmount},
        commission_amount = ${commissionAmount},
        commission_rate = ${commissionRate},
        provider_earning = ${providerEarning}
      WHERE id = ${req.params.id}
    `);

    // ── Deduct customer wallet (atomic) ────────────────────────────────────
    const customerRow = toRows(await db.execute(sql`
      UPDATE users SET wallet_balance = wallet_balance - ${finalAmount}
      WHERE id = ${b.customer_id} RETURNING wallet_balance
    `));
    const newCustomerBalance = Number(customerRow[0]?.wallet_balance || 0);

    // ── Record wallet transaction for customer (debit) ──────────────────────
    const custTxId = `${Date.now()}c${Math.random().toString(36).slice(2, 6)}`;
    await db.execute(sql`
      INSERT INTO wallet_transactions
        (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
      VALUES (
        ${custTxId}, ${b.customer_id}, 'payment', ${finalAmount}, ${newCustomerBalance},
        ${req.params.id}, 'booking',
        ${'Payment for booking – ' + (b.listing_id || 'service')},
        'completed'
      )
    `);

    // ── Credit provider wallet (atomic update) ─────────────────────────────
    const walletUpdated = toRows(await db.execute(sql`
      UPDATE users SET wallet_balance = wallet_balance + ${providerEarning}
      WHERE id = ${userId} RETURNING wallet_balance
    `));
    const newProviderBalance = Number(walletUpdated[0]?.wallet_balance || 0);

    // ── Record wallet transaction for provider (credit) ─────────────────────
    const txId = `${Date.now()}p${Math.random().toString(36).slice(2, 6)}`;
    await db.execute(sql`
      INSERT INTO wallet_transactions
        (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
      VALUES (
        ${txId}, ${userId}, 'earning', ${providerEarning}, ${newProviderBalance},
        ${req.params.id}, 'booking',
        ${'Booking earning (after ' + commissionRate + '% platform commission)'},
        'completed'
      )
    `);

    const updated = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.id)).limit(1);
    const enriched = await enrichBooking(updated[0]);
    res.json({ ...enriched, commissionAmount, commissionRate, providerEarning, newProviderBalance, newCustomerBalance });
  } catch (err) {
    req.log.error({ err }, "Complete job error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
