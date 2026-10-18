import { Router, type IRouter, type Request as ExpressRequest, type Response } from "express";
import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { pushCategory, pushTarget } from "../lib/pushPolicy.js";
import { authMiddleware } from "./users.js";
import pushDevices from "./pushDevices.js";

const router: IRouter = Router();
router.use(pushDevices);
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
        category: n.category,
        targetType: n.targetType,
        targetId: n.targetId,
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
    const actor = (req as Request & { userId: string }).userId;
    if (targetUserId !== actor) {
      const [sender] = await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, actor)).limit(1);
      if (!sender?.isAdmin) return void res.status(403).json({ error: "Only administrators can notify another account" });
    }

    if (typeof title !== "string" || !title.trim() || title.length > 200 ||
        typeof message !== "string" || !message.trim() || message.length > 4000) {
      res.status(400).json({ error: "A title (up to 200 characters) and message (up to 4000 characters) are required" });
      return;
    }

    const inserted = await db
      .insert(notificationsTable)
      .values({ id: generateId(), userId: targetUserId, title, message, isRead: false,
        category: pushCategory(req.body.category), ...pushTarget(req.body.targetType, req.body.targetId) })
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
      .where(and(eq(notificationsTable.id, req.params.id),
        eq(notificationsTable.userId, (req as Request & { userId: string }).userId)));

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
