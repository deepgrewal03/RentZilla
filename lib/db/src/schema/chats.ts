import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const chatsTable = pgTable("chats", {
  id: text("id").primaryKey(),
  participants: jsonb("participants").$type<string[]>().notNull(),
  listingId: text("listing_id"),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  senderId: text("sender_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChatSchema = createInsertSchema(chatsTable).omit({ createdAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ createdAt: true });
export type InsertChat = z.infer<typeof insertChatSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Chat = typeof chatsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
