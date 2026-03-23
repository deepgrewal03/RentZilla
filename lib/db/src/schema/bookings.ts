import { pgTable, text, timestamp, pgEnum, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingStatusEnum = pgEnum("booking_status", ["pending", "confirmed", "completed", "cancelled"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "refunded"]);

export const bookingsTable = pgTable("bookings", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  providerId: text("provider_id").notNull(),
  listingId: text("listing_id").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  totalDays: integer("total_days").notNull().default(1),
  totalAmount: real("total_amount").notNull(),
  status: bookingStatusEnum("status").notNull().default("pending"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ createdAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
