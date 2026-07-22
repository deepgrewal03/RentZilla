import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware } from "./users.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();
type AR = Request & { userId: string };

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `verif_${randomUUID()}${ext}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    ok.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only JPG, PNG, PDF allowed"));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

function genId() { return randomUUID(); }
function toRows<T = any>(r: any): T[] { return Array.isArray(r) ? r : (r?.rows ?? []); }

// ── Compute trust score from a verification row + user row ─────────────────
function computeTrustScore(v: any, u: any): number {
  let score = 0;
  if (v?.phone_verified) score += 10;
  if (u?.email) score += 10;
  if (u?.name || (u?.first_name && u?.last_name)) score += 5;
  if (u?.profile_image) score += 5;
  if (v?.gov_id_status === "approved") score += 30;
  else if (v?.gov_id_status === "pending") score += 5;
  if (v?.selfie_status === "approved") score += 20;
  else if (v?.selfie_status === "pending") score += 3;
  if (v?.address_status === "approved") score += 15;
  else if (v?.address_status === "pending") score += 2;
  return Math.min(score, 100);
}

function computeLevel(score: number): string {
  if (score >= 80) return "trusted";
  if (score >= 55) return "verified";
  if (score >= 25) return "basic";
  return "unverified";
}

// ── GET /verification/me ────────────────────────────────────────────────────
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as AR).userId;
  try {
    const userRows = toRows(await db.execute(sql.raw(
      `SELECT email, name, first_name, last_name, profile_image, phone FROM users WHERE id = '${userId}'`
    )));
    const u = userRows[0];

    let vRows = toRows(await db.execute(sql.raw(
      `SELECT * FROM user_verification WHERE user_id = '${userId}'`
    )));

    // Auto-create verification record if missing
    if (!vRows.length) {
      const id = genId();
      const emailVerified = u?.email ? true : false;
      await db.execute(sql.raw(
        `INSERT INTO user_verification (id, user_id, phone_verified, email_verified)
         VALUES ('${id}', '${userId}', TRUE, ${emailVerified})
         ON CONFLICT (user_id) DO NOTHING`
      ));
      vRows = toRows(await db.execute(sql.raw(
        `SELECT * FROM user_verification WHERE user_id = '${userId}'`
      )));
    }

    const v = vRows[0];
    const trust_score = computeTrustScore(v, u);
    const level = computeLevel(trust_score);

    // Update score + level in DB
    await db.execute(sql.raw(
      `UPDATE user_verification SET trust_score = ${trust_score}, verification_level = '${level}', updated_at = NOW() WHERE user_id = '${userId}'`
    ));

    res.json({
      trust_score,
      verification_level: level,
      admin_note: v?.admin_note ?? null,
      items: [
        {
          key: "phone",
          label: "Phone Number",
          description: "Verified when you created your account",
          status: v?.phone_verified ? "approved" : "none",
          required: true,
        },
        {
          key: "email",
          label: "Email Address",
          description: "Add an email to your profile",
          status: u?.email ? "approved" : "none",
          required: false,
        },
        {
          key: "gov_id",
          label: "Government ID",
          description: "Aadhaar, PAN, or Driving Licence",
          status: v?.gov_id_status ?? "none",
          doc_id: v?.gov_id_doc_id,
          required: true,
          points: 30,
        },
        {
          key: "selfie",
          label: "Live Selfie",
          description: "A clear photo of your face",
          status: v?.selfie_status ?? "none",
          doc_id: v?.selfie_doc_id,
          required: true,
          points: 20,
        },
        {
          key: "address",
          label: "Address Proof",
          description: "Utility bill, bank statement, or Aadhaar",
          status: v?.address_status ?? "none",
          doc_id: v?.address_doc_id,
          required: false,
          points: 15,
        },
      ],
    });
  } catch (err) {
    logger.error({ err }, "Get verification status error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /verification/upload/:type — upload a verification document ─────────
router.post("/upload/:type", authMiddleware, upload.single("file"), async (req: Request, res: Response) => {
  const userId = (req as AR).userId;
  const { type } = req.params; // gov_id | selfie | address

  const validTypes = ["gov_id", "selfie", "address"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: "Invalid document type. Must be gov_id, selfie, or address." });
  }

  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded." });

  try {
    const file_url = `/uploads/${file.filename}`;
    const doc_id = genId();

    // Save to provider_documents with service_type = "identity"
    const docTypeLabel = type === "gov_id" ? "Government ID" : type === "selfie" ? "Selfie" : "Address Proof";
    const existing = toRows(await db.execute(sql.raw(
      `SELECT id, file_url FROM provider_documents WHERE user_id = '${userId}' AND service_type = 'identity' AND document_type = '${docTypeLabel}' LIMIT 1`
    )));
    if (existing.length) {
      const old = existing[0] as any;
      const oldPath = path.join(UPLOADS_DIR, path.basename(old.file_url));
      if (fs.existsSync(oldPath)) { try { fs.unlinkSync(oldPath); } catch {} }
      await db.execute(sql.raw(
        `UPDATE provider_documents SET file_url = '${file_url}', file_name = '${file.originalname.replace(/'/g, "''")}', file_size = ${file.size}, mime_type = '${file.mimetype}', status = 'pending', uploaded_at = NOW(), reviewed_at = NULL, admin_note = NULL WHERE id = '${old.id}'`
      ));
    } else {
      await db.execute(sql.raw(
        `INSERT INTO provider_documents (id, user_id, service_type, document_type, file_url, file_name, file_size, mime_type)
         VALUES ('${doc_id}', '${userId}', 'identity', '${docTypeLabel}', '${file_url}', '${file.originalname.replace(/'/g, "''")}', ${file.size}, '${file.mimetype}')`
      ));
    }

    const finalDocId = existing.length ? (existing[0] as any).id : doc_id;

    // Update user_verification with pending status
    const docField = `${type}_status`;
    const docIdField = `${type}_doc_id`;
    await db.execute(sql.raw(
      `INSERT INTO user_verification (id, user_id, ${docField}, ${docIdField})
       VALUES ('${genId()}', '${userId}', 'pending', '${finalDocId}')
       ON CONFLICT (user_id) DO UPDATE SET ${docField} = 'pending', ${docIdField} = '${finalDocId}', updated_at = NOW()`
    ));

    logger.info({ userId, type }, "Verification document uploaded");
    res.json({ ok: true, status: "pending", message: "Document submitted for review. We'll notify you once approved." });
  } catch (err) {
    logger.error({ err }, "Verification upload error");
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /verification/admin/all — list users with verifications ──────────────
// ?filter=pending (default) | approved | all
router.get("/admin/all", authMiddleware, async (req: Request, res: Response) => {
  const filter = (req.query.filter as string) || "pending";
  let whereClause = "";
  if (filter === "pending") {
    whereClause = `WHERE uv.gov_id_status = 'pending' OR uv.selfie_status = 'pending' OR uv.address_status = 'pending'`;
  } else if (filter === "approved") {
    whereClause = `WHERE uv.gov_id_status = 'approved' OR uv.selfie_status = 'approved' OR uv.address_status = 'approved'`;
  }
  // filter=all → no WHERE clause
  try {
    const rows = toRows(await db.execute(sql.raw(
      `SELECT
         uv.user_id, uv.phone_verified, uv.email_verified,
         uv.gov_id_status, uv.gov_id_doc_id,
         uv.selfie_status, uv.selfie_doc_id,
         uv.address_status, uv.address_doc_id,
         uv.admin_note, uv.updated_at,
         u.name AS user_name, u.email AS user_email, u.profile_image,
         u.first_name, u.last_name,
         gov.file_url AS gov_id_url, gov.file_name AS gov_id_file_name,
         selfie.file_url AS selfie_url, selfie.file_name AS selfie_file_name,
         addr.file_url AS address_url, addr.file_name AS address_file_name
       FROM user_verification uv
       LEFT JOIN users u ON uv.user_id = u.id
       LEFT JOIN provider_documents gov ON uv.gov_id_doc_id = gov.id
       LEFT JOIN provider_documents selfie ON uv.selfie_doc_id = selfie.id
       LEFT JOIN provider_documents addr ON uv.address_doc_id = addr.id
       ${whereClause}
       ORDER BY uv.updated_at DESC LIMIT 200`
    )));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Admin list verifications error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /admin/verification/:userId/:type/approve ─────────────────────────
router.patch("/admin/:userId/:type/approve", authMiddleware, async (req: Request, res: Response) => {
  const { userId, type } = req.params;
  const validTypes = ["gov_id", "selfie", "address"];
  if (!validTypes.includes(type)) return res.status(400).json({ error: "Invalid type" });

  const docField = `${type}_status`;
  const docTypeLabel = type === "gov_id" ? "Government ID" : type === "selfie" ? "Selfie" : "Address Proof";

  try {
    await db.execute(sql.raw(
      `UPDATE user_verification SET ${docField} = 'approved', updated_at = NOW() WHERE user_id = '${userId}'`
    ));
    await db.execute(sql.raw(
      `UPDATE provider_documents SET status = 'approved', reviewed_at = NOW() WHERE user_id = '${userId}' AND service_type = 'identity' AND document_type = '${docTypeLabel}'`
    ));
    // In-app notification to user
    try {
      const nId = genId();
      const nMsg = `Your ${docTypeLabel} has been verified! Your trust score has been updated.`;
      await db.execute(sql.raw(
        `INSERT INTO notifications (id, user_id, title, message, is_read, created_at) VALUES ('${nId}', '${userId}', 'Verification Approved', '${nMsg.replace(/'/g, "''")}', FALSE, NOW())`
      ));
    } catch {}
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /admin/verification/:userId/:type/reject ──────────────────────────
router.patch("/admin/:userId/:type/reject", authMiddleware, async (req: Request, res: Response) => {
  const { userId, type } = req.params;
  const { reason = "Document could not be verified. Please resubmit." } = req.body;
  const validTypes = ["gov_id", "selfie", "address"];
  if (!validTypes.includes(type)) return res.status(400).json({ error: "Invalid type" });

  const docField = `${type}_status`;
  const docTypeLabel = type === "gov_id" ? "Government ID" : type === "selfie" ? "Selfie" : "Address Proof";

  try {
    await db.execute(sql.raw(
      `UPDATE user_verification SET ${docField} = 'rejected', admin_note = '${reason.replace(/'/g, "''")}', updated_at = NOW() WHERE user_id = '${userId}'`
    ));
    await db.execute(sql.raw(
      `UPDATE provider_documents SET status = 'rejected', admin_note = '${reason.replace(/'/g, "''")}', reviewed_at = NOW() WHERE user_id = '${userId}' AND service_type = 'identity' AND document_type = '${docTypeLabel}'`
    ));
    try {
      const nId = genId();
      const nMsg = `Your ${docTypeLabel} could not be verified. Reason: ${reason}. Please resubmit from Trust & Verification.`;
      await db.execute(sql.raw(
        `INSERT INTO notifications (id, user_id, title, message, is_read, created_at) VALUES ('${nId}', '${userId}', 'Verification Needs Resubmission', '${nMsg.replace(/'/g, "''")}', FALSE, NOW())`
      ));
    } catch {}
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
