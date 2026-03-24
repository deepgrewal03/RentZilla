import { pgTable, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";

export const reportReasonEnum = pgEnum("report_reason", ["spam", "fraud", "abuse", "fake_listing", "other"]);
export const reportStatusEnum = pgEnum("report_status", ["pending", "reviewed", "resolved"]);
export const issueCategoryEnum = pgEnum("issue_category", ["payment", "booking", "driver", "app_bug", "other"]);

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
  reason: reportReasonEnum("reason").notNull(),
  description: text("description"),
  status: reportStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emergencyContactsTable = pgTable("emergency_contacts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  relation: text("relation"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const issuesTable = pgTable("issues", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  category: issueCategoryEnum("category").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const otpCodesTable = pgTable("otp_codes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
