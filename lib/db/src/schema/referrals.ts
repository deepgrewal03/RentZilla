import { pgTable, text, timestamp, boolean, numeric } from "drizzle-orm/pg-core";

export const referralsTable = pgTable("referrals", {
  id: text("id").primaryKey(),
  referrerId: text("referrer_id").notNull(),
  referredUserId: text("referred_user_id").notNull(),
  referralCode: text("referral_code").notNull(),
  firstCompletionDone: boolean("first_completion_done").notNull().default(false),
  rewardGranted: boolean("reward_granted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const referralRewardsTable = pgTable("referral_rewards", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  rewardType: text("reward_type").notNull(),
  rewardValue: numeric("reward_value", { precision: 5, scale: 2 }).notNull().default("10"),
  status: text("status").notNull().default("pending"),
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
  usedAt: timestamp("used_at"),
  usedInBookingId: text("used_in_booking_id"),
});

export type Referral = typeof referralsTable.$inferSelect;
export type ReferralReward = typeof referralRewardsTable.$inferSelect;
