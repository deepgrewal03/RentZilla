import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";

export const goldPurchasesTable = pgTable("gold_purchases", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("2.49"),
  status: text("status").notNull().default("completed"),
  txId: text("tx_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type GoldPurchase = typeof goldPurchasesTable.$inferSelect;
