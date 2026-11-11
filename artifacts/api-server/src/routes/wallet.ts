import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authMiddleware } from "./users.js";

const router: IRouter = Router();
type AR = Request & { userId: string };

// Enforce provider eligibility on every provider wallet route, not just in UI.
router.use("/provider", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = toRows(await db.execute(sql`SELECT role FROM users WHERE id = ${(req as AR).userId} LIMIT 1`));
    if (!["provider", "both"].includes(rows[0]?.role)) {
      res.status(403).json({ error: "Provider wallet and payouts require a provider account" });
      return;
    }
    next();
  } catch (err) {
    req.log?.error({ err }, "Provider wallet authorization failed");
    res.status(500).json({ error: "Unable to verify provider access" });
  }
});

// Gateway checkout credentials do not authorize bank disbursements.
// The legacy handlers below only recorded deductions, never external transfers.
router.post("/provider/payout/instant", (_req: Request, res: Response) => {
  res.status(503).json({ error: "Bank payouts are not connected yet. No money has been deducted from your wallet." });
});
router.use(["/provider/payout/schedule", "/provider/payout-preference"], (req: Request, res: Response, next: NextFunction) => {
  if (req.body?.preference === "weekly" || req.body?.preference === "instant") {
    res.status(503).json({ error: "Automatic bank payouts are not connected yet. Your money will remain in your wallet." });
    return;
  }
  next();
});

// Legacy direct credits are not payments. Never allow callers to mint funds.
router.post("/topup", authMiddleware, (_req: Request, res: Response) => {
  res.status(410).json({ error: "Use Razorpay checkout to add money. Wallet credit requires a verified captured payment." });
});

function toRows(res: any): any[] {
  return Array.isArray(res) ? res : (res?.rows ?? []);
}

function newId(): string {
  return `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

async function setOwnedDefault(userId: string, methodId: string): Promise<boolean> {
  return db.transaction(async tx => {
    // Serialize changes for this user, and validate ownership before clearing defaults.
    await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
    const rows = toRows(await tx.execute(sql`SELECT id FROM user_payment_methods WHERE id = ${methodId} AND user_id = ${userId}`));
    if (!rows.length) return false;
    await tx.execute(sql`UPDATE user_payment_methods SET is_default = (id = ${methodId}) WHERE user_id = ${userId}`);
    return true;
  });
}

// ── GET /wallet — customer wallet balance + transactions ───────────────────
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const users = toRows(await db.execute(sql.raw(`SELECT wallet_balance, upi_id FROM users WHERE id = '${userId}' LIMIT 1`)));
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }

    const txRows = toRows(await db.execute(sql.raw(`
      SELECT * FROM wallet_transactions WHERE user_id = '${userId}'
      ORDER BY created_at DESC LIMIT 50
    `)));

    res.json({
      balance: Number(users[0].wallet_balance || 0),
      upiId: users[0].upi_id || null,
      transactions: txRows.map(t => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        balanceAfter: Number(t.balance_after || 0),
        referenceId: t.reference_id,
        referenceType: t.reference_type,
        description: t.description,
        status: t.status,
        createdAt: t.created_at,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Wallet fetch error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /wallet/balance — lightweight alias returning just balance ─────────
router.get("/balance", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const users = toRows(await db.execute(sql.raw(`SELECT wallet_balance FROM users WHERE id = '${userId}' LIMIT 1`)));
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ balance: Number(users[0].wallet_balance || 0), currency: "INR" });
  } catch (err) {
    req.log?.error({ err }, "Wallet balance error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /wallet/transactions — paginated transaction history ───────────────
router.get("/transactions", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const page = parseInt(String(req.query.page || "1"));
    const limit = 20;
    const offset = (page - 1) * limit;

    const txRows = toRows(await db.execute(sql.raw(`
      SELECT * FROM wallet_transactions WHERE user_id = '${userId}'
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `)));
    const countRows = toRows(await db.execute(sql.raw(`
      SELECT COUNT(*) as total FROM wallet_transactions WHERE user_id = '${userId}'
    `)));

    res.json({
      transactions: txRows.map(t => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        balanceAfter: Number(t.balance_after || 0),
        referenceId: t.reference_id,
        referenceType: t.reference_type,
        description: t.description,
        status: t.status,
        createdAt: t.created_at,
      })),
      total: Number(countRows[0]?.total || 0),
      page,
      pages: Math.ceil(Number(countRows[0]?.total || 0) / limit),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /wallet/provider — provider wallet + earnings ─────────────────────
router.get("/provider", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const users = toRows(await db.execute(sql.raw(`
      SELECT wallet_balance, payout_preference, upi_id FROM users WHERE id = '${userId}' LIMIT 1
    `)));
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [txRows, payoutRows, monthEarnings, totalEarnings, pendingPayouts] = await Promise.all([
      db.execute(sql.raw(`
        SELECT * FROM wallet_transactions WHERE user_id = '${userId}'
        ORDER BY created_at DESC LIMIT 30
      `)),
      db.execute(sql.raw(`
        SELECT * FROM payouts WHERE provider_id = '${userId}'
        ORDER BY created_at DESC LIMIT 20
      `)),
      db.execute(sql.raw(`
        SELECT COALESCE(SUM(provider_earning), 0) as total FROM bookings
        WHERE provider_id = '${userId}' AND status = 'completed' AND created_at >= '${monthStart}'
      `)),
      db.execute(sql.raw(`
        SELECT COALESCE(SUM(provider_earning), 0) as total FROM bookings
        WHERE provider_id = '${userId}' AND status = 'completed'
      `)),
      db.execute(sql.raw(`
        SELECT COALESCE(SUM(amount), 0) as total FROM payouts
        WHERE provider_id = '${userId}' AND status = 'pending'
      `)),
    ]);

    res.json({
      balance: Number(users[0].wallet_balance || 0),
      payoutPreference: users[0].payout_preference || "wallet",
      upiId: users[0].upi_id || null,
      monthEarnings: Number(toRows(monthEarnings)[0]?.total || 0),
      totalEarnings: Number(toRows(totalEarnings)[0]?.total || 0),
      pendingPayouts: Number(toRows(pendingPayouts)[0]?.total || 0),
      transactions: toRows(txRows).map(t => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        balanceAfter: Number(t.balance_after || 0),
        description: t.description,
        referenceId: t.reference_id,
        status: t.status,
        createdAt: t.created_at,
      })),
      payouts: toRows(payoutRows).map(p => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        upiId: p.upi_id,
        status: p.status,
        scheduledAt: p.scheduled_at,
        processedAt: p.processed_at,
        notes: p.notes,
        createdAt: p.created_at,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Provider wallet error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /wallet/provider/payout/info — next Monday date + default method ──
router.get("/provider/payout/info", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;

    // Next Monday in IST
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon
    const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 || 7;
    const nextMonday = new Date(now);
    nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
    nextMonday.setUTCHours(3, 30, 0, 0); // 9:00 AM IST = 3:30 UTC

    const defaultMethod = toRows(await db.execute(sql.raw(`
      SELECT id, type, label, masked_display, is_default
      FROM user_payment_methods
      WHERE user_id = '${userId}' AND is_default = TRUE
      LIMIT 1
    `)));

    res.json({
      nextMondayPayout: nextMonday.toISOString(),
      nextMondayLabel: nextMonday.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }),
      instantFee: 5,
      defaultMethod: defaultMethod.length ? {
        id: defaultMethod[0].id,
        type: defaultMethod[0].type,
        label: defaultMethod[0].label,
        maskedDisplay: defaultMethod[0].masked_display,
      } : null,
    });
  } catch (err) {
    req.log.error({ err }, "Payout info error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /wallet/provider/payout/instant — instant payout with ₹5 fee ─────
// Accepts paymentMethodId (saved method) OR upiId (ad-hoc UPI).
// Deducts amount + ₹5 fee from wallet, transfers amount to provider's account.
router.post("/provider/payout/instant", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { amount, paymentMethodId, upiId } = req.body;
    const amt = parseFloat(amount);
    const INSTANT_FEE = 5; // ₹5 flat instant transfer fee

    if (!amt || amt <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }
    if (amt < INSTANT_FEE + 1) {
      res.status(400).json({ error: `Minimum payout is ₹${INSTANT_FEE + 1} (₹${INSTANT_FEE} fee + ₹1)` }); return;
    }

    // Resolve payment method
    let methodType = "upi";
    let methodLabel = "";
    let maskedDisplay = "";
    let methodId: string | null = null;
    let savedUpiId: string | null = null;

    if (paymentMethodId) {
      const pm = toRows(await db.execute(sql.raw(`
        SELECT id, type, label, masked_display FROM user_payment_methods
        WHERE id = '${paymentMethodId}' AND user_id = '${userId}' LIMIT 1
      `)));
      if (!pm.length) { res.status(404).json({ error: "Payment method not found" }); return; }
      methodType    = pm[0].type;
      methodLabel   = pm[0].label;
      maskedDisplay = pm[0].masked_display;
      methodId      = pm[0].id;
      if (methodType === "upi") savedUpiId = maskedDisplay;
    } else if (upiId?.trim()) {
      savedUpiId    = upiId.trim();
      maskedDisplay = upiId.trim();
      methodLabel   = "UPI";
    } else {
      // Try default method
      const pm = toRows(await db.execute(sql.raw(`
        SELECT id, type, label, masked_display FROM user_payment_methods
        WHERE user_id = '${userId}' AND is_default = TRUE LIMIT 1
      `)));
      if (!pm.length) {
        res.status(400).json({ error: "No payment method provided. Add a UPI / bank / card first." }); return;
      }
      methodType    = pm[0].type;
      methodLabel   = pm[0].label;
      maskedDisplay = pm[0].masked_display;
      methodId      = pm[0].id;
      if (methodType === "upi") savedUpiId = maskedDisplay;
    }

    const totalDeduct = amt + INSTANT_FEE;

    const users = toRows(await db.execute(sql.raw(`
      SELECT wallet_balance FROM users WHERE id = '${userId}' LIMIT 1
    `)));
    const balance = Number(users[0]?.wallet_balance || 0);
    if (totalDeduct > balance) {
      res.status(400).json({ error: `Insufficient balance. Need ₹${totalDeduct.toFixed(2)} (₹${amt} + ₹${INSTANT_FEE} fee). Available: ₹${balance.toFixed(2)}` }); return;
    }

    const updated = toRows(await db.execute(sql.raw(`
      UPDATE users SET wallet_balance = wallet_balance - ${totalDeduct}
      WHERE id = '${userId}' AND wallet_balance >= ${totalDeduct}
      RETURNING wallet_balance
    `)));
    if (!updated.length) { res.status(400).json({ error: "Insufficient balance or concurrent update" }); return; }

    const newBalance = Number(updated[0].wallet_balance);
    const payoutId   = newId();
    const txPayout   = newId();
    const txFee      = newId();
    const safeMasked = maskedDisplay.replace(/'/g, "''");
    const safeLabel  = methodLabel.replace(/'/g, "''");
    const pmId       = methodId ? `'${methodId}'` : "NULL";
    const upiCol     = savedUpiId ? `'${savedUpiId.replace(/'/g, "''")}'` : "NULL";

    await db.execute(sql.raw(`
      INSERT INTO payouts
        (id, provider_id, amount, fee, method, payment_method_id, upi_id, masked_display, status, processed_at, notes)
      VALUES (
        '${payoutId}', '${userId}', ${amt}, ${INSTANT_FEE}, 'instant',
        ${pmId}, ${upiCol}, '${safeMasked}', 'processing', NOW(),
        'Instant payout to ${safeLabel}: ${safeMasked}'
      )
    `));

    // Main payout transaction
    await db.execute(sql.raw(`
      INSERT INTO wallet_transactions
        (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
      VALUES (
        '${txPayout}', '${userId}', 'payout', ${amt}, ${newBalance + INSTANT_FEE}, '${payoutId}', 'payout',
        'Instant payout to ${safeLabel} (${safeMasked})', 'completed'
      )
    `));

    // Fee transaction
    await db.execute(sql.raw(`
      INSERT INTO wallet_transactions
        (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
      VALUES (
        '${txFee}', '${userId}', 'fee', ${INSTANT_FEE}, ${newBalance}, '${payoutId}', 'payout',
        'Instant transfer fee', 'completed'
      )
    `));

    res.json({
      payoutId,
      amount: amt,
      fee: INSTANT_FEE,
      totalDeducted: totalDeduct,
      newBalance,
      method: methodType,
      maskedDisplay,
      status: "processing",
      message: `₹${amt.toFixed(2)} sent to ${methodLabel || methodType} (${maskedDisplay}). ₹${INSTANT_FEE} fee charged. Typically arrives in 30 minutes.`,
    });
  } catch (err) {
    req.log.error({ err }, "Instant payout error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /wallet/provider/payout/schedule — set payout preference ──────────
router.post("/provider/payout/schedule", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { preference, upiId } = req.body;
    if (!["instant", "weekly", "wallet"].includes(preference)) {
      res.status(400).json({ error: "Invalid preference. Use: instant, weekly, or wallet" });
      return;
    }

    const sets = [`payout_preference = '${preference}'`];
    if (upiId?.trim()) sets.push(`upi_id = '${upiId.trim()}'`);
    await db.execute(sql.raw(`UPDATE users SET ${sets.join(", ")} WHERE id = '${userId}'`));

    res.json({ preference, message: `Payout preference set to: ${preference}` });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /wallet/provider/methods — alias used by mobile app ───────────────
router.get("/provider/methods", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const rows = toRows(await db.execute(sql.raw(`
      SELECT id, type, label, masked_display, is_default, created_at
      FROM user_payment_methods WHERE user_id = '${userId}'
      ORDER BY is_default DESC, created_at DESC
    `)));
    res.json({ methods: rows.map(m => ({ id: m.id, type: m.type, label: m.label, maskedDisplay: m.masked_display, isDefault: m.is_default, createdAt: m.created_at })) });
  } catch (err) {
    req.log.error({ err }, "Get payment methods error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /wallet/provider/methods — add payment method (mobile alias) ──────
router.post("/provider/methods", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { encryptPayment } = await import("../lib/crypto.js");
    const userId = (req as AR).userId;
    const { type, label, upiId, cardNumber, cardName, cardExpiry, bankName, accountNumber, ifsc } = req.body;

    if (!type || !label) { res.status(400).json({ error: "type and label required" }); return; }

    let plainDetails: Record<string, string> = {};
    let maskedDisplay = "";

    if (type === "upi") {
      if (!upiId?.trim()) { res.status(400).json({ error: "upiId required for UPI" }); return; }
      plainDetails = { upiId: upiId.trim() };
      maskedDisplay = upiId.trim();
    } else if (type === "card") {
      if (!cardNumber || cardNumber.length < 12) { res.status(400).json({ error: "Valid card number required" }); return; }
      const last4 = String(cardNumber).replace(/\s/g, "").slice(-4);
      plainDetails = { cardNumber: String(cardNumber).replace(/\s/g, ""), cardName: cardName || "", cardExpiry: cardExpiry || "" };
      maskedDisplay = `•••• •••• •••• ${last4}${cardName ? ` · ${cardName}` : ""}`;
    } else if (type === "bank") {
      if (!accountNumber || !ifsc) { res.status(400).json({ error: "accountNumber and ifsc required" }); return; }
      const last4 = String(accountNumber).slice(-4);
      plainDetails = { bankName: bankName || "", accountNumber: String(accountNumber), ifsc: ifsc.trim().toUpperCase() };
      maskedDisplay = `${bankName || "Bank"} •••• ${last4} · ${ifsc.trim().toUpperCase()}`;
    } else {
      res.status(400).json({ error: "type must be upi, card, or bank" }); return;
    }

    const encryptedDetails = encryptPayment(JSON.stringify(plainDetails));
    const id = `pm${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
    const safeLabel = String(label).replace(/'/g, "''");
    const safeMasked = maskedDisplay.replace(/'/g, "''");

    const isFirst = toRows(await db.execute(sql.raw(`SELECT COUNT(*) as c FROM user_payment_methods WHERE user_id = '${userId}'`)));
    const makeDefault = Number(isFirst[0]?.c || 0) === 0;

    await db.execute(sql.raw(`
      INSERT INTO user_payment_methods (id, user_id, type, label, encrypted_details, masked_display, is_default)
      VALUES ('${id}', '${userId}', '${type}', '${safeLabel}', '${encryptedDetails}', '${safeMasked}', ${makeDefault})
    `));

    res.json({ success: true, id, maskedDisplay, isDefault: makeDefault });
  } catch (err) {
    req.log.error({ err }, "Add payment method error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /wallet/provider/methods/:id/default — set as default (mobile alias) ─
router.put("/provider/methods/:id/default", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    if (!await setOwnedDefault(userId, String(req.params.id))) {
      res.status(404).json({ error: "Payment method not found" }); return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /wallet/provider/methods/:id (mobile alias) ───────────────────
router.delete("/provider/methods/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const removed = toRows(await db.execute(sql`DELETE FROM user_payment_methods WHERE id = ${String(req.params.id)} AND user_id = ${userId} RETURNING id`));
    if (!removed.length) { res.status(404).json({ error: "Payment method not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /wallet/provider/payout-preference — save payout preference ────────
router.put("/provider/payout-preference", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const { preference, upiId } = req.body;
    if (!["instant", "weekly", "wallet"].includes(preference)) {
      res.status(400).json({ error: "Invalid preference. Use: instant, weekly, or wallet" }); return;
    }
    const sets = [`payout_preference = '${preference}'`];
    if (upiId?.trim()) sets.push(`upi_id = '${upiId.trim()}'`);
    await db.execute(sql.raw(`UPDATE users SET ${sets.join(", ")} WHERE id = '${userId}'`));
    res.json({ preference, message: `Payout preference set to: ${preference}` });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /wallet/payment-methods — user's saved payment methods ────────────
router.get("/payment-methods", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const rows = toRows(await db.execute(sql.raw(`
      SELECT id, type, label, masked_display, is_default, created_at
      FROM user_payment_methods WHERE user_id = '${userId}'
      ORDER BY is_default DESC, created_at DESC
    `)));
    res.json({ methods: rows.map(m => ({ id: m.id, type: m.type, label: m.label, maskedDisplay: m.masked_display, isDefault: m.is_default, createdAt: m.created_at })) });
  } catch (err) {
    req.log.error({ err }, "Get payment methods error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /wallet/payment-methods — add payment method (details AES-256-GCM encrypted) ──
router.post("/payment-methods", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { encryptPayment } = await import("../lib/crypto.js");
    const userId = (req as AR).userId;
    const { type, label, upiId, cardNumber, cardName, cardExpiry, bankName, accountNumber, ifsc } = req.body;

    if (!type || !label) { res.status(400).json({ error: "type and label required" }); return; }

    let plainDetails: Record<string, string> = {};
    let maskedDisplay = "";

    if (type === "upi") {
      if (!upiId?.trim()) { res.status(400).json({ error: "upiId required for UPI" }); return; }
      plainDetails = { upiId: upiId.trim() };
      maskedDisplay = upiId.trim();
    } else if (type === "card") {
      if (!cardNumber || cardNumber.length < 12) { res.status(400).json({ error: "Valid card number required" }); return; }
      const last4 = String(cardNumber).replace(/\s/g, "").slice(-4);
      plainDetails = { cardNumber: String(cardNumber).replace(/\s/g, ""), cardName: cardName || "", cardExpiry: cardExpiry || "" };
      maskedDisplay = `•••• •••• •••• ${last4}${cardName ? ` · ${cardName}` : ""}`;
    } else if (type === "bank") {
      if (!accountNumber || !ifsc) { res.status(400).json({ error: "accountNumber and ifsc required" }); return; }
      const last4 = String(accountNumber).slice(-4);
      plainDetails = { bankName: bankName || "", accountNumber: String(accountNumber), ifsc: ifsc.trim().toUpperCase() };
      maskedDisplay = `${bankName || "Bank"} •••• ${last4} · ${ifsc.trim().toUpperCase()}`;
    } else {
      res.status(400).json({ error: "type must be upi, card, or bank" }); return;
    }

    const encryptedDetails = encryptPayment(JSON.stringify(plainDetails));
    const id = `pm${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
    const safeLabel = String(label).replace(/'/g, "''");
    const safeMasked = maskedDisplay.replace(/'/g, "''");

    const isFirst = toRows(await db.execute(sql.raw(`SELECT COUNT(*) as c FROM user_payment_methods WHERE user_id = '${userId}'`)));
    const makeDefault = Number(isFirst[0]?.c || 0) === 0;

    await db.execute(sql.raw(`
      INSERT INTO user_payment_methods (id, user_id, type, label, encrypted_details, masked_display, is_default)
      VALUES ('${id}', '${userId}', '${type}', '${safeLabel}', '${encryptedDetails}', '${safeMasked}', ${makeDefault})
    `));

    res.json({ success: true, id, maskedDisplay, isDefault: makeDefault });
  } catch (err) {
    req.log.error({ err }, "Add payment method error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /wallet/payment-methods/:id/default — set as default ─────────────
router.put("/payment-methods/:id/default", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    if (!await setOwnedDefault(userId, String(req.params.id))) {
      res.status(404).json({ error: "Payment method not found" }); return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /wallet/payment-methods/:id ───────────────────────────────────
router.delete("/payment-methods/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const removed = toRows(await db.execute(sql`DELETE FROM user_payment_methods WHERE id = ${String(req.params.id)} AND user_id = ${userId} RETURNING id`));
    if (!removed.length) { res.status(404).json({ error: "Payment method not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /wallet/admin/transactions — all wallet transactions with filters ──
router.get("/admin/transactions", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const adminCheck = toRows(await db.execute(sql.raw(`SELECT is_admin FROM users WHERE id = '${userId}' LIMIT 1`)));
    if (!adminCheck[0]?.is_admin) { res.status(403).json({ error: "Admin only" }); return; }

    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "20"))));
    const offset = (page - 1) * limit;
    const status = String(req.query.status || "");
    const type = String(req.query.type || "");
    const search = String(req.query.search || "").replace(/'/g, "''");

    let where = "1=1";
    if (status) where += ` AND wt.status = '${status}'`;
    if (type) where += ` AND wt.type = '${type}'`;
    if (search) where += ` AND (u.name ILIKE '%${search}%' OR u.email ILIKE '%${search}%')`;

    const [txRows, countRow] = await Promise.all([
      db.execute(sql.raw(`
        SELECT wt.*, u.name as user_name, u.email as user_email, u.role as user_role
        FROM wallet_transactions wt
        JOIN users u ON u.id = wt.user_id
        WHERE ${where}
        ORDER BY wt.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `)),
      db.execute(sql.raw(`
        SELECT COUNT(*) as total
        FROM wallet_transactions wt
        JOIN users u ON u.id = wt.user_id
        WHERE ${where}
      `)),
    ]);

    res.json({
      transactions: toRows(txRows).map(t => ({
        id: t.id, userId: t.user_id, userName: t.user_name, userEmail: t.user_email,
        userRole: t.user_role, type: t.type, amount: Number(t.amount),
        balanceAfter: Number(t.balance_after), referenceId: t.reference_id,
        referenceType: t.reference_type, description: t.description,
        status: t.status, createdAt: t.created_at,
      })),
      total: Number(toRows(countRow)[0]?.total || 0),
      page, limit,
    });
  } catch (err) {
    req.log.error({ err }, "Admin transactions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /wallet/admin/upcoming-bookings — future bookings + expected commission ──
router.get("/admin/upcoming-bookings", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const adminCheck = toRows(await db.execute(sql.raw(`SELECT is_admin FROM users WHERE id = '${userId}' LIMIT 1`)));
    if (!adminCheck[0]?.is_admin) { res.status(403).json({ error: "Admin only" }); return; }

    const rows = toRows(await db.execute(sql.raw(`
      SELECT b.*, l.title as listing_title, l.category,
             uc.name as customer_name, up.name as provider_name,
             ROUND(b.total_amount * 0.15, 2) as expected_commission
      FROM bookings b
      LEFT JOIN listings l ON l.id = b.listing_id
      LEFT JOIN users uc ON uc.id = b.customer_id
      LEFT JOIN users up ON up.id = b.provider_id
      WHERE b.booking_date >= CURRENT_DATE AND b.status NOT IN ('cancelled', 'completed')
      ORDER BY b.booking_date ASC
      LIMIT 100
    `)));

    res.json({
      bookings: rows.map(b => ({
        id: b.id, listingTitle: b.listing_title, category: b.category,
        customerName: b.customer_name, providerName: b.provider_name,
        bookingDate: b.booking_date, status: b.status,
        totalAmount: Number(b.total_amount), expectedCommission: Number(b.expected_commission || 0),
        createdAt: b.created_at,
      })),
      totalExpectedCommission: rows.reduce((s, b) => s + Number(b.expected_commission || 0), 0),
    });
  } catch (err) {
    req.log.error({ err }, "Admin upcoming bookings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /wallet/admin/refund — issue refund to customer or provider ─────────
router.post("/admin/refund", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const adminCheck = toRows(await db.execute(sql.raw(`SELECT is_admin FROM users WHERE id = '${userId}' LIMIT 1`)));
    if (!adminCheck[0]?.is_admin) { res.status(403).json({ error: "Admin only" }); return; }

    const { targetUserId, bookingId, amount, reason } = req.body;
    const amt = Number(amount);
    if (!targetUserId || amt <= 0) { res.status(400).json({ error: "targetUserId and amount > 0 required" }); return; }

    const targetUser = toRows(await db.execute(sql.raw(`SELECT id, name, wallet_balance FROM users WHERE id = '${targetUserId}' LIMIT 1`)));
    if (!targetUser.length) { res.status(404).json({ error: "User not found" }); return; }

    const walletRow = toRows(await db.execute(sql.raw(`
      UPDATE users SET wallet_balance = wallet_balance + ${amt}
      WHERE id = '${targetUserId}' RETURNING wallet_balance
    `)));
    const newBalance = Number(walletRow[0]?.wallet_balance || 0);

    const txId = `rfnd${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
    const safeReason = (reason || "Admin refund").replace(/'/g, "''");
    await db.execute(sql.raw(`
      INSERT INTO wallet_transactions
        (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
      VALUES (
        '${txId}', '${targetUserId}', 'refund', ${amt}, ${newBalance},
        '${bookingId || txId}', 'refund', '${safeReason}', 'completed'
      )
    `));

    if (bookingId) {
      await db.execute(sql.raw(`
        UPDATE bookings SET payment_status = 'refunded' WHERE id = '${bookingId}'
      `));
    }

    res.json({ success: true, txId, newBalance, refundedTo: targetUser[0].name, amount: amt });
  } catch (err) {
    req.log.error({ err }, "Admin refund error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /wallet/admin/payment-methods — get platform payment methods ─────────
router.get("/admin/payment-methods", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const adminCheck = toRows(await db.execute(sql.raw(`SELECT is_admin FROM users WHERE id = '${userId}' LIMIT 1`)));
    if (!adminCheck[0]?.is_admin) { res.status(403).json({ error: "Admin only" }); return; }

    const rows = toRows(await db.execute(sql.raw(`SELECT * FROM platform_payment_methods ORDER BY created_at DESC`)));
    res.json({ methods: rows.map(m => ({ id: m.id, type: m.type, label: m.label, details: JSON.parse(m.details || "{}"), isActive: m.is_active, createdAt: m.created_at })) });
  } catch (err) {
    req.log.error({ err }, "Admin payment methods get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /wallet/admin/payment-methods — add/update platform payment method ──
router.post("/admin/payment-methods", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const adminCheck = toRows(await db.execute(sql.raw(`SELECT is_admin FROM users WHERE id = '${userId}' LIMIT 1`)));
    if (!adminCheck[0]?.is_admin) { res.status(403).json({ error: "Admin only" }); return; }

    const { type, label, details } = req.body;
    if (!type || !label) { res.status(400).json({ error: "type and label required" }); return; }
    const id = `pm${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
    const safeLabel = String(label).replace(/'/g, "''");
    const safeDetails = JSON.stringify(details || {}).replace(/'/g, "''");

    await db.execute(sql.raw(`
      INSERT INTO platform_payment_methods (id, type, label, details)
      VALUES ('${id}', '${type}', '${safeLabel}', '${safeDetails}')
    `));
    res.json({ success: true, id });
  } catch (err) {
    req.log.error({ err }, "Admin payment methods post error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /wallet/admin/payment-methods/:id — remove payment method ─────────
router.delete("/admin/payment-methods/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const adminCheck = toRows(await db.execute(sql.raw(`SELECT is_admin FROM users WHERE id = '${userId}' LIMIT 1`)));
    if (!adminCheck[0]?.is_admin) { res.status(403).json({ error: "Admin only" }); return; }
    await db.execute(sql.raw(`DELETE FROM platform_payment_methods WHERE id = '${req.params.id}'`));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /wallet/admin/summary — admin commission overview ──────────────────
router.get("/admin/summary", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const adminCheck = toRows(await db.execute(sql.raw(`SELECT is_admin FROM users WHERE id = '${userId}' LIMIT 1`)));
    if (!adminCheck[0]?.is_admin) { res.status(403).json({ error: "Admin only" }); return; }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [totalCommission, monthCommission, totalPayouts, pendingPayouts, topProviders,
           spinRevenue, monthSpinRevenue] = await Promise.all([
      db.execute(sql.raw(`SELECT COALESCE(SUM(commission_amount), 0) as total FROM bookings WHERE status = 'completed'`)),
      db.execute(sql.raw(`SELECT COALESCE(SUM(commission_amount), 0) as total FROM bookings WHERE status = 'completed' AND created_at >= '${monthStart}'`)),
      db.execute(sql.raw(`SELECT COALESCE(SUM(amount), 0) as total FROM payouts WHERE status IN ('completed', 'processing')`)),
      db.execute(sql.raw(`SELECT COALESCE(SUM(amount), 0) as total FROM payouts WHERE status = 'pending'`)),
      db.execute(sql.raw(`
        SELECT u.name, u.email, COALESCE(SUM(b.provider_earning), 0) as earnings,
               COALESCE(SUM(b.commission_amount), 0) as commission_paid,
               COUNT(b.id) as completed_jobs
        FROM users u JOIN bookings b ON b.provider_id = u.id
        WHERE b.status = 'completed'
        GROUP BY u.id, u.name, u.email
        ORDER BY earnings DESC LIMIT 10
      `)),
      db.execute(sql.raw(`SELECT COALESCE(SUM(payment_amount), 0) as total FROM wheel_spins WHERE spin_type = 'paid'`)),
      db.execute(sql.raw(`SELECT COALESCE(SUM(payment_amount), 0) as total FROM wheel_spins WHERE spin_type = 'paid' AND created_at >= '${monthStart}'`)),
    ]);

    res.json({
      totalCommission: Number(toRows(totalCommission)[0]?.total || 0),
      monthCommission: Number(toRows(monthCommission)[0]?.total || 0),
      totalPayouts: Number(toRows(totalPayouts)[0]?.total || 0),
      pendingPayouts: Number(toRows(pendingPayouts)[0]?.total || 0),
      spinRevenue: Number(toRows(spinRevenue)[0]?.total || 0),
      monthSpinRevenue: Number(toRows(monthSpinRevenue)[0]?.total || 0),
      topProviders: toRows(topProviders).map(p => ({
        name: p.name,
        email: p.email,
        earnings: Number(p.earnings),
        commissionPaid: Number(p.commission_paid),
        completedJobs: Number(p.completed_jobs),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Admin wallet summary error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /wallet/admin/trigger-weekly-payouts — admin trigger for Monday payouts ──
router.post("/admin/trigger-weekly-payouts", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const adminCheck = toRows(await db.execute(sql.raw(`SELECT is_admin FROM users WHERE id = '${userId}' LIMIT 1`)));
    if (!adminCheck[0]?.is_admin) { res.status(403).json({ error: "Admin only" }); return; }

    res.status(503).json({ error: "Bank payouts are not connected yet. No wallet balances were changed." });
  } catch (err) {
    req.log.error({ err }, "Admin trigger weekly payouts error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /wallet/admin/payouts — list all provider payouts ──────────────────
router.get("/admin/payouts", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AR).userId;
    const adminCheck = toRows(await db.execute(sql.raw(`SELECT is_admin FROM users WHERE id = '${userId}' LIMIT 1`)));
    if (!adminCheck[0]?.is_admin) { res.status(403).json({ error: "Admin only" }); return; }

    const page   = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit  = 50;
    const offset = (page - 1) * limit;
    const status = String(req.query.status || "");
    let where = "1=1";
    if (status) where += ` AND p.status = '${status}'`;

    const rows = toRows(await db.execute(sql.raw(`
      SELECT p.*, u.name as provider_name, u.email as provider_email
      FROM payouts p
      JOIN users u ON u.id = p.provider_id
      WHERE ${where}
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `)));

    res.json({
      payouts: rows.map(p => ({
        id: p.id, providerName: p.provider_name, providerEmail: p.provider_email,
        amount: Number(p.amount), fee: Number(p.fee || 0), method: p.method,
        maskedDisplay: p.masked_display, upiId: p.upi_id, status: p.status,
        scheduledAt: p.scheduled_at, processedAt: p.processed_at,
        notes: p.notes, createdAt: p.created_at,
      })),
      page,
    });
  } catch (err) {
    req.log.error({ err }, "Admin payouts list error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
