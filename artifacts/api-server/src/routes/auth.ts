import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";

const router: IRouter = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function generateToken(userId: string): string {
  return Buffer.from(`${userId}:${Date.now()}`).toString("base64");
}

function buildUserResponse(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.phone,
    role: user.role,
    location: user.location,
    profileImage: user.profileImage,
    rating: null,
    reviewCount: 0,
    createdAt: user.createdAt.toISOString(),
  };
}

// POST /api/auth/register  — email + password sign-up
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, mobile, password, role } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    // Check duplicate email
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Email already registered. Please sign in." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const phone = mobile || `email-${Date.now()}`;
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    const newUser = {
      id: generateId(),
      phone,
      email: email.toLowerCase(),
      firstName: firstName || null,
      lastName: lastName || null,
      name: fullName || null,
      passwordHash,
      role: (role as "customer" | "provider") || "customer",
      location: null,
      profileImage: null,
    };

    const inserted = await db.insert(usersTable).values(newUser).returning();
    const user = inserted[0];
    const token = generateToken(user.id);

    res.status(201).json({ user: buildUserResponse(user), token });
  } catch (err) {
    req.log.error({ err }, "Register error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login  — email + password sign-in
router.post("/login", async (req, res) => {
  try {
    const { email, password, phone, name, role } = req.body;

    // Email + password flow
    if (email && password) {
      const users = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
      if (users.length === 0) {
        res.status(401).json({ error: "No account found for this email. Please sign up." });
        return;
      }
      const user = users[0];
      if (!user.passwordHash) {
        res.status(401).json({ error: "This account uses phone login. Please use your phone number." });
        return;
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Incorrect password. Please try again." });
        return;
      }
      const token = generateToken(user.id);
      res.json({ user: buildUserResponse(user), token });
      return;
    }

    // Legacy phone flow
    if (!phone) {
      res.status(400).json({ error: "Email + password or phone number required" });
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
        email: null,
        firstName: null,
        lastName: null,
        name: name || null,
        passwordHash: null,
        role: (role as "customer" | "provider") || "customer",
        location: null,
        profileImage: null,
      };
      const inserted = await db.insert(usersTable).values(newUser).returning();
      user = inserted[0];
    }

    const token = generateToken(user.id);
    res.json({ user: buildUserResponse(user), token });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/logout  — client should clear token; server can blacklist later
router.post("/logout", (_req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
});

export default router;
