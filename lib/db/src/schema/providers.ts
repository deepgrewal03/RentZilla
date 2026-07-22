import { pgTable, text, timestamp, integer, boolean, numeric } from "drizzle-orm/pg-core";

export const equipmentProviderDetailsTable = pgTable("equipment_provider_details", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  equipmentName: text("equipment_name").notNull(),
  licenseNumber: text("license_number"),
  make: text("make"),
  model: text("model"),
  year: text("year"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const serviceProviderDetailsTable = pgTable("service_provider_details", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  fullName: text("full_name").notNull(),
  serviceType: text("service_type").notNull(),
  area: text("area").notNull(),
  address: text("address").notNull(),
  aadhaarNumber: text("aadhaar_number").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const providerDocumentsTable = pgTable("provider_documents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  serviceType: text("service_type").notNull(),
  documentType: text("document_type").notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const providerPriceReferenceTable = pgTable("provider_price_reference", {
  id: text("id").primaryKey(),
  providerId: text("provider_id").notNull(),
  providerName: text("provider_name").notNull().default(""),
  listingId: text("listing_id"),
  category: text("category").notNull(),
  subcategory: text("subcategory").notNull().default(""),
  providerPrice: numeric("provider_price", { precision: 10, scale: 2 }).notNull().default("0"),
  adminPriceSnapshot: numeric("admin_price_snapshot", { precision: 10, scale: 2 }).notNull().default("0"),
  differencePercent: numeric("difference_percent", { precision: 8, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type EquipmentProviderDetails = typeof equipmentProviderDetailsTable.$inferSelect;
export type ServiceProviderDetails = typeof serviceProviderDetailsTable.$inferSelect;
