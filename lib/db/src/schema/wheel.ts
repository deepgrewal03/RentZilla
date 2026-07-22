import { pgTable, text, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";

export const wheelSpinsTable = pgTable("wheel_spins", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  spinType: text("spin_type").notNull().default("free"),
  rewardLabel: text("reward_label"),
  discountValue: numeric("discount_value", { precision: 5, scale: 2 }).notNull().default("0"),
  paymentAmount: numeric("payment_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  segmentIndex: integer("segment_index").notNull().default(6),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const promoVaultTable = pgTable("promo_vault", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull().default("wheel"),
  discountValue: numeric("discount_value", { precision: 5, scale: 2 }).notNull().default("0"),
  discountType: text("discount_type").notNull().default("percent"),
  description: text("description"),
  expiryDate: timestamp("expiry_date"),
  spinId: text("spin_id"),
  isUsed: boolean("is_used").notNull().default(false),
  isExpired: boolean("is_expired").notNull().default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WheelSpin = typeof wheelSpinsTable.$inferSelect;
export type PromoVault = typeof promoVaultTable.$inferSelect;
