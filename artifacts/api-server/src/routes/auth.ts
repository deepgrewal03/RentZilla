import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, or, sql } from "drizzle-orm";
import { sendOtpEmail } from "../lib/email";

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

// POST /api/auth/forgot-password  — generate OTP and email it
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const normalised = email.toLowerCase().trim();

    // Check user exists
    const users = await db.select().from(usersTable).where(eq(usersTable.email, normalised)).limit(1);
    if (users.length === 0) {
      // Return success anyway (security: don't reveal if email exists)
      res.json({ success: true, message: "If this email is registered, you will receive an OTP." });
      return;
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate old OTPs for this email and insert new one
    await db.execute(sql.raw(`UPDATE password_reset_otps SET used = TRUE WHERE email = '${normalised.replace(/'/g, "''")}'`));
    await db.execute(sql.raw(
      `INSERT INTO password_reset_otps (id, email, otp, expires_at, used) VALUES ('${generateId()}', '${normalised.replace(/'/g, "''")}', '${otp}', '${expiresAt.toISOString()}', FALSE)`
    ));

    // Send email (falls back to console log if no SMTP configured)
    await sendOtpEmail(normalised, otp);

    res.json({ success: true, message: "If this email is registered, you will receive an OTP." });
  } catch (err) {
    req.log.error({ err }, "Forgot password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/reset-password  — verify OTP and update password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      res.status(400).json({ error: "Email, OTP, and new password are required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const normalised = email.toLowerCase().trim();

    // Find valid OTP
    const rows = await db.execute(sql.raw(
      `SELECT * FROM password_reset_otps WHERE email = '${normalised.replace(/'/g, "''")}' AND otp = '${otp.replace(/'/g, "''")}' AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`
    ));

    const record = (rows as any).rows?.[0] ?? (rows as any)[0];
    if (!record) {
      res.status(400).json({ error: "Invalid or expired OTP. Please request a new one." });
      return;
    }

    // Mark OTP as used
    await db.execute(sql.raw(`UPDATE password_reset_otps SET used = TRUE WHERE id = '${record.id}'`));

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash } as any).where(eq(usersTable.email, normalised));

    res.json({ success: true, message: "Password reset successfully." });
  } catch (err) {
    req.log.error({ err }, "Reset password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
