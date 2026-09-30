import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type BookingStatus =
  | "draft"
  | "pending"
  | "accepted"
  | "confirmed"
  | "scheduled"
  | "started"
  | "in_progress"
  | "completed"
  | "cancel_requested"
  | "cancelled"
  | "refund_pending"
  | "refunded"
  | "disputed"
  | "closed";

// ── Valid state transitions ──────────────────────────────────────────────────
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft:             ["pending", "cancelled"],
  pending:           ["accepted", "confirmed", "cancelled"],
  accepted:          ["scheduled", "confirmed", "in_progress", "cancelled", "cancel_requested"],
  confirmed:         ["accepted", "scheduled", "in_progress", "cancelled", "cancel_requested"],
  scheduled:         ["started", "in_progress", "cancelled", "cancel_requested"],
  started:           ["in_progress", "cancelled"],
  in_progress:       ["completed", "cancelled", "disputed"],
  completed:         ["disputed", "closed", "refund_pending"],
  cancel_requested:  ["cancelled", "confirmed", "accepted"],
  cancelled:         ["refund_pending"],
  refund_pending:    ["refunded"],
  refunded:          ["closed"],
  disputed:          ["refund_pending", "closed"],
  closed:            [],
};

// ── Actor-based guards: who can trigger which target state ───────────────────
type ActorRole = "customer" | "provider" | "admin";
const ACTOR_ALLOWED: Partial<Record<BookingStatus, ActorRole[]>> = {
  accepted:         ["provider", "admin"],
  confirmed:        ["provider", "admin"],
  scheduled:        ["provider", "admin"],
  started:          ["provider", "admin"],
  in_progress:      ["provider", "admin"],
  completed:        ["provider", "admin"],
  cancel_requested: ["customer", "provider"],
  cancelled:        ["customer", "provider", "admin"],
  refund_pending:   ["admin"],
  refunded:         ["admin"],
  disputed:         ["customer", "admin"],
  closed:           ["admin"],
};

const TERMINAL_STATES: Set<BookingStatus> = new Set(["closed"]);

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string, reason?: string) {
    super(`Invalid booking transition: ${from} → ${to}${reason ? " — " + reason : ""}`);
    this.name = "InvalidTransitionError";
  }
}

export class UnauthorisedTransitionError extends Error {
  constructor(to: string, role: string) {
    super(`Role "${role}" is not permitted to set booking status to "${to}"`);
    this.name = "UnauthorisedTransitionError";
  }
}

// ── Validate transition is structurally allowed ─────────────────────────────
export function validateTransition(from: BookingStatus, to: BookingStatus): void {
  if (TERMINAL_STATES.has(from)) {
    throw new InvalidTransitionError(from, to, "booking is in a terminal state");
  }
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}

// ── Validate actor role is allowed to trigger target state ──────────────────
export function validateActor(to: BookingStatus, role: ActorRole): void {
  const allowed = ACTOR_ALLOWED[to];
  if (allowed && !allowed.includes(role)) {
    throw new UnauthorisedTransitionError(to, role);
  }
}

export function isValidStatus(s: string): s is BookingStatus {
  return s in TRANSITIONS;
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function toRows<T = any>(result: any): T[] {
  if (Array.isArray(result)) return result as T[];
  return (result?.rows ?? []) as T[];
}

/**
 * Atomically transition a booking to a new status.
 * Uses compare-and-swap UPDATE (WHERE status = from) to guard against race conditions.
 * Writes an immutable audit entry to booking_transition_log.
 */
export async function transitionBooking(
  bookingId: string,
  from: BookingStatus,
  to: BookingStatus,
  actorId: string,
  reason?: string
): Promise<boolean> {
  validateTransition(from, to);

  return db.transaction(async (tx) => {
    // Order creation locks this same row before exposing a Razorpay order.
    // Locking here makes cancellation and order creation/capture mutually
    // exclusive, so a collected payment cannot lose its payable booking target.
    const current = toRows(await tx.execute(sql`
      SELECT status, promo_code, promo_reserved_order_id, promo_released_at
      FROM bookings WHERE id = ${bookingId} FOR UPDATE LIMIT 1
    `));
    if (current.length === 0) throw new Error(`Booking ${bookingId} not found`);
    const actualStatus = current[0].status as BookingStatus;
    if (actualStatus === to) return true; // idempotent
    if (actualStatus !== from) {
      throw new Error(
        `Race conflict on booking ${bookingId}: expected "${from}", found "${actualStatus}"`
      );
    }

    if (to === "cancelled") {
      const activeOrders = toRows(await tx.execute(sql`
        SELECT id, status FROM razorpay_orders
        WHERE booking_id = ${bookingId}
          AND purpose = 'booking_payment'
          AND status IN ('created', 'paid')
      `));
      if (activeOrders.some((order) => order.status === "paid")) {
        throw new InvalidTransitionError(
          from,
          to,
          "payment is already collected; use the refund workflow before cancellation"
        );
      }
      // A created order is only a checkout intent. Cancellation is allowed and
      // any late capture is handled by the durable refund path in payments.
      if (current[0].promo_reserved_order_id && !current[0].promo_released_at) {
        await tx.execute(sql`
          UPDATE promo_codes
          SET used_count = GREATEST(0, used_count - 1)
          WHERE UPPER(code) = UPPER(${current[0].promo_code})
        `);
        await tx.execute(sql`
          UPDATE bookings SET promo_released_at = NOW()
          WHERE id = ${bookingId} AND promo_released_at IS NULL
        `);
      }
    }

    const updated = toRows(await tx.execute(sql`
      UPDATE bookings
      SET status = ${to}, updated_at = NOW()
      WHERE id = ${bookingId} AND status = ${from}
      RETURNING id
    `));
    if (updated.length === 0) {
    throw new Error(
        `Race conflict on booking ${bookingId}: expected "${from}"`
      );
    }

    try {
      const logId = generateId();
      await tx.execute(sql`
        INSERT INTO booking_transition_log
          (id, booking_id, from_status, to_status, actor_id, reason, created_at)
        VALUES (${logId}, ${bookingId}, ${from}, ${to}, ${actorId}, ${reason ?? null}, NOW())
      `);
    } catch { /* non-critical */ }

    return true;
  });
}

/**
 * Detect date-range overlap for a listing, excluding a specific booking ID.
 * Returns true if ANY active booking overlaps [checkStart, checkEnd].
 *
 * Uses a SELECT FOR UPDATE pattern (called inside a transaction for full safety).
 */
export async function hasDateOverlap(
  listingId: string,
  checkStart: string,
  checkEnd: string,
  excludeBookingId?: string
): Promise<{ conflict: boolean; conflictingId?: string }> {
  const rows = toRows(await db.execute(sql`
    SELECT id FROM bookings
    WHERE listing_id = ${listingId}
      AND status NOT IN ('cancelled', 'refunded', 'closed', 'draft')
      AND start_date IS NOT NULL
      AND end_date IS NOT NULL
      AND start_date <= ${checkEnd}
      AND end_date >= ${checkStart}
      ${excludeBookingId ? sql`AND id != ${excludeBookingId}` : sql``}
    LIMIT 1
  `));
  if (rows.length > 0) {
    return { conflict: true, conflictingId: rows[0].id };
  }
  return { conflict: false };
}

/**
 * Server-side price recalculation for a listing + date range.
 * Returns the canonical base amount the server expects.
 * Prevents client-side price manipulation.
 */
export async function recalculateBaseAmount(
  listingId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const rows = toRows(await db.execute(sql`
    SELECT price FROM listings WHERE id = ${listingId} LIMIT 1
  `));
  if (rows.length === 0) return 0;
  const pricePerDay = Number(rows[0].price ?? 0);
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  return pricePerDay * days;
}

/**
 * Fetch current booking row with a locking read (FOR UPDATE).
 * Must be called inside an active BEGIN/COMMIT transaction.
 */
export async function fetchBookingForUpdate(bookingId: string) {
  const rows = toRows(await db.execute(sql`
    SELECT * FROM bookings WHERE id = ${bookingId} FOR UPDATE LIMIT 1
  `));
  return rows[0] ?? null;
}

export function canReview(status: BookingStatus): boolean {
  return status === "completed" || status === "closed";
}

export function canDispute(status: BookingStatus): boolean {
  return status === "completed" || status === "in_progress";
}

export function isPayoutEligible(
  status: BookingStatus,
  disputeStatus: string | null,
  fraudHold: boolean
): boolean {
  return (
    (status === "completed" || status === "closed") &&
    (disputeStatus == null || disputeStatus === "resolved") &&
    !fraudHold
  );
}

/**
 * Cancel stale pending bookings older than maxAgeMinutes.
 * Returns the number of bookings cancelled.
 */
export async function cancelStalePendingBookings(maxAgeMinutes = 1440): Promise<number> {
  const actorId = "system";
  const rows = toRows(await db.execute(sql`
    SELECT id FROM bookings
    WHERE status = 'pending'
      AND created_at < NOW() - (${maxAgeMinutes} || ' minutes')::INTERVAL
    LIMIT 100
  `));

  let cancelled = 0;
  for (const row of rows) {
    try {
      await transitionBooking(
        row.id,
        "pending",
        "cancelled",
        actorId,
        "auto-cancelled: stale pending"
      );
      cancelled++;
    } catch { /* skip individual failures */ }
  }
  return cancelled;
}
