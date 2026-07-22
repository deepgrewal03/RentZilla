import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const adminLogsTable = pgTable("admin_logs", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").notNull(),
  adminEmail: text("admin_email").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminNotificationsTable = pgTable("admin_notifications", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  targetRole: text("target_role").notNull().default("all"),
  targetUserId: text("target_user_id"),
  type: text("type").notNull().default("admin"),
  imageUrl: text("image_url"),
  deepLink: text("deep_link"),
  scheduledAt: timestamp("scheduled_at"),
  status: text("status").notNull().default("pending"),
  sentCount: integer("sent_count").notNull().default(0),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AdminLog = typeof adminLogsTable.$inferSelect;
export type AdminNotification = typeof adminNotificationsTable.$inferSelect;
