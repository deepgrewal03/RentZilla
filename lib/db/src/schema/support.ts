import { pgTable, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";

export const supportTicketsTable = pgTable("support_tickets", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  issueType: text("issue_type").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const userVerificationTable = pgTable("user_verification", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  phoneVerified: boolean("phone_verified").notNull().default(true),
  emailVerified: boolean("email_verified").notNull().default(false),
  govIdStatus: text("gov_id_status").notNull().default("none"),
  govIdDocId: text("gov_id_doc_id"),
  selfieStatus: text("selfie_status").notNull().default("none"),
  selfieDocId: text("selfie_doc_id"),
  addressStatus: text("address_status").notNull().default("none"),
  addressDocId: text("address_doc_id"),
  trustScore: integer("trust_score").notNull().default(0),
  verificationLevel: text("verification_level").notNull().default("unverified"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const fraudScoresTable = pgTable("fraud_scores", {
  userId: text("user_id").primaryKey(),
  score: integer("score").notNull().default(0),
  riskLevel: text("risk_level").notNull().default("low"),
  factors: jsonb("factors").notNull().default([]),
  computedAt: timestamp("computed_at").notNull().defaultNow(),
});

export type SupportTicket = typeof supportTicketsTable.$inferSelect;
export type UserVerification = typeof userVerificationTable.$inferSelect;
