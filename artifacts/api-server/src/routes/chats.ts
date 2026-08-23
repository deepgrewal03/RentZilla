import { Router, type IRouter, type Request as ExpressRequest, type Response } from "express";
import { db } from "@workspace/db";
import { chatsTable, messagesTable, usersTable, listingsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router: IRouter = Router();
type Request = ExpressRequest<Record<string, string>>;

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

async function enrichChat(chat: typeof chatsTable.$inferSelect, userId: string) {
  const participants = (chat.participants as string[]) || [];
  const otherId = participants.find((p) => p !== userId) || participants[0];
  const other = await db.select().from(usersTable).where(eq(usersTable.id, otherId)).limit(1);
  let listingTitle = null;
  if (chat.listingId) {
    const listing = await db.select().from(listingsTable).where(eq(listingsTable.id, chat.listingId)).limit(1);
    listingTitle = listing[0]?.title || null;
  }
  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.chatId, chat.id));
  const unreadCount = msgs.filter((m) => m.senderId !== userId).length;

  return {
    id: chat.id,
    participants,
    otherUserId: otherId,
    otherUserName: other[0]?.name || "User",
    otherUserPhone: other[0]?.phone || "",
    listingId: chat.listingId,
    listingTitle,
    lastMessage: chat.lastMessage,
    lastMessageAt: chat.lastMessageAt?.toISOString() || null,
    unreadCount,
    createdAt: chat.createdAt.toISOString(),
  };
}

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const allChats = await db.select().from(chatsTable);
    const userChats = allChats.filter((c) => (c.participants as string[]).includes(userId));
    const enriched = await Promise.all(userChats.map((c) => enrichChat(c, userId)));
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Get chats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/start", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { providerId, listingId } = req.body;

    // Check if chat exists
    const allChats = await db.select().from(chatsTable);
    const existing = allChats.find((c) => {
      const parts = (c.participants as string[]);
      return parts.includes(userId) && parts.includes(providerId) && c.listingId === (listingId || null);
    });

    if (existing) {
      const enriched = await enrichChat(existing, userId);
      res.status(201).json(enriched);
      return;
    }

    const chat = {
      id: generateId(),
      participants: [userId, providerId],
      listingId: listingId || null,
      lastMessage: null,
      lastMessageAt: null,
    };

    const inserted = await db.insert(chatsTable).values(chat).returning();
    const enriched = await enrichChat(inserted[0], userId);
    res.status(201).json(enriched);
  } catch (err) {
    req.log.error({ err }, "Start chat error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:chatId/messages", authMiddleware, async (req: Request, res: Response) => {
  try {
    const messages = await db.select().from(messagesTable).where(eq(messagesTable.chatId, req.params.chatId));
    const enriched = await Promise.all(messages.map(async (m) => {
      const user = await db.select().from(usersTable).where(eq(usersTable.id, m.senderId)).limit(1);
      return {
        id: m.id,
        chatId: m.chatId,
        senderId: m.senderId,
        senderName: user[0]?.name || "User",
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      };
    }));
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Get messages error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:chatId/messages", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { content } = req.body;

    const msg = {
      id: generateId(),
      chatId: req.params.chatId,
      senderId: userId,
      content,
    };

    const inserted = await db.insert(messagesTable).values(msg).returning();

    // Update chat last message
    await db.update(chatsTable)
      .set({ lastMessage: content, lastMessageAt: new Date() })
      .where(eq(chatsTable.id, req.params.chatId));

    const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const m = inserted[0];

    res.status(201).json({
      id: m.id,
      chatId: m.chatId,
      senderId: m.senderId,
      senderName: user[0]?.name || "User",
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Send message error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
