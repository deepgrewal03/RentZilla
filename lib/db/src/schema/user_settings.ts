import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const userSettingsTable = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  notifications: jsonb("notifications").notNull().default({
    bookingRequests: true,
    bookingConfirmations: true,
    messages: true,
    paymentUpdates: true,
    promotions: true,
  }),
  privacy: jsonb("privacy").notNull().default({
    profileVisibility: "public",
    showPhone: true,
  }),
  preferences: jsonb("preferences").notNull().default({
    darkMode: "system",
    dataSaver: false,
  }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UserSettings = typeof userSettingsTable.$inferSelect;
