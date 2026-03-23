import { pgTable, text, timestamp, pgEnum, real, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const categoryEnum = pgEnum("category", ["cars", "equipment", "services"]);
export const priceUnitEnum = pgEnum("price_unit", ["per_day", "per_hour"]);

export const listingsTable = pgTable("listings", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull(),
  category: categoryEnum("category").notNull(),
  subcategory: text("subcategory"),
  title: text("title").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  priceUnit: priceUnitEnum("price_unit").notNull().default("per_day"),
  images: jsonb("images").$type<string[]>().default([]),
  location: text("location").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertListingSchema = createInsertSchema(listingsTable).omit({ createdAt: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listingsTable.$inferSelect;
