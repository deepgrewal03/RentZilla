import { Router, type IRouter, type Request as ExpressRequest, type Response } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { authMiddleware } from "./users.js";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router: IRouter = Router();
type Request = ExpressRequest<Record<string, string>>;
type AR = Request & { userId: string };

// Ensure uploads dir exists
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only JPG, PNG, and PDF files are allowed"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
});

// ─── Document type definitions ────────────────────────────────────────────

export const SERVICE_DOCS: Record<string, string[]> = {
  cars: [
    "Registration Certificate (RC)",
    "Pollution Certificate",
    "Insurance",
    "Driver's License",
    "Car Insurance",
    "Taxi Permit",
    "Driver Aadhaar / Voter ID",
  ],
  tractors: [
    "Registration Certificate (RC)",
    "Insurance",
    "Driver's License",
    "Aadhaar / Voter ID",
  ],
  earth_movers: [
    "Registration Certificate (RC)",
    "Insurance",
    "Driver's License",
    "Pollution Certificate",
    "Fitness Certificate",
  ],
  plumbers: [
    "Front Face Photo",
    "Address Proof",
    "Aadhaar Card",
  ],
  electricians: [
    "Front Face Photo",
    "Address Proof",
    "Aadhaar Card",
  ],
  beauty_parlors: [
    "Front Face Photo",
    "Address Proof",
    "Aadhaar Card",
    "Shop Photo",
  ],
  mechanic: [
    "Front Face Photo",
    "Address Proof",
    "Aadhaar Card",
  ],
};

// GET /documents/service-docs — return service→docs mapping
router.get("/service-docs", (_req, res) => {
  res.json(SERVICE_DOCS);
});

// GET /documents/file/:filename — serve an uploaded file (proxy-safe)
router.get("/file/:filename", async (req: Request, res: Response) => {
  try {
    const filename = path.basename(req.params.filename); // prevent path traversal
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    // Determine content type from extension
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".pdf": "application/pdf",
    };
    const contentType = mimeMap[ext] || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: "Could not serve file" });
  }
});

// GET /documents?service_type= — list my docs (optionally filtered by service)
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { service_type } = req.query;
    let query = `SELECT * FROM provider_documents WHERE user_id = $1`;
    const params: string[] = [userId];
    if (service_type && typeof service_type === "string") {
      query += ` AND service_type = $2`;
      params.push(service_type);
    }
    query += ` ORDER BY uploaded_at DESC`;
    const result = await db.execute(sql.raw(query.replace("$1", `'${userId}'`).replace("$2", `'${service_type}'`)));
    res.json(result.rows);
  } catch (err) {
    req.log.error({ err }, "List documents error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /documents/upload — upload a document file
router.post("/upload", authMiddleware, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const file = req.file;
    if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }

    const { service_type, document_type } = req.body;
    if (!service_type || !document_type) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "service_type and document_type are required" });
      return;
    }

    // Build the file URL (will be served as static from /uploads/)
    const file_url = `/uploads/${file.filename}`;

    // Check if this doc already exists → replace it
    const existing = await db.execute(
      sql`SELECT id, file_url FROM provider_documents WHERE user_id = ${userId} AND service_type = ${service_type} AND document_type = ${document_type} LIMIT 1`
    );
    if (existing.rows.length > 0) {
      const old = existing.rows[0] as { id: string; file_url: string };
      // Delete old file
      const oldPath = path.join(UPLOADS_DIR, path.basename(old.file_url));
      if (fs.existsSync(oldPath)) { try { fs.unlinkSync(oldPath); } catch { } }
      // Update record
      await db.execute(
        sql`UPDATE provider_documents SET file_url = ${file_url}, file_name = ${file.originalname}, file_size = ${file.size}, mime_type = ${file.mimetype}, status = 'pending', uploaded_at = NOW(), reviewed_at = NULL, admin_note = NULL WHERE id = ${old.id}`
      );
      const updated = await db.execute(sql`SELECT * FROM provider_documents WHERE id = ${old.id}`);
      res.json(updated.rows[0]);
      return;
    }

    const id = randomUUID();
    await db.execute(
      sql`INSERT INTO provider_documents (id, user_id, service_type, document_type, file_url, file_name, file_size, mime_type) VALUES (${id}, ${userId}, ${service_type}, ${document_type}, ${file_url}, ${file.originalname}, ${file.size}, ${file.mimetype})`
    );
    const inserted = await db.execute(sql`SELECT * FROM provider_documents WHERE id = ${id}`);
    res.json(inserted.rows[0]);
  } catch (err) {
    req.log.error({ err }, "Upload document error");
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch { } }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /documents/:id — delete a document
router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const result = await db.execute(
      sql`SELECT * FROM provider_documents WHERE id = ${req.params.id} AND user_id = ${userId} LIMIT 1`
    );
    if (!result.rows.length) { res.status(404).json({ error: "Document not found" }); return; }
    const doc = result.rows[0] as { file_url: string };
    // Delete file
    const filePath = path.join(UPLOADS_DIR, path.basename(doc.file_url));
    if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch { } }
    await db.execute(sql`DELETE FROM provider_documents WHERE id = ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete document error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Admin endpoints ─────────────────────────────────────────────────────

// GET /documents/admin/all — list all docs (admin)
router.get("/admin/all", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { service_type, status } = req.query;
    let q = `SELECT pd.*, u.name as user_name, u.email as user_email FROM provider_documents pd LEFT JOIN users u ON pd.user_id = u.id WHERE 1=1`;
    if (service_type) q += ` AND pd.service_type = '${service_type}'`;
    if (status) q += ` AND pd.status = '${status}'`;
    q += ` ORDER BY pd.uploaded_at DESC LIMIT 100`;
    const result = await db.execute(sql.raw(q));
    res.json(result.rows);
  } catch (err) {
    req.log.error({ err }, "Admin list docs error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /documents/admin/:id/approve
router.patch("/admin/:id/approve", authMiddleware, async (req: Request, res: Response) => {
  try {
    await db.execute(
      sql`UPDATE provider_documents SET status = 'approved', reviewed_at = NOW(), admin_note = ${req.body.note ?? null} WHERE id = ${req.params.id}`
    );
    // If this is an identity doc, also update user_verification so trust score updates
    const docRows = await db.execute(
      sql`SELECT user_id, service_type, document_type FROM provider_documents WHERE id = ${req.params.id} LIMIT 1`
    );
    if (docRows.rows.length) {
      const doc = docRows.rows[0] as { user_id: string; service_type: string; document_type: string };
      if (doc.service_type === "identity") {
        const typeMap: Record<string, string> = {
          "Government ID": "gov_id",
          "Selfie": "selfie",
          "Address Proof": "address",
        };
        const field = typeMap[doc.document_type];
        if (field) {
          await db.execute(sql.raw(
            `UPDATE user_verification SET ${field}_status = 'approved', updated_at = NOW() WHERE user_id = '${doc.user_id}'`
          ));
          try {
            const nId = randomUUID();
            const msg = `Your ${doc.document_type} has been verified! Your trust score has been updated.`;
            await db.execute(sql.raw(
              `INSERT INTO notifications (id, user_id, title, message, is_read, created_at) VALUES ('${nId}', '${doc.user_id}', 'Verification Approved', '${msg.replace(/'/g, "''")}', FALSE, NOW())`
            ));
          } catch {}
        }
      }
    }
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "Admin approve doc error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /documents/admin/:id/reject
router.patch("/admin/:id/reject", authMiddleware, async (req: Request, res: Response) => {
  try {
    const note = req.body.note ?? "Rejected";
    await db.execute(
      sql`UPDATE provider_documents SET status = 'rejected', reviewed_at = NOW(), admin_note = ${note} WHERE id = ${req.params.id}`
    );
    // If identity doc, update user_verification too
    const docRows = await db.execute(
      sql`SELECT user_id, service_type, document_type FROM provider_documents WHERE id = ${req.params.id} LIMIT 1`
    );
    if (docRows.rows.length) {
      const doc = docRows.rows[0] as { user_id: string; service_type: string; document_type: string };
      if (doc.service_type === "identity") {
        const typeMap: Record<string, string> = {
          "Government ID": "gov_id",
          "Selfie": "selfie",
          "Address Proof": "address",
        };
        const field = typeMap[doc.document_type];
        if (field) {
          await db.execute(sql.raw(
            `UPDATE user_verification SET ${field}_status = 'rejected', admin_note = '${note.replace(/'/g, "''")}', updated_at = NOW() WHERE user_id = '${doc.user_id}'`
          ));
          try {
            const nId = randomUUID();
            const msg = `Your ${doc.document_type} could not be verified. Reason: ${note}. Please resubmit from Trust & Verification.`;
            await db.execute(sql.raw(
              `INSERT INTO notifications (id, user_id, title, message, is_read, created_at) VALUES ('${nId}', '${doc.user_id}', 'Verification Needs Resubmission', '${msg.replace(/'/g, "''")}', FALSE, NOW())`
            ));
          } catch {}
        }
      }
    }
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "Admin reject doc error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /documents/completion?service_type= — check completion % for a service
router.get("/completion", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { service_type } = req.query;
    if (!service_type || typeof service_type !== "string") {
      res.status(400).json({ error: "service_type required" });
      return;
    }
    const required = SERVICE_DOCS[service_type] ?? [];
    const uploaded = await db.execute(
      sql`SELECT document_type, status FROM provider_documents WHERE user_id = ${userId} AND service_type = ${service_type}`
    );
    const uploadedMap: Record<string, string> = {};
    for (const row of uploaded.rows as { document_type: string; status: string }[]) {
      uploadedMap[row.document_type] = row.status;
    }
    const total = required.length;
    const done = required.filter((d) => uploadedMap[d] !== undefined).length;
    const approved = required.filter((d) => uploadedMap[d] === "approved").length;
    res.json({
      service_type,
      required,
      total,
      uploaded: done,
      approved,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
      readyToGoOnline: approved === total && total > 0,
      documents: uploadedMap,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
