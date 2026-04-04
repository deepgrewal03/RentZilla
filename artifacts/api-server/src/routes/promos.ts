import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router = Router();
type AR = Request & { userId: string };
function toRows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }

// GET /promos/vault — user's active wheel/promo vault
router.get("/vault", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    await db.execute(sql.raw(`
      UPDATE promo_vault SET is_expired = TRUE
      WHERE user_id = '${userId}' AND expiry_date < NOW() AND is_expired = FALSE
    `));
    const rows = toRows(await db.execute(sql.raw(`
      SELECT * FROM promo_vault
      WHERE user_id = '${userId}' AND is_used = FALSE AND is_expired = FALSE
      ORDER BY discount_value DESC, created_at DESC
    `)));
    res.json({
      promos: rows.map(p => ({
        id: p.id, type: p.type,
        discountValue: Number(p.discount_value),
        discountType: p.discount_type,
        description: p.description,
        expiryDate: p.expiry_date,
        createdAt: p.created_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /promos/use/:id — mark a vault promo as used
router.post("/use/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const promoId = req.params.id;
    const rows = toRows(await db.execute(sql.raw(`
      SELECT * FROM promo_vault
      WHERE id = '${promoId}' AND user_id = '${userId}' AND is_used = FALSE AND is_expired = FALSE
      LIMIT 1
    `)));
    if (!rows.length) {
      res.status(404).json({ error: "Promo not found or already used" });
      return;
    }
    await db.execute(sql.raw(`
      UPDATE promo_vault SET is_used = TRUE, used_at = NOW() WHERE id = '${promoId}'
    `));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
