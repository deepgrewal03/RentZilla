import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const disputesTable = pgTable("disputes", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  raisedBy: text("raised_by").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  resolution: text("resolution"),
  resolvedBy: text("resolved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const disputeMessagesTable = pgTable("dispute_messages", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  senderId: text("sender_id").notNull(),
  senderRole: text("sender_role").notNull().default("customer"),
  content: text("content").notNull(),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Dispute = typeof disputesTable.$inferSelect;
export type DisputeMessage = typeof disputeMessagesTable.$inferSelect;
