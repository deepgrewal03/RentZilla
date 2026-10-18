import { pgTable, text, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const pushDevicesTable = pgTable("push_devices", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  expoPushToken: text("expo_push_token").notNull(),
  secretHash: text("secret_hash").notNull(),
  platform: text("platform").notNull(),
  registeredAt: timestamp("registered_at", { withTimezone: true }).defaultNow().notNull(),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("push_devices_token").on(t.expoPushToken), index("push_devices_user").on(t.userId)]);

// A durable, leased queue: multiple API instances cannot claim the same row.
export const pushDeliveriesTable = pgTable("push_deliveries", {
  id: text("id").primaryKey(),
  deviceId: text("device_id").notNull().references(() => pushDevicesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  sourceId: text("source_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull(),
  data: jsonb("data").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  ticketId: text("ticket_id"),
  availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("push_delivery_source_device").on(t.sourceId, t.deviceId),
  index("push_delivery_pending").on(t.status, t.availableAt),
]);

export const insertPushDeviceSchema = createInsertSchema(pushDevicesTable);
export const insertPushDeliverySchema = createInsertSchema(pushDeliveriesTable);
export type PushDevice = typeof pushDevicesTable.$inferSelect;
export type PushDelivery = typeof pushDeliveriesTable.$inferSelect;
