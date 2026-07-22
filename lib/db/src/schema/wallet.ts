import { pgTable, text, timestamp, boolean, numeric } from "drizzle-orm/pg-core";

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 10, scale: 2 }).notNull().default("0"),
  referenceId: text("reference_id"),
  referenceType: text("reference_type"),
  description: text("description"),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payoutsTable = pgTable("payouts", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  method: text("method").notNull().default("instant"),
  bankRef: text("bank_ref"),
  upiId: text("upi_id"),
  status: text("status").notNull().default("pending"),
  scheduledAt: timestamp("scheduled_at"),
  processedAt: timestamp("processed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userPaymentMethodsTable = pgTable("user_payment_methods", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  label: text("label").notNull(),
  encryptedDetails: text("encrypted_details").notNull(),
  maskedDisplay: text("masked_display").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const platformPaymentMethodsTable = pgTable("platform_payment_methods", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  label: text("label").notNull(),
  details: text("details").notNull().default("{}"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
export type Payout = typeof payoutsTable.$inferSelect;
