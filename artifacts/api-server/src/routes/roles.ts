import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable, listingsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router: IRouter = Router();
type AR = Request & { userId: string };

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function genId() { return Date.now().toString() + Math.random().toString(36).substr(2, 9); }
function esc(v: string | undefined | null) { return v ? `'${v.replace(/'/g, "''")}'` : "NULL"; }

// POST /api/roles/send-otp
router.post("/send-otp", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const purpose = req.body.purpose || "role_upgrade";

    await db.execute(
      `UPDATE otps SET verified = TRUE WHERE user_id = '${userId}' AND purpose = '${purpose}' AND verified = FALSE`
    );

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.execute(
      `INSERT INTO otps (user_id, code, purpose, expires_at, verified)
       VALUES ('${userId}', '${code}', '${purpose}', '${expiresAt.toISOString()}', FALSE)`
    );

    res.json({ success: true, otp: code, expiresAt: expiresAt.toISOString(), message: "OTP sent (dev: returned in response)" });
  } catch (err) {
    req.log.error({ err }, "Send OTP error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/roles/verify-otp
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

    await db.execute(`UPDATE otps SET verified = TRUE WHERE id = '${otp.id}'`);
    res.json({ success: true, verified: true });
  } catch (err) {
    req.log.error({ err }, "Verify OTP error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/roles/upgrade — upgrade to provider + auto-create listing
router.post("/upgrade", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const {
      targetRole,
      providerType,
      subtype,
      licenseNumber, vehicleType, vehicleMake, vehicleModel, vehicleYear, vehicleColor,
      equipmentName,
      fullName, area, address, aadhaarNumber,
    } = req.body;

    if (!["provider", "customer"].includes(targetRole)) {
      res.status(400).json({ error: "targetRole must be 'provider' or 'customer'" });
      return;
    }

    // Check OTP verified recently (within 15 min)
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

    // Update role if needed
    if (user.role !== targetRole) {
      await db.update(usersTable).set({ role: "both" as any }).where(eq(usersTable.id, userId));
    }

    let listingId: string | null = null;
    let listingTitle = "";

    if (targetRole === "provider") {
      // ── Cars ──────────────────────────────────────────────────────────────
      if (providerType === "cars" || (!providerType && licenseNumber)) {
        const vType = vehicleType || subtype || "Sedan";
        await db.execute(
          `INSERT INTO driver_profiles (user_id, license_number, vehicle_type, vehicle_make, vehicle_model, vehicle_year, vehicle_color, status)
           VALUES ('${userId}', ${esc(licenseNumber)}, ${esc(vType)}, ${esc(vehicleMake)}, ${esc(vehicleModel)}, ${esc(vehicleYear)}, ${esc(vehicleColor)}, 'pending')
           ON CONFLICT (user_id) DO UPDATE SET
             license_number = EXCLUDED.license_number, vehicle_type = EXCLUDED.vehicle_type,
             vehicle_make = EXCLUDED.vehicle_make, vehicle_model = EXCLUDED.vehicle_model,
             vehicle_year = EXCLUDED.vehicle_year, vehicle_color = EXCLUDED.vehicle_color, updated_at = NOW()`
        );

        // Auto-create listing — skip if one already exists for this provider+category
        const existing = await db.select({ id: listingsTable.id })
          .from(listingsTable)
          .where(and(eq(listingsTable.providerId, userId), eq(listingsTable.category, "cars")))
          .limit(1);

        if (!existing.length) {
          const parts = [vehicleYear, vehicleMake, vehicleModel].filter(Boolean);
          listingTitle = parts.length > 0
            ? `${parts.join(" ")} – ${vType} Rental`
            : `${vType} Car for Hire`;

          listingId = genId();
          await db.insert(listingsTable).values({
            id: listingId,
            providerId: userId,
            category: "cars",
            subcategory: vType,
            title: listingTitle,
            description: `Well-maintained ${vType.toLowerCase()} available for hire in Punjab. Contact for schedule and availability.`,
            price: 1500,
            priceUnit: "per_day",
            location: user.location || "Punjab, India",
            images: [],
            isAvailable: true,
          });
        } else {
          listingId = existing[0].id;
          const existingListing = await db.select().from(listingsTable).where(eq(listingsTable.id, listingId)).limit(1);
          listingTitle = existingListing[0]?.title || "";
        }
      }

      // ── Equipment ─────────────────────────────────────────────────────────
      else if (providerType === "equipment") {
        const eqName = equipmentName || subtype || "";
        await db.execute(
          `INSERT INTO equipment_provider_details (id, user_id, equipment_name, license_number, make, model, year, status)
           VALUES ('${genId()}', '${userId}', ${esc(eqName)}, ${esc(licenseNumber)}, ${esc(vehicleMake)}, ${esc(vehicleModel)}, ${esc(vehicleYear)}, 'pending')
           ON CONFLICT (user_id) DO UPDATE SET
             equipment_name = EXCLUDED.equipment_name, license_number = EXCLUDED.license_number,
             make = EXCLUDED.make, model = EXCLUDED.model, year = EXCLUDED.year, updated_at = NOW()`
        );

        const existing = await db.select({ id: listingsTable.id })
          .from(listingsTable)
          .where(and(eq(listingsTable.providerId, userId), eq(listingsTable.category, "equipment")))
          .limit(1);

        if (!existing.length) {
          const parts = [vehicleYear, vehicleMake, vehicleModel, eqName].filter(Boolean);
          listingTitle = parts.length > 0 ? parts.join(" ") : `${eqName} for Rent`;

          listingId = genId();
          await db.insert(listingsTable).values({
            id: listingId,
            providerId: userId,
            category: "equipment",
            subcategory: eqName,
            title: listingTitle,
            description: `${eqName} available for rent in Punjab. Suitable for agricultural use. Contact for availability.`,
            price: 1200,
            priceUnit: "per_day",
            location: user.location || "Punjab, India",
            images: [],
            isAvailable: true,
          });
        } else {
          listingId = existing[0].id;
          const existingListing = await db.select().from(listingsTable).where(eq(listingsTable.id, listingId)).limit(1);
          listingTitle = existingListing[0]?.title || "";
        }
      }

      // ── Services ──────────────────────────────────────────────────────────
      else if (providerType === "services") {
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

        const existing = await db.select({ id: listingsTable.id })
          .from(listingsTable)
          .where(and(eq(listingsTable.providerId, userId), eq(listingsTable.category, "services")))
          .limit(1);

        if (!existing.length) {
          listingTitle = `${fullName} – ${sType} Service`;

          listingId = genId();
          await db.insert(listingsTable).values({
            id: listingId,
            providerId: userId,
            category: "services",
            subcategory: sType,
            title: listingTitle,
            description: `Professional ${sType.toLowerCase()} services in ${area}. Contact for rates and availability.`,
            price: 500,
            priceUnit: "per_hour",
            location: area || user.location || "Punjab, India",
            images: [],
            isAvailable: true,
          });
        } else {
          listingId = existing[0].id;
          const existingListing = await db.select().from(listingsTable).where(eq(listingsTable.id, listingId)).limit(1);
          listingTitle = existingListing[0]?.title || "";
        }
      }
    }

    const updatedUser = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    res.json({
      success: true,
      role: updatedUser[0].role,
      listingId,
      listingTitle,
      message: "Provider registration complete",
    });
  } catch (err) {
    req.log.error({ err }, "Role upgrade error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/roles/current
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
