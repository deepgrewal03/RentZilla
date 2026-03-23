import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("role", ["customer", "provider"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name"),
  role: roleEnum("role").notNull().default("customer"),
  location: text("location"),
  profileImage: text("profile_image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
