import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router: IRouter = Router();
type AR = Request & { userId: string };

// ── Haversine distance in km ──
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateFare(distanceKm: number, vehicleType: string = "Car"): number {
  const BASE_FARE = 40;
  const PER_KM: Record<string, number> = { Car: 12, SUV: 16, Auto: 8, Bike: 6, Van: 20 };
  const perKm = PER_KM[vehicleType] ?? 12;
  return Math.max(BASE_FARE, Math.round(BASE_FARE + distanceKm * perKm));
}

// ─────────────────────────────────────────────
// DRIVER: Online/Offline status
// ─────────────────────────────────────────────

router.patch("/driver/status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { isOnline } = req.body;
    await db.execute(
      `INSERT INTO driver_status (driver_id, is_online, last_updated)
       VALUES ('${userId}', ${!!isOnline}, NOW())
       ON CONFLICT (driver_id) DO UPDATE SET is_online = ${!!isOnline}, last_updated = NOW()`
    );
    res.json({ success: true, isOnline: !!isOnline });
  } catch (err) {
    req.log.error({ err }, "Driver status error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/driver/status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const result = await db.execute(`SELECT * FROM driver_status WHERE driver_id = '${userId}' LIMIT 1`);
    const row = (result.rows as any[])[0];
    res.json({ isOnline: row?.is_online ?? false });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DRIVER: Update location
router.post("/driver/location", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { lat, lng } = req.body;
    if (!lat || !lng) { res.status(400).json({ error: "lat and lng required" }); return; }
    await db.execute(
      `INSERT INTO driver_locations (driver_id, lat, lng, updated_at)
       VALUES ('${userId}', ${lat}, ${lng}, NOW())
       ON CONFLICT (driver_id) DO UPDATE SET lat = ${lat}, lng = ${lng}, updated_at = NOW()`
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DRIVER: Get pending ride requests
router.get("/driver/requests", authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await db.execute(
      `SELECT r.*, u.name as rider_name, u.phone as rider_phone
       FROM rides r JOIN users u ON u.id = r.rider_id
       WHERE r.status = 'requested' AND r.driver_id IS NULL
       ORDER BY r.requested_at DESC LIMIT 10`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DRIVER: Accept a ride
router.patch("/:id/accept", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { id } = req.params;
    // Atomic claim — only one driver can accept
    const result = await db.execute(
      `UPDATE rides SET driver_id = '${userId}', status = 'accepted', accepted_at = NOW()
       WHERE id = '${id}' AND status = 'requested' AND driver_id IS NULL
       RETURNING *`
    );
    const rows = result.rows as any[];
    if (!rows.length) {
      res.status(409).json({ error: "Ride already accepted by another driver" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DRIVER: Start trip
router.patch("/:id/start", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { id } = req.params;
    const result = await db.execute(
      `UPDATE rides SET status = 'ongoing', started_at = NOW()
       WHERE id = '${id}' AND driver_id = '${userId}' AND status = 'accepted'
       RETURNING *`
    );
    const rows = result.rows as any[];
    if (!rows.length) { res.status(404).json({ error: "Ride not found or not accepted" }); return; }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DRIVER: End trip
router.patch("/:id/end", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { id } = req.params;
    const result = await db.execute(
      `UPDATE rides SET status = 'completed', completed_at = NOW()
       WHERE id = '${id}' AND driver_id = '${userId}' AND status = 'ongoing'
       RETURNING *`
    );
    const rows = result.rows as any[];
    if (!rows.length) { res.status(404).json({ error: "Ride not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// RIDER: Request a ride
router.post("/request", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { pickupLat, pickupLng, pickupAddress, dropLat, dropLng, dropAddress, vehicleType = "Car" } = req.body;
    if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
      res.status(400).json({ error: "Pickup and drop coordinates required" });
      return;
    }

    // Check no active ride
    const active = await db.execute(
      `SELECT id FROM rides WHERE rider_id = '${userId}' AND status IN ('requested','accepted','ongoing') LIMIT 1`
    );
    if ((active.rows as any[]).length) {
      res.status(409).json({ error: "You already have an active ride" });
      return;
    }

    const distanceKm = haversine(pickupLat, pickupLng, dropLat, dropLng);
    const durationMin = Math.round((distanceKm / 30) * 60); // avg 30 km/h
    const fare = estimateFare(distanceKm, vehicleType);

    const result = await db.execute(
      `INSERT INTO rides (rider_id, pickup_lat, pickup_lng, pickup_address, drop_lat, drop_lng, drop_address, distance_km, duration_min, fare, vehicle_type, status)
       VALUES ('${userId}', ${pickupLat}, ${pickupLng}, ${pickupAddress ? `'${pickupAddress.replace(/'/g, "''")}'` : 'NULL'},
               ${dropLat}, ${dropLng}, ${dropAddress ? `'${dropAddress.replace(/'/g, "''")}'` : 'NULL'},
               ${distanceKm.toFixed(2)}, ${durationMin}, ${fare}, '${vehicleType}', 'requested')
       RETURNING *`
    );
    res.json((result.rows as any[])[0]);
  } catch (err) {
    req.log.error({ err }, "Request ride error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// RIDER: Get active ride
router.get("/active", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const result = await db.execute(
      `SELECT r.*, 
         u.name as driver_name, u.phone as driver_phone,
         dl.lat as driver_lat, dl.lng as driver_lng
       FROM rides r
       LEFT JOIN users u ON u.id = r.driver_id
       LEFT JOIN driver_locations dl ON dl.driver_id = r.driver_id
       WHERE r.rider_id = '${userId}' AND r.status IN ('requested','accepted','ongoing')
       ORDER BY r.requested_at DESC LIMIT 1`
    );
    const row = (result.rows as any[])[0] || null;
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// RIDER: Get driver's current ride (driver's active ride)
router.get("/driver/active", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const result = await db.execute(
      `SELECT r.*, u.name as rider_name, u.phone as rider_phone
       FROM rides r JOIN users u ON u.id = r.rider_id
       WHERE r.driver_id = '${userId}' AND r.status IN ('accepted','ongoing')
       ORDER BY r.accepted_at DESC LIMIT 1`
    );
    const row = (result.rows as any[])[0] || null;
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// RIDER: Cancel ride
router.patch("/:id/cancel", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { id } = req.params;
    const result = await db.execute(
      `UPDATE rides SET status = 'cancelled'
       WHERE id = '${id}' AND rider_id = '${userId}' AND status IN ('requested','accepted')
       RETURNING *`
    );
    if (!(result.rows as any[]).length) { res.status(404).json({ error: "Ride not found or cannot cancel" }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET fare estimate
router.post("/estimate", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { pickupLat, pickupLng, dropLat, dropLng, vehicleType = "Car" } = req.body;
    if (!pickupLat || !pickupLng || !dropLat || !dropLng) {
      res.status(400).json({ error: "Coordinates required" }); return;
    }
    const distanceKm = haversine(pickupLat, pickupLng, dropLat, dropLng);
    const durationMin = Math.round((distanceKm / 30) * 60);
    const fare = estimateFare(distanceKm, vehicleType);
    res.json({ distanceKm: +distanceKm.toFixed(2), durationMin, fare, vehicleType });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET ride history
router.get("/history", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const result = await db.execute(
      `SELECT r.*, u.name as other_name
       FROM rides r
       LEFT JOIN users u ON u.id = CASE WHEN r.rider_id = '${userId}' THEN r.driver_id ELSE r.rider_id END
       WHERE r.rider_id = '${userId}' OR r.driver_id = '${userId}'
       ORDER BY r.requested_at DESC LIMIT 20`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
