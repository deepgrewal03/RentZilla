import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

export const blockedUsersTable = pgTable("blocked_users", {
  id: text("id").primaryKey(),
  blockerId: text("blocker_id").notNull(),
  blockedId: text("blocked_id").notNull(),
  blockedName: text("blocked_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reportsTable = pgTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id").notNull(),
  reportedUserId: text("reported_user_id").notNull(),
  reportedUserName: text("reported_user_name"),
  targetType: text("target_type").notNull().default("user"),
  // Legacy reports identify the target through reported_user_id.
  // Keep this nullable so Publish can add it without deleting existing reports.
  targetId: text("target_id"),
  targetName: text("target_name"),
  reason: text("reason").notNull().default("other"),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("reports_reporter_target_idx").on(table.reporterId, table.targetType, table.targetId),
  index("reports_reporter_created_idx").on(table.reporterId, table.createdAt),
]);

export const emergencyContactsTable = pgTable("emergency_contacts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  relation: text("relation"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const issuesTable = pgTable("issues", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const otpCodesTable = pgTable("otp_codes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
