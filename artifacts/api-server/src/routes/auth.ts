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
    const { firstName, lastName, email, mobile, countryCode, dob, password, role } = req.body;

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

    // Build full international phone number (e.g. "+911234567890")
    const normalizedPhone = mobile
      ? `${(countryCode || "+91").replace(/\s/g, "")}${mobile.replace(/\D/g, "")}`
      : `email-${Date.now()}`;

    // Check duplicate phone (only when a real mobile number is supplied)
    if (mobile) {
      const existingPhone = await db.select().from(usersTable).where(eq(usersTable.phone, normalizedPhone)).limit(1);
      if (existingPhone.length > 0) {
        res.status(409).json({ error: "Mobile number already registered. Please sign in or use a different number." });
        return;
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    const newUser = {
      id: generateId(),
      phone: normalizedPhone,
      email: email.toLowerCase(),
      firstName: firstName || null,
      lastName: lastName || null,
      name: fullName || null,
      passwordHash,
      role: (role as "customer" | "provider") || "customer",
      location: null,
      profileImage: null,
      dob: dob || null,
    } as any;

    const inserted = await db.insert(usersTable).values(newUser).returning();
    const user = inserted[0];
    const token = generateToken(user.id);

    res.status(201).json({ user: buildUserResponse(user), token });
  } catch (err: any) {
    req.log.error({ err }, "Register error");
    // Surface DB constraint violations as user-friendly messages
    const msg: string = err?.message || "";
    if (msg.includes("users_phone_unique") || msg.includes("users_phone_key")) {
      res.status(409).json({ error: "Mobile number already registered. Please sign in or use a different number." });
    } else if (msg.includes("users_email_unique") || msg.includes("users_email_key")) {
      res.status(409).json({ error: "Email already registered. Please sign in." });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
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

// ─── POST /api/auth/forgot-password ─────────────────────────────────────────
// Generate & email a 6-digit OTP valid for 10 minutes
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ error: "Email is required" }); return; }

    const addr = (email as string).toLowerCase().trim();

    // Check user exists (we still return 200 either way to avoid user enumeration)
    const users = await db.select().from(usersTable).where(eq(usersTable.email, addr)).limit(1);
    if (users.length === 0) {
      res.json({ success: true });
      return;
    }

    // Invalidate old OTPs, generate a fresh one
    await db.execute(sql.raw(
      `UPDATE password_reset_otps SET used = TRUE WHERE email = '${addr.replace(/'/g, "''")}'`
    ));

    const otp       = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await db.execute(sql.raw(
      `INSERT INTO password_reset_otps (id, email, otp, expires_at, used)
       VALUES ('${generateId()}', '${addr.replace(/'/g, "''")}', '${otp}', '${expiresAt}', FALSE)`
    ));

    await sendOtpEmail(addr, otp);

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Forgot password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/auth/reset-password ──────────────────────────────────────────
// Verify OTP, update password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      res.status(400).json({ error: "Email, OTP, and new password are required" });
      return;
    }
    if ((newPassword as string).length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const addr    = (email as string).toLowerCase().trim();
    const otpStr  = (otp as string).replace(/'/g, "''");

    const rows = await db.execute(sql.raw(
      `SELECT id FROM password_reset_otps
       WHERE email = '${addr.replace(/'/g, "''")}'
         AND otp   = '${otpStr}'
         AND used  = FALSE
         AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`
    ));

    const record = (rows as any).rows?.[0] ?? (rows as any)[0];
    if (!record) {
      res.status(400).json({ error: "Invalid or expired OTP. Please request a new one." });
      return;
    }

    await db.execute(sql.raw(
      `UPDATE password_reset_otps SET used = TRUE WHERE id = '${record.id}'`
    ));

    const passwordHash = await bcrypt.hash(newPassword as string, 10);
    await db.update(usersTable).set({ passwordHash } as any).where(eq(usersTable.email, addr));

    res.json({ success: true, message: "Password reset successfully." });
  } catch (err) {
    req.log.error({ err }, "Reset password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
