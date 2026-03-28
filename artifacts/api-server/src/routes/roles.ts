import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router: IRouter = Router();
type AR = Request & { userId: string };

// Helper: generate 6-digit OTP
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/roles/send-otp — generate and "send" OTP (returned in response for dev)
router.post("/send-otp", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const purpose = req.body.purpose || "role_upgrade";

    // Invalidate previous OTPs for this user+purpose
    await db.execute(
      `UPDATE otps SET verified = TRUE WHERE user_id = '${userId}' AND purpose = '${purpose}' AND verified = FALSE`
    );

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await db.execute(
      `INSERT INTO otps (user_id, code, purpose, expires_at, verified)
       VALUES ('${userId}', '${code}', '${purpose}', '${expiresAt.toISOString()}', FALSE)`
    );

    // In production, send via SMS. Here we return it in the response.
    res.json({ success: true, otp: code, expiresAt: expiresAt.toISOString(), message: "OTP sent (dev: returned in response)" });
  } catch (err) {
    req.log.error({ err }, "Send OTP error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/roles/verify-otp — verify OTP
router.post("/verify-otp", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { code, purpose = "role_upgrade" } = req.body;
    if (!code) { res.status(400).json({ error: "OTP code required" }); return; }

    const result = await db.execute(
      `SELECT * FROM otps WHERE user_id = '${userId}' AND purpose = '${purpose}' AND verified = FALSE ORDER BY created_at DESC LIMIT 1`
    );
    const rows = result.rows as any[];
    if (!rows.length) { res.status(404).json({ error: "No active OTP found. Please request a new one." }); return; }

    const otp = rows[0];
    if (new Date(otp.expires_at) < new Date()) {
      res.status(400).json({ error: "OTP has expired. Please request a new one." });
      return;
    }
    if (otp.code !== code) {
      res.status(400).json({ error: "Incorrect OTP. Please try again." });
      return;
    }

    // Mark as verified
    await db.execute(`UPDATE otps SET verified = TRUE WHERE id = '${otp.id}'`);
    res.json({ success: true, verified: true });
  } catch (err) {
    req.log.error({ err }, "Verify OTP error");
    res.status(500).json({ error: "Internal server error" });
  }
});

function genId() { return Date.now().toString() + Math.random().toString(36).substr(2, 9); }
function esc(v: string | undefined | null) { return v ? `'${v.replace(/'/g, "''")}'` : "NULL"; }

// POST /api/roles/upgrade — upgrade to provider (requires OTP verified within 15 min)
router.post("/upgrade", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const {
      targetRole,
      providerType,        // "cars" | "equipment" | "services"
      subtype,             // e.g. "Sedan", "Tractor", "Plumber"
      // Cars / Equipment
      licenseNumber, vehicleType, vehicleMake, vehicleModel, vehicleYear, vehicleColor,
      // Equipment
      equipmentName,
      // Services
      fullName, area, address, aadhaarNumber,
    } = req.body;

    if (!["provider", "customer"].includes(targetRole)) {
      res.status(400).json({ error: "targetRole must be 'provider' or 'customer'" });
      return;
    }

    // Check OTP was verified recently (within 15 min)
    const otpCheck = await db.execute(
      `SELECT * FROM otps WHERE user_id = '${userId}' AND purpose = 'role_upgrade' AND verified = TRUE 
       AND created_at > NOW() - INTERVAL '15 minutes' ORDER BY created_at DESC LIMIT 1`
    );
    if (!(otpCheck.rows as any[]).length) {
      res.status(403).json({ error: "OTP verification required before role upgrade" });
      return;
    }

    // Get current user
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }
    const user = users[0];

    let newRole: "customer" | "provider" | "both" = "both";
    if (user.role === targetRole) {
      // already a provider, just update details below
    } else {
      await db.update(usersTable).set({ role: newRole as any }).where(eq(usersTable.id, userId));
    }

    if (targetRole === "provider") {
      if (providerType === "cars" || (!providerType && licenseNumber)) {
        // Car driver profile
        const vType = vehicleType || subtype || "Sedan";
        await db.execute(
          `INSERT INTO driver_profiles (user_id, license_number, vehicle_type, vehicle_make, vehicle_model, vehicle_year, vehicle_color, status)
           VALUES ('${userId}', ${esc(licenseNumber)}, ${esc(vType)}, ${esc(vehicleMake)}, ${esc(vehicleModel)}, ${esc(vehicleYear)}, ${esc(vehicleColor)}, 'pending')
           ON CONFLICT (user_id) DO UPDATE SET
             license_number = EXCLUDED.license_number, vehicle_type = EXCLUDED.vehicle_type,
             vehicle_make = EXCLUDED.vehicle_make, vehicle_model = EXCLUDED.vehicle_model,
             vehicle_year = EXCLUDED.vehicle_year, vehicle_color = EXCLUDED.vehicle_color, updated_at = NOW()`
        );
      } else if (providerType === "equipment") {
        const eqName = equipmentName || subtype || "";
        await db.execute(
          `INSERT INTO equipment_provider_details (id, user_id, equipment_name, license_number, make, model, year, status)
           VALUES ('${genId()}', '${userId}', ${esc(eqName)}, ${esc(licenseNumber)}, ${esc(vehicleMake)}, ${esc(vehicleModel)}, ${esc(vehicleYear)}, 'pending')
           ON CONFLICT (user_id) DO UPDATE SET
             equipment_name = EXCLUDED.equipment_name, license_number = EXCLUDED.license_number,
             make = EXCLUDED.make, model = EXCLUDED.model, year = EXCLUDED.year, updated_at = NOW()`
        );
      } else if (providerType === "services") {
        const sType = subtype || "General";
        if (!fullName || !area || !address || !aadhaarNumber) {
          res.status(400).json({ error: "All service provider fields are required" });
          return;
        }
        if (!/^\d{12}$/.test(aadhaarNumber.replace(/\s/g, ""))) {
          res.status(400).json({ error: "Aadhaar number must be 12 digits" });
          return;
        }
        await db.execute(
          `INSERT INTO service_provider_details (id, user_id, full_name, service_type, area, address, aadhaar_number, status)
           VALUES ('${genId()}', '${userId}', ${esc(fullName)}, ${esc(sType)}, ${esc(area)}, ${esc(address)}, ${esc(aadhaarNumber.replace(/\s/g,""))}, 'pending')
           ON CONFLICT (user_id) DO UPDATE SET
             full_name = EXCLUDED.full_name, service_type = EXCLUDED.service_type,
             area = EXCLUDED.area, address = EXCLUDED.address, aadhaar_number = EXCLUDED.aadhaar_number, updated_at = NOW()`
        );
      }
    }

    const updatedUser = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    res.json({ success: true, role: updatedUser[0].role, message: "Provider registration complete" });
  } catch (err) {
    req.log.error({ err }, "Role upgrade error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/roles/current — get current role + driver profile
router.get("/current", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }
    const user = users[0];

    const driverResult = await db.execute(
      `SELECT * FROM driver_profiles WHERE user_id = '${userId}' LIMIT 1`
    );
    const driverProfile = (driverResult.rows as any[])[0] || null;

    res.json({
      role: user.role,
      roles: user.role === "both" ? ["customer", "provider"] : [user.role],
      driverProfile,
    });
  } catch (err) {
    req.log.error({ err }, "Get role error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
