import { pgTable, text, timestamp, boolean, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("role", ["customer", "provider", "both"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  name: text("name"),
  passwordHash: text("password_hash"),
  role: roleEnum("role").notNull().default("customer"),
  location: text("location"),
  profileImage: text("profile_image"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isSuspended: boolean("is_suspended").notNull().default(false),
  adminNotes: text("admin_notes"),
  dob: text("dob"),
  googleId: text("google_id"),
  appleId: text("apple_id"),
  authProvider: text("auth_provider").notNull().default("email"),
  photoUrl: text("photo_url"),
  profileComplete: boolean("profile_complete").notNull().default(true),
  walletBalance: numeric("wallet_balance", { precision: 10, scale: 2 }).notNull().default("0"),
  payoutPreference: text("payout_preference").notNull().default("wallet"),
  upiId: text("upi_id"),
  isGoldMember: boolean("is_gold_member").notNull().default(false),
  goldActivatedAt: timestamp("gold_activated_at"),
  goldExpiresAt: timestamp("gold_expires_at", { withTimezone: true }),
  goldPurchaseTxId: text("gold_purchase_tx_id"),
  totalMembershipSavings: numeric("total_membership_savings", { precision: 10, scale: 2 }).notNull().default("0"),
  freeSpinLastUsed: timestamp("free_spin_last_used"),
  paidSpinBalance: integer("paid_spin_balance").notNull().default(0),
  referralCode: text("referral_code"),
  referredBy: text("referred_by"),
  referralProgress: integer("referral_progress").notNull().default(0),
  pendingReferralReward: boolean("pending_referral_reward").notNull().default(false),
  totalReferralRewards: integer("total_referral_rewards").notNull().default(0),
  referralFirstCompletionCounted: boolean("referral_first_completion_counted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
