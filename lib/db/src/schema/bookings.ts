import { pgTable, text, timestamp, integer, boolean, numeric, real, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending", "confirmed", "completed", "cancelled",
  "in_progress", "cancel_requested", "refund_pending", "refunded",
  "disputed", "closed", "draft", "accepted", "scheduled", "started",
]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "refunded"]);

export const bookingsTable = pgTable("bookings", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  providerId: text("provider_id").notNull(),
  listingId: text("listing_id").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  totalDays: integer("total_days").notNull().default(1),
  totalAmount: real("total_amount").notNull().default(0),
  status: bookingStatusEnum("status").notNull().default("pending"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  notes: text("notes"),
  bookingDate: text("booking_date"),
  timeSlot: text("time_slot"),
  serviceType: text("service_type"),
  timeSlots: text("time_slots"),
  serviceTypes: text("service_types"),
  promoCode: text("promo_code"),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  finalAmount: numeric("final_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  serviceFee: numeric("service_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  extraCharges: text("extra_charges"),
  commissionAmount: numeric("commission_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  providerEarning: numeric("provider_earning", { precision: 10, scale: 2 }).notNull().default("0"),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull().default("15"),
  goldDiscountApplied: boolean("gold_discount_applied").notNull().default(false),
  goldDiscountAmount: numeric("gold_discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  disputeStatus: text("dispute_status"),
  fraudHold: boolean("fraud_hold").notNull().default(false),
  cancelledAt: timestamp("cancelled_at"),
  completedAt: timestamp("completed_at"),
  idempotencyKey: text("idempotency_key"),
  disputeReason: text("dispute_reason"),
  disputeOpenedAt: timestamp("dispute_opened_at"),
  refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  disputeResolution: text("dispute_resolution"),
  disputeResolvedAt: timestamp("dispute_resolved_at"),
  disputeResolvedBy: text("dispute_resolved_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ createdAt: true, updatedAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
