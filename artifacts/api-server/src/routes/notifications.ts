import { Router, type IRouter, type Request as ExpressRequest, type Response } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router: IRouter = Router();
type Request = ExpressRequest<Record<string, string>>;

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// GET /api/notifications — get current user's notifications
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt));

    res.json(
      notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Get notifications error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/notifications — create a notification (internal/admin use)
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, title, message } = req.body;
    const targetUserId = userId || (req as Request & { userId: string }).userId;

    if (!title || !message) {
      res.status(400).json({ error: "title and message are required" });
      return;
    }

    const inserted = await db
      .insert(notificationsTable)
      .values({ id: generateId(), userId: targetUserId, title, message, isRead: false })
      .returning();

    const n = inserted[0];
    res.status(201).json({
      id: n.id,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Create notification error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/notifications/:id/read — mark as read
router.put("/:id/read", authMiddleware, async (req: Request, res: Response) => {
  try {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Mark notification read error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/notifications/read-all — mark all as read
router.put("/read-all", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, userId));

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Mark all read error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
