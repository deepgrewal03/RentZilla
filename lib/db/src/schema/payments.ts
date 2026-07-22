import { pgTable, text, timestamp, integer, numeric, jsonb } from "drizzle-orm/pg-core";

export const razorpayOrdersTable = pgTable("razorpay_orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  razorpayOrderId: text("razorpay_order_id").notNull(),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpaySignature: text("razorpay_signature"),
  purpose: text("purpose").notNull(),
  amountInr: numeric("amount_inr", { precision: 10, scale: 2 }).notNull(),
  amountPaise: integer("amount_paise").notNull(),
  status: text("status").notNull().default("created"),
  notes: jsonb("notes"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentEventLogsTable = pgTable("payment_event_logs", {
  id: text("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull(),
  bookingId: text("booking_id").notNull(),
  eventType: text("event_type").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  actorId: text("actor_id").notNull(),
  status: text("status").notNull().default("success"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const idempotencyKeysTable = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),
  bookingId: text("booking_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const escrowTable = pgTable("escrow", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull().default("held"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  heldAt: timestamp("held_at", { withTimezone: true }).notNull().defaultNow(),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  releasedTo: text("released_to"),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RazorpayOrder = typeof razorpayOrdersTable.$inferSelect;
export type Escrow = typeof escrowTable.$inferSelect;
