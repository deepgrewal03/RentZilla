import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

function toRows<T = any>(r: any): T[] { return Array.isArray(r) ? r : (r?.rows ?? []); }

export interface FraudFactor {
  code: string;
  label: string;
  points: number;
  severity: "info" | "warn" | "danger" | "critical";
}

export interface FraudScore {
  userId: string;
  score: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskColor: string;
  riskEmoji: string;
  factors: FraudFactor[];
  computedAt: string;
}

export function riskMeta(score: number): { level: "low"|"medium"|"high"|"critical"; color: string; emoji: string } {
  if (score >= 70) return { level: "critical", color: "#DC2626", emoji: "🔴" };
  if (score >= 45) return { level: "high",     color: "#F97316", emoji: "🔶" };
  if (score >= 20) return { level: "medium",   color: "#EAB308", emoji: "🟡" };
  return               { level: "low",      color: "#22C55E", emoji: "🟢" };
}

export async function computeFraudScore(userId: string): Promise<FraudScore> {
  const factors: FraudFactor[] = [];
  let score = 0;

  try {
    // 1. Fetch user basics
    const userRows = toRows(await db.execute(sql.raw(`
      SELECT u.*,
        (SELECT COUNT(*) FROM bookings WHERE customer_id = '${userId}' OR provider_id = '${userId}') AS total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE (customer_id = '${userId}' OR provider_id = '${userId}') AND status = 'cancelled') AS cancelled_bookings,
        (SELECT COUNT(*) FROM bookings WHERE (customer_id = '${userId}' OR provider_id = '${userId}') AND status = 'completed') AS completed_bookings,
        (SELECT COUNT(*) FROM reports WHERE reported_user_id = '${userId}') AS report_count,
        (SELECT COUNT(*) FROM bookings WHERE (customer_id = '${userId}' OR provider_id = '${userId}') AND fraud_hold = true) AS fraud_holds,
        (SELECT COUNT(*) FROM razorpay_orders WHERE user_id = '${userId}' AND status = 'failed') AS failed_payments,
        (EXTRACT(EPOCH FROM NOW() - created_at) / 86400)::int AS account_age_days
      FROM users u WHERE u.id = '${userId}' LIMIT 1
    `)));
    const user = userRows[0];
    if (!user) return { userId, score: 0, riskLevel: "low", riskColor: "#22C55E", riskEmoji: "🟢", factors: [], computedAt: new Date().toISOString() };

    const totalBookings = Number(user.total_bookings ?? 0);
    const cancelledBookings = Number(user.cancelled_bookings ?? 0);
    const completedBookings = Number(user.completed_bookings ?? 0);
    const reportCount = Number(user.report_count ?? 0);
    const fraudHolds = Number(user.fraud_holds ?? 0);
    const failedPayments = Number(user.failed_payments ?? 0);
    const accountAgeDays = Number(user.account_age_days ?? 0);
    const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;

    // 2. Safety reports
    if (reportCount >= 3) {
      factors.push({ code: "HIGH_REPORTS", label: `${reportCount} safety reports filed against user`, points: 40, severity: "critical" });
      score += 40;
    } else if (reportCount === 2) {
      factors.push({ code: "MULTIPLE_REPORTS", label: "2 safety reports filed against user", points: 25, severity: "danger" });
      score += 25;
    } else if (reportCount === 1) {
      factors.push({ code: "ONE_REPORT", label: "1 safety report filed", points: 12, severity: "warn" });
      score += 12;
    }

    // 3. Fraud holds
    if (fraudHolds > 0) {
      factors.push({ code: "FRAUD_HOLD", label: `${fraudHolds} booking(s) flagged for fraud hold`, points: 30, severity: "critical" });
      score += 30;
    }

    // 4. Cancellation rate
    if (totalBookings >= 3 && cancellationRate >= 60) {
      factors.push({ code: "VERY_HIGH_CANCEL", label: `${Math.round(cancellationRate)}% cancellation rate (${cancelledBookings}/${totalBookings})`, points: 20, severity: "danger" });
      score += 20;
    } else if (totalBookings >= 3 && cancellationRate >= 30) {
      factors.push({ code: "HIGH_CANCEL", label: `${Math.round(cancellationRate)}% cancellation rate (${cancelledBookings}/${totalBookings})`, points: 12, severity: "warn" });
      score += 12;
    }

    // 5. Failed payments
    if (failedPayments >= 3) {
      factors.push({ code: "PAYMENT_FAILURES", label: `${failedPayments} failed payment attempts`, points: 15, severity: "danger" });
      score += 15;
    } else if (failedPayments >= 1) {
      factors.push({ code: "PAYMENT_FAILURE", label: `${failedPayments} failed payment attempt(s)`, points: 8, severity: "warn" });
      score += 8;
    }

    // 6. New account with activity
    if (accountAgeDays < 3) {
      factors.push({ code: "VERY_NEW_ACCOUNT", label: `Account created ${accountAgeDays} day(s) ago`, points: 15, severity: "warn" });
      score += 15;
    } else if (accountAgeDays < 7) {
      factors.push({ code: "NEW_ACCOUNT", label: `Account less than 7 days old (${accountAgeDays} days)`, points: 8, severity: "info" });
      score += 8;
    }

    // 7. No verification on old account
    const verRows = toRows(await db.execute(sql.raw(`SELECT * FROM user_verification WHERE user_id = '${userId}' LIMIT 1`)));
    const ver = verRows[0];
    const idVerified = ver?.id_status === "approved";
    const selfieVerified = ver?.selfie_status === "approved";

    if (accountAgeDays > 30 && !idVerified && !selfieVerified) {
      factors.push({ code: "UNVERIFIED_OLD", label: "Account >30 days old with no identity verification", points: 15, severity: "warn" });
      score += 15;
    }

    // 8. Suspended account
    if (user.is_suspended) {
      factors.push({ code: "SUSPENDED", label: "Account is currently suspended", points: 35, severity: "critical" });
      score += 35;
    }

    // 9. Positive factors (reduce score)
    if (idVerified) {
      factors.push({ code: "ID_VERIFIED", label: "Government ID verified ✓", points: -15, severity: "info" });
      score = Math.max(0, score - 15);
    }
    if (selfieVerified) {
      factors.push({ code: "SELFIE_VERIFIED", label: "Selfie verified ✓", points: -8, severity: "info" });
      score = Math.max(0, score - 8);
    }
    if (user.is_gold_member) {
      factors.push({ code: "GOLD_MEMBER", label: "Gold member (paid subscriber) ✓", points: -5, severity: "info" });
      score = Math.max(0, score - 5);
    }
    if (completedBookings >= 10) {
      factors.push({ code: "MANY_COMPLETIONS", label: `${completedBookings} successfully completed bookings ✓`, points: -12, severity: "info" });
      score = Math.max(0, score - 12);
    } else if (completedBookings >= 5) {
      factors.push({ code: "SOME_COMPLETIONS", label: `${completedBookings} completed bookings ✓`, points: -8, severity: "info" });
      score = Math.max(0, score - 8);
    }

    score = Math.min(100, Math.max(0, score));
    const meta = riskMeta(score);

    // Cache result
    await db.execute(sql.raw(`
      INSERT INTO fraud_scores (user_id, score, risk_level, factors, computed_at)
      VALUES ('${userId}', ${score}, '${meta.level}', '${JSON.stringify(factors).replace(/'/g, "''")}', NOW())
      ON CONFLICT (user_id) DO UPDATE SET score=${score}, risk_level='${meta.level}',
        factors='${JSON.stringify(factors).replace(/'/g, "''")}', computed_at=NOW()
    `));

  } catch (err) {
    logger.error({ err, userId }, "computeFraudScore error");
  }

  const meta = riskMeta(score);
  return {
    userId, score,
    riskLevel: meta.level,
    riskColor: meta.color,
    riskEmoji: meta.emoji,
    factors,
    computedAt: new Date().toISOString(),
  };
}
