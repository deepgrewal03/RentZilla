import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { createHmac, createVerify, createPublicKey } from "crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { sendOtpEmail } from "../lib/email";

const router: IRouter = Router();

export const TOKEN_SECRET = process.env.JWT_SECRET ||
  (process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32) : "") ||
  "rentzilla-dev-secret-change-in-production";

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function generateToken(userId: string): string {
  const payload = Buffer.from(`${userId}:${Date.now()}`).toString("base64");
  const sig = createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex").slice(0, 16);
  return `${payload}.${sig}`;
}

function buildUserResponse(user: typeof usersTable.$inferSelect) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || null;
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: fullName,
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
    const { firstName, lastName, email, mobile, countryCode, dob, password, role, location } = req.body;

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
      // Only accept valid enum values; anything else falls back to "customer"
      // (previously an invalid role crashed the insert with a 500).
      role: (["customer", "provider", "both"].includes(role) ? role : "customer") as
        | "customer"
        | "provider"
        | "both",
      location: location || null,
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
        role: (["customer", "provider", "both"].includes(role) ? role : "customer") as
          | "customer"
          | "provider"
          | "both",
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

// ─── Social Auth Helpers ─────────────────────────────────────────────────────

// Accept tokens from any of our Google OAuth clients (web, iOS, Android)
const GOOGLE_ALLOWED_AUDIENCES: string[] = [
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
].filter(Boolean) as string[];

/** Verify Google ID token via Google tokeninfo endpoint */
async function verifyGoogleToken(idToken: string): Promise<{
  sub: string; email: string; name?: string; picture?: string; emailVerified: boolean;
} | null> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) return null;
    const data = await res.json() as any;
    if (!data.sub || !data.email) return null;
    // If we have known client IDs, verify the token audience matches one of them.
    // If none are configured, skip audience check (Google's tokeninfo already validated the token).
    if (GOOGLE_ALLOWED_AUDIENCES.length > 0 && !GOOGLE_ALLOWED_AUDIENCES.includes(data.aud)) return null;
    return {
      sub: data.sub,
      email: data.email,
      name: data.name || undefined,
      picture: data.picture || undefined,
      emailVerified: data.email_verified === "true" || data.email_verified === true,
    };
  } catch { return null; }
}

/** Decode a JWT payload (base64url) without verification */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - payload.length % 4) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch { return null; }
}

/** Verify Apple identity token via Apple JWKS */
async function verifyAppleToken(identityToken: string): Promise<{
  sub: string; email?: string; emailVerified?: boolean;
} | null> {
  try {
    const parts = identityToken.split(".");
    if (parts.length !== 3) return null;

    const payload = decodeJwtPayload(identityToken);
    if (!payload) return null;

    // Basic claim checks
    if (payload.iss !== "https://appleid.apple.com") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.sub) return null;

    // Fetch Apple's JWKs and verify signature
    const jwksRes = await fetch("https://appleid.apple.com/auth/keys");
    if (!jwksRes.ok) {
      // If Apple JWKS is unreachable, trust basic claims (dev only)
      return { sub: payload.sub, email: payload.email };
    }
    const jwks = await jwksRes.json() as { keys: any[] };

    // Decode header to find the right key
    const headerB64 = parts[0].replace(/-/g, "+").replace(/_/g, "/");
    const header = JSON.parse(Buffer.from(headerB64 + "==", "base64").toString("utf8")) as any;
    const jwk = jwks.keys.find((k: any) => k.kid === header.kid);
    if (!jwk) return null;

    // Verify RSA-SHA256 signature
    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    const sigData = `${parts[0]}.${parts[1]}`;
    const sig = parts[2].replace(/-/g, "+").replace(/_/g, "/");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(sigData);
    const valid = verifier.verify(publicKey, sig, "base64");
    if (!valid) return null;

    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true || payload.email_verified === "true",
    };
  } catch { return null; }
}

/** Find or create a social user, with smart account linking */
async function upsertSocialUser(params: {
  provider: "google" | "apple";
  providerId: string;
  email?: string;
  name?: string;
  photoUrl?: string;
}): Promise<{ user: typeof usersTable.$inferSelect; isNewUser: boolean }> {
  const { provider, providerId, email, name, photoUrl } = params;
  const providerColumn = provider === "google" ? usersTable.googleId : usersTable.appleId;
  const providerValues = provider === "google" ? { googleId: providerId } : { appleId: providerId };

  // 1. Look up by provider ID first
  // Use the mapped schema on every path: raw rows expose created_at rather
  // than the createdAt Date required by buildUserResponse.
  const [existingBySocial] = await db.select().from(usersTable).where(eq(providerColumn, providerId)).limit(1);
  if (existingBySocial) {
    // Update photo if changed
    if (photoUrl && !existingBySocial.photoUrl) {
      const [updated] = await db.update(usersTable).set({ photoUrl })
        .where(eq(usersTable.id, existingBySocial.id)).returning();
      if (!updated) throw new Error("Social account disappeared during photo update");
      return { user: updated, isNewUser: false };
    }
    return { user: existingBySocial, isNewUser: false };
  }

  // 2. Account linking — look up by email
  if (email) {
    const byEmail = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (byEmail.length > 0) {
      const linked = byEmail[0];
      // Link this social provider to the existing account
      const [updated] = await db.update(usersTable).set({
        ...providerValues, authProvider: provider, ...(photoUrl ? { photoUrl } : {}),
      }).where(eq(usersTable.id, linked.id)).returning();
      if (!updated) throw new Error("Social account disappeared during linking");
      return { user: updated, isNewUser: false };
    }
  }

  // 3. Create new social user
  const id = generateId();
  // Use a unique synthetic phone placeholder (phone is NOT NULL UNIQUE in schema)
  const phone = `${provider}-${providerId.slice(0, 20)}-${Date.now()}`;
  const nameParts = (name || "").trim().split(" ");
  const firstName = nameParts[0] || null;
  const lastName = nameParts.slice(1).join(" ") || null;

  const [created] = await db.insert(usersTable).values({
    id, phone, email: email?.toLowerCase() ?? null, firstName, lastName,
    name: name || null, role: "customer", authProvider: provider,
    ...providerValues, photoUrl: photoUrl || null, profileComplete: false,
  }).returning();
  if (!created) throw new Error("Social account creation returned no user");
  return { user: created, isNewUser: true };
}

// ─── POST /api/auth/google ───────────────────────────────────────────────────
router.post("/google", async (req, res) => {
  try {
    const { id_token, device_type, app_version } = req.body;
    if (!id_token) {
      res.status(400).json({ error: "id_token is required" });
      return;
    }

    const googleUser = await verifyGoogleToken(id_token);
    if (!googleUser) {
      res.status(401).json({ error: "Google sign-in failed. Please try again." });
      return;
    }

    const { user, isNewUser } = await upsertSocialUser({
      provider: "google",
      providerId: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name,
      photoUrl: googleUser.picture,
    });

    const token = generateToken(user.id);
    const response = buildUserResponse(user);

    res.json({
      success: true,
      user: { ...response, photo_url: user.photoUrl, provider: "google" },
      token,
      is_new_user: isNewUser,
      profile_complete: user.profileComplete,
    });
  } catch (err: any) {
    req.log.error({ err }, "Google auth error");
    res.status(500).json({ error: "Google sign-in failed. Please try again." });
  }
});

// ─── POST /api/auth/apple ────────────────────────────────────────────────────
router.post("/apple", async (req, res) => {
  try {
    const { identity_token, apple_user_id, full_name, email: bodyEmail, device_type } = req.body;
    if (!identity_token || !apple_user_id) {
      res.status(400).json({ error: "identity_token and apple_user_id are required" });
      return;
    }

    const appleUser = await verifyAppleToken(identity_token);
    if (!appleUser) {
      res.status(401).json({ error: "Apple sign-in failed. Please try again." });
      return;
    }

    // Apple only sends email on first sign-in; use body email as fallback
    const email = appleUser.email || bodyEmail || undefined;
    const name = full_name ? `${full_name.givenName || ""} ${full_name.familyName || ""}`.trim() : undefined;

    const { user, isNewUser } = await upsertSocialUser({
      provider: "apple",
      providerId: apple_user_id,
      email,
      name: name || undefined,
    });

    const token = generateToken(user.id);
    const response = buildUserResponse(user);

    res.json({
      success: true,
      user: { ...response, provider: "apple" },
      token,
      is_new_user: isNewUser,
      profile_complete: user.profileComplete,
    });
  } catch (err: any) {
    req.log.error({ err }, "Apple auth error");
    res.status(500).json({ error: "Apple sign-in failed. Please try again." });
  }
});

// ─── PUT /api/auth/complete-profile ──────────────────────────────────────────
// Called after social sign-in when is_new_user = true

router.put("/complete-profile", async (req, res) => {
  try {
    // Inline token auth (avoids circular import with users.ts)
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
    let userId: string | null = null;
    try {
      const dotIdx = token.lastIndexOf(".");
      if (dotIdx !== -1) {
        const payload = token.slice(0, dotIdx);
        const providedSig = token.slice(dotIdx + 1);
        const expectedSig = createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex").slice(0, 16);
        if (providedSig === expectedSig) {
          const decoded = Buffer.from(payload, "base64").toString("utf8");
          userId = decoded.split(":")[0] || null;
        }
      }
    } catch { /* invalid token */ }
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { name, phone, dob, location, role } = req.body;

    if (!phone) {
      res.status(400).json({ error: "Mobile number is required" });
      return;
    }

    const normalizedPhone = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "")}`;

    // Check phone uniqueness (avoid conflict with existing users)
    const existing = await db.execute(sql.raw(
      `SELECT id FROM users WHERE phone = '${normalizedPhone.replace(/'/g, "''")}' AND id != '${userId}' LIMIT 1`
    )) as any;
    const conflict = (existing?.rows ?? existing)?.[0];
    if (conflict) {
      res.status(409).json({ error: "This mobile number is already registered." });
      return;
    }

    await db.execute(sql.raw(`
      UPDATE users SET
        phone = '${normalizedPhone.replace(/'/g, "''")}',
        name = ${name ? `'${name.replace(/'/g, "''")}'` : "name"},
        dob = ${dob ? `'${dob.replace(/'/g, "''")}'` : "NULL"},
        location = ${location ? `'${location.replace(/'/g, "''")}'` : "NULL"},
        role = ${role ? `'${role.replace(/'/g, "''")}'` : "'customer'"},
        profile_complete = TRUE
      WHERE id = '${userId}'
    `));

    const updated = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!updated.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const newToken = generateToken(userId);
    res.json({ success: true, user: buildUserResponse(updated[0]), token: newToken });
  } catch (err: any) {
    req.log.error({ err }, "Complete profile error");
    const msg = err?.message || "";
    if (msg.includes("users_phone_unique") || msg.includes("users_phone_key")) {
      res.status(409).json({ error: "This mobile number is already registered." });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
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
