import { Router } from "express";
import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { RegisterPushDeviceBody, UnregisterPushDeviceBody } from "@workspace/api-zod";
import { authMiddleware } from "./users.js";
import { isExpoPushToken } from "../lib/pushPolicy.js";

const router = Router();
const proof = UnregisterPushDeviceBody.refine(p => /^[a-f0-9]{64}$/.test(p.secret));
const registration = RegisterPushDeviceBody.refine(p => /^[a-f0-9]{64}$/.test(p.secret) && isExpoPushToken(p.expoPushToken));
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

router.put("/device", authMiddleware, async (req, res) => {
  const parsed = registration.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid push registration" });
  const p = parsed.data;
  const userId = (req as typeof req & { userId: string }).userId;
  try {
    const ok = await db.transaction(async (tx) => {
      // Serialize token transfers on one physical installation.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${p.expoPushToken}))`);
      const existing = await tx.execute(sql`SELECT secret_hash FROM push_devices WHERE id = ${p.installationId} FOR UPDATE`);
      if (existing.rows.length && existing.rows[0].secret_hash !== hash(p.secret)) return false;
      // A reinstall/rotated token must have exactly one account owner.
      await tx.execute(sql`DELETE FROM push_devices WHERE expo_push_token = ${p.expoPushToken} AND id <> ${p.installationId}`);
      // Delete queued deliveries before changing the account association.
      await tx.execute(sql`DELETE FROM push_deliveries WHERE device_id = ${p.installationId} AND user_id <> ${userId}`);
      const saved = await tx.execute(sql`
        INSERT INTO push_devices (id, user_id, secret_hash, expo_push_token, platform)
        VALUES (${p.installationId}, ${userId}, ${hash(p.secret)}, ${p.expoPushToken}, ${p.platform})
        ON CONFLICT (id) DO UPDATE SET
          registered_at = CASE WHEN push_devices.user_id <> EXCLUDED.user_id THEN NOW() ELSE push_devices.registered_at END,
          user_id = EXCLUDED.user_id, expo_push_token = EXCLUDED.expo_push_token,
          platform = EXCLUDED.platform, refreshed_at = NOW()
        WHERE push_devices.secret_hash = EXCLUDED.secret_hash
        RETURNING id
      `);
      return saved.rows.length === 1;
    });
    res.status(ok ? 204 : 409).end();
  } catch {
    req.log.error("Push device registration failed");
    res.status(503).json({ error: "Could not register notifications. Please try again." });
  }
});

// Proof only revokes, never reads account data or authorizes a registration.
// This permits offline logout cleanup to retry after the auth session is gone.
router.delete("/device", async (req, res) => {
  const parsed = proof.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid device revocation" });
  try {
    await db.execute(sql`DELETE FROM push_devices WHERE id = ${parsed.data.installationId} AND secret_hash = ${hash(parsed.data.secret)}`);
    res.status(204).end();
  } catch {
    req.log.error("Push device revocation failed");
    res.status(503).json({ error: "Could not revoke this device" });
  }
});
export default router;
