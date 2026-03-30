import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, reviewsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function getUserIdFromToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.replace("Bearer ", "");
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const userId = decoded.split(":")[0];
    return userId || null;
  } catch {
    return null;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const userId = getUserIdFromToken(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as Request & { userId: string }).userId = userId;
  next();
}

async function getUserRating(userId: string): Promise<{ rating: number | null; reviewCount: number }> {
  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.providerId, userId));
  if (reviews.length === 0) return { rating: null, reviewCount: 0 };
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  return { rating: Math.round(avg * 10) / 10, reviewCount: reviews.length };
}

router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (users.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = users[0];
    const { rating, reviewCount } = await getUserRating(userId);
    res.json({
      id: user.id,
      phone: user.phone,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      role: user.role,
      roles: user.role === "both" ? ["customer", "provider"] : [user.role],
      location: user.location,
      profileImage: user.profileImage,
      rating,
      reviewCount,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Get user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { name, location, profileImage } = req.body;

    const updated = await db
      .update(usersTable)
      .set({ name, location, profileImage })
      .where(eq(usersTable.id, userId))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const user = updated[0];
    const { rating, reviewCount } = await getUserRating(userId);
    res.json({
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      location: user.location,
      profileImage: user.profileImage,
      rating,
      reviewCount,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Update user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
