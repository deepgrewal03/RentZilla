/**
 * Provider Payout Scheduler
 *
 * Runs every 5 minutes. On Monday 9 AM IST (UTC+5:30 = 03:30 UTC),
 * it auto-processes payouts for all providers who have:
 *   - payout_preference = 'weekly'
 *   - wallet_balance > 0
 *   - a default payment method saved
 *
 * For providers without a saved method it keeps money in the wallet.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

function toRows(res: any): any[] {
  return Array.isArray(res) ? res : (res?.rows ?? []);
}

function newId(): string {
  return `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

/** Returns true if right now is Monday between 03:25–03:35 UTC (= 09:00 IST ±5 min) */
function isMonday9amIST(): boolean {
  const now = new Date();
  const dayUTC  = now.getUTCDay();
  const hourUTC = now.getUTCHours();
  const minUTC  = now.getUTCMinutes();
  return dayUTC === 1 && hourUTC === 3 && minUTC >= 25 && minUTC <= 35;
}

let lastRun: string | null = null;

export async function runWeeklyPayouts(): Promise<void> {
  const todayKey = new Date().toISOString().slice(0, 10);
  if (lastRun === todayKey) return;
  if (!isMonday9amIST()) return;

  lastRun = todayKey;
  logger.info("Weekly payout scheduler started");

  try {
    const providers = toRows(await db.execute(sql.raw(
      `SELECT u.id, u.name, u.wallet_balance,
              pm.id             AS pm_id,
              pm.type           AS pm_type,
              pm.label          AS pm_label,
              pm.masked_display AS pm_masked
       FROM users u
       JOIN user_payment_methods pm ON pm.user_id = u.id AND pm.is_default = TRUE
       WHERE u.payout_preference = 'weekly'
         AND u.wallet_balance > 0`
    )));

    logger.info(`Found ${providers.length} providers eligible for weekly payout`);

    for (const p of providers) {
      const balance = Number(p.wallet_balance);
      if (balance <= 0) continue;

      const payoutId  = newId();
      const txId      = newId();
      const safeNotes = `Auto weekly payout to ${p.pm_label || p.pm_type} ${p.pm_masked || ""}`.replace(/'/g, "''");
      const safeMask  = (p.pm_masked || "").replace(/'/g, "''");

      try {
        const updated = toRows(await db.execute(sql.raw(
          `UPDATE users SET wallet_balance = 0
           WHERE id = '${p.id}' AND wallet_balance > 0
           RETURNING wallet_balance`
        )));
        if (!updated.length) continue;

        await db.execute(sql.raw(
          `INSERT INTO payouts
             (id, provider_id, amount, fee, method, payment_method_id, masked_display, status, scheduled_at, processed_at, notes)
           VALUES (
             '${payoutId}', '${p.id}', ${balance}, 0, 'weekly',
             '${p.pm_id}', '${safeMask}', 'processing', NOW(), NOW(), '${safeNotes}'
           )`
        ));

        await db.execute(sql.raw(
          `INSERT INTO wallet_transactions
             (id, user_id, type, amount, balance_after, reference_id, reference_type, description, status)
           VALUES (
             '${txId}', '${p.id}', 'payout', ${balance}, 0,
             '${payoutId}', 'payout', '${safeNotes}', 'completed'
           )`
        ));

        logger.info({ providerId: p.id, amount: balance, method: p.pm_type }, "Weekly payout processed");
      } catch (err) {
        logger.error({ err, providerId: p.id }, "Failed to process weekly payout for provider");
      }
    }

    logger.info("Weekly payout scheduler finished");
  } catch (err) {
    logger.error({ err }, "Weekly payout scheduler error");
  }
}

/** Start the scheduler — call once on server boot */
export function startPayoutScheduler(): void {
  logger.info("Payout scheduler registered (checks every 5 min)");
  setInterval(() => {
    runWeeklyPayouts().catch(err =>
      logger.error({ err }, "Payout scheduler unhandled error")
    );
  }, 5 * 60 * 1000);
}
