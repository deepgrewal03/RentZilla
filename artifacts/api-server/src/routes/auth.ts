import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function generateToken(userId: string): string {
  return Buffer.from(`${userId}:${Date.now()}`).toString("base64");
}

router.post("/login", async (req, res) => {
  try {
    const { phone, name, role } = req.body;

    if (!phone || !role) {
      res.status(400).json({ error: "Phone and role are required" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.phone, phone)).limit(1);

    let user;
    if (existing.length > 0) {
      user = existing[0];
    } else {
      const newUser = {
        id: generateId(),
        phone,
        name: name || null,
        role: role as "customer" | "provider",
        location: null,
        profileImage: null,
      };
      const inserted = await db.insert(usersTable).values(newUser).returning();
      user = inserted[0];
    }

    const token = generateToken(user.id);

    res.json({
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        location: user.location,
        profileImage: user.profileImage,
        rating: null,
        reviewCount: 0,
        createdAt: user.createdAt.toISOString(),
      },
      token,
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
