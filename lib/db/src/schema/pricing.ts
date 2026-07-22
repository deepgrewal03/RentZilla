import { pgTable, text, timestamp, integer, boolean, numeric } from "drizzle-orm/pg-core";

export const pricingRulesTable = pgTable("pricing_rules", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  subcategory: text("subcategory").notNull(),
  baseFee: numeric("base_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  dailyRate: numeric("daily_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  kmRate: numeric("km_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  operatorFee: numeric("operator_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  fuelFee: numeric("fuel_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  materialFee: numeric("material_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  urgencyFee: numeric("urgency_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  platformFee: numeric("platform_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  commissionPercent: numeric("commission_percent", { precision: 5, scale: 2 }).notNull().default("10"),
  securityDeposit: numeric("security_deposit", { precision: 10, scale: 2 }).notNull().default("0"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pricingServiceTypeRulesTable = pgTable("pricing_service_type_rules", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  subcategory: text("subcategory").notNull(),
  serviceType: text("service_type").notNull(),
  baseFee: numeric("base_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  dailyRate: numeric("daily_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  kmRate: numeric("km_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  operatorFee: numeric("operator_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  fuelFee: numeric("fuel_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  materialFee: numeric("material_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  urgencyFee: numeric("urgency_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  platformFee: numeric("platform_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  commissionPercent: numeric("commission_percent", { precision: 5, scale: 2 }).notNull().default("10"),
  securityDeposit: numeric("security_deposit", { precision: 10, scale: 2 }).notNull().default("0"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const promoCodesTable = pgTable("promo_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  type: text("type").notNull().default("percent"),
  value: numeric("value", { precision: 10, scale: 2 }).notNull().default("0"),
  minOrder: numeric("min_order", { precision: 10, scale: 2 }).notNull().default("0"),
  maxUses: integer("max_uses").notNull().default(100),
  usedCount: integer("used_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  expiresAt: timestamp("expires_at"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PricingRule = typeof pricingRulesTable.$inferSelect;
export type PromoCode = typeof promoCodesTable.$inferSelect;
