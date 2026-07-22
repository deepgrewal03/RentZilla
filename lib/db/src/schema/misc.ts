import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const bookingTransitionLogTable = pgTable("booking_transition_log", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  actorId: text("actor_id").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const passwordResetOtpsTable = pgTable("password_reset_otps", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  otp: text("otp").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const documentsTable = pgTable("documents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  url: text("url").notNull(),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const otpsTable = pgTable("otps", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  code: text("code").notNull(),
  purpose: text("purpose"),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BookingTransitionLog = typeof bookingTransitionLogTable.$inferSelect;
export type Document = typeof documentsTable.$inferSelect;
