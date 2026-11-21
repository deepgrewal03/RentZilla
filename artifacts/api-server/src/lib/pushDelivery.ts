import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { pushCategory, pushTarget, retryDelay } from "./pushPolicy.js";

// Existing inbox events remain authoritative. Catch-up after restarts is bounded
// to one day and never replays notifications from before device registration.
export async function enqueuePushDeliveries() {
  await db.execute(sql`
    INSERT INTO push_deliveries (id, device_id, user_id, source_id, title, body, category, data)
    SELECT 'n:' || n.id || ':' || d.id, d.id, d.user_id, 'n:' || n.id,
      n.title, n.message,
      CASE WHEN n.category <> 'account' THEN n.category
        WHEN n.title ~* '(promo|offer|referral|discount|reward)' THEN 'offers'
        WHEN n.title ~* '(payment|paid|refund|wallet)' THEN 'payments'
        WHEN n.title ~* '(booking)' THEN 'bookings'
        WHEN n.title ~* '(rental|listing)' THEN 'rentals'
        ELSE 'account' END,
      jsonb_build_object('userId', n.user_id, 'notificationId', n.id, 'targetType', n.target_type, 'targetId', n.target_id)
    FROM notifications n JOIN push_devices d ON d.user_id = n.user_id
    WHERE n.created_at >= NOW() - INTERVAL '1 day'
      AND n.created_at >= d.registered_at AND d.refreshed_at >= NOW() - INTERVAL '30 days'
    ON CONFLICT (source_id, device_id) DO NOTHING
  `);
  // Existing booking/payment state is read only; no changes to business logic.
  await db.execute(sql`
    INSERT INTO push_deliveries (id, device_id, user_id, source_id, title, body, category, data)
    SELECT 'b:' || b.id || ':' || d.id, d.id, d.user_id, 'b:' || b.id,
      'New booking request', 'You have a new booking request in RentZilla.', 'bookings',
      jsonb_build_object('userId', d.user_id, 'targetType', 'booking', 'targetId', b.id)
    FROM bookings b JOIN push_devices d ON d.user_id = b.provider_id
    WHERE b.created_at >= NOW() - INTERVAL '1 day' AND b.created_at >= d.registered_at
      AND b.status = 'pending' AND d.refreshed_at >= NOW() - INTERVAL '30 days'
    ON CONFLICT (source_id, device_id) DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO push_deliveries (id, device_id, user_id, source_id, title, body, category, data)
    SELECT 'p:' || o.id || ':' || d.id, d.id, d.user_id, 'p:' || o.id,
      'Payment received', 'Your RentZilla payment has been received.', 'payments',
      jsonb_build_object('userId', d.user_id, 'targetType', CASE WHEN o.booking_id IS NOT NULL THEN 'booking' ELSE NULL END, 'targetId', o.booking_id)
    FROM razorpay_orders o JOIN push_devices d ON d.user_id = o.user_id
    WHERE o.fulfilled_at >= NOW() - INTERVAL '1 day' AND o.fulfilled_at >= d.registered_at
      AND o.status = 'paid' AND d.refreshed_at >= NOW() - INTERVAL '30 days'
    ON CONFLICT (source_id, device_id) DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO push_deliveries (id, device_id, user_id, source_id, title, body, category, data)
    SELECT 'm:' || m.id || ':' || d.id, d.id, d.user_id, 'm:' || m.id,
      'New message', 'You have a new message in RentZilla.', 'messages',
      jsonb_build_object('userId', d.user_id, 'targetType', 'chat', 'targetId', m.chat_id)
    FROM messages m JOIN chats c ON c.id = m.chat_id
      JOIN push_devices d ON c.participants @> jsonb_build_array(d.user_id)
    WHERE m.sender_id <> d.user_id AND c.participants @> jsonb_build_array(m.sender_id)
      AND m.created_at >= NOW() - INTERVAL '1 day'
      AND m.created_at >= d.registered_at AND d.refreshed_at >= NOW() - INTERVAL '30 days'
    ON CONFLICT (source_id, device_id) DO NOTHING
  `);
}

async function expoRequest(path: string, body: unknown) {
  const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json",
      ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Push service HTTP ${response.status}`);
  const result = (await response.json()) as { data?: any; errors?: any[] };
  if (!result.data || result.errors?.length) throw new Error("Push service rejected request");
  return result.data;
}

async function finish(row: any, status: string, ticketId: string | null = null, delay = 0) {
  // Claim version prevents a slow worker overwriting a newer claim.
  await db.execute(sql`UPDATE push_deliveries SET status = ${status}, ticket_id = ${ticketId},
    available_at = NOW() + (${delay} * INTERVAL '1 second')
    WHERE id = ${row.id} AND attempts = ${row.attempts}`);
}

export async function deliverPushBatch() {
  const claimed = await db.execute(sql`
    WITH ready AS (
      SELECT id FROM push_deliveries
      WHERE status IN ('pending', 'sending') AND available_at <= NOW() AND attempts < 6
      ORDER BY available_at LIMIT 50 FOR UPDATE SKIP LOCKED
    )
    UPDATE push_deliveries p SET status = 'sending', attempts = attempts + 1,
      available_at = NOW() + INTERVAL '2 minutes'
    FROM ready WHERE p.id = ready.id RETURNING p.*
  `);
  await Promise.all((claimed.rows as any[]).map(async row => {
    const devices = await db.execute(sql`SELECT expo_push_token FROM push_devices
      WHERE id = ${row.device_id} AND user_id = ${row.user_id} AND refreshed_at >= NOW() - INTERVAL '30 days'`);
    if (!devices.rows.length) { await finish(row, "cancelled"); return; }
    const token = devices.rows[0].expo_push_token;
    try {
      const [ticket] = await expoRequest("send", [{
        to: token, title: row.title.slice(0,100), body: row.body.slice(0,1000),
        sound: "default", channelId: pushCategory(row.category),
        // OS settings (including channel sound/importance) have final say.
        data: { userId: row.user_id, notificationId: row.data.notificationId,
          ...pushTarget(row.data.targetType, row.data.targetId) },
        ttl: 86400,
      }]);
      if (ticket?.status === "ok" && ticket.id) {
        await finish(row, "receipt", ticket.id, 900);
      } else if (ticket?.details?.error === "DeviceNotRegistered") {
        await db.execute(sql`DELETE FROM push_devices WHERE id = ${row.device_id}
          AND expo_push_token = ${token} AND user_id = ${row.user_id}`);
      } else {
        const retry = ticket?.details?.error === "MessageRateExceeded" && row.attempts < 6;
        await finish(row, retry ? "pending" : "failed", null, retryDelay(row.attempts));
        logger.warn({ code: ticket?.details?.error ?? "InvalidTicket" }, "Push ticket rejected");
      }
    } catch {
      await finish(row, row.attempts >= 6 ? "failed" : "pending", null, retryDelay(row.attempts));
      logger.warn("Push delivery failed; retry scheduled where eligible");
    }
  }));
}

export async function checkPushReceipts() {
  const rows = await db.execute(sql`
    WITH ready AS (SELECT id FROM push_deliveries WHERE status = 'receipt' AND available_at <= NOW()
      LIMIT 100 FOR UPDATE SKIP LOCKED)
    UPDATE push_deliveries p SET available_at = NOW() + INTERVAL '5 minutes'
      FROM ready WHERE p.id = ready.id RETURNING p.*
  `);
  if (!rows.rows.length) return;
  const receipts = await expoRequest("getReceipts", { ids: rows.rows.map(r => r.ticket_id) });
  for (const row of rows.rows as any[]) {
    const receipt = receipts[row.ticket_id];
    if (!receipt) {
      if (Date.now() - new Date(row.created_at).getTime() > 86400000) await finish(row, "failed");
      continue;
    }
    if (receipt.status === "ok") await finish(row, "delivered");
    else {
      // Do not revoke a newly refreshed/reassigned token based on an old receipt.
      if (receipt.details?.error === "DeviceNotRegistered") {
        await db.execute(sql`DELETE FROM push_devices WHERE id = ${row.device_id}
          AND user_id = ${row.user_id} AND refreshed_at <= ${row.created_at}`);
      }
      await finish(row, "failed");
      logger.warn({ code: receipt.details?.error ?? "UnknownReceiptError" }, "Push receipt failed");
    }
  }
}

let running = false;
export async function runPushDeliveryCycle() {
  if (running) return;
  running = true;
  try {
    await enqueuePushDeliveries();
    await deliverPushBatch();
    await checkPushReceipts();
    await db.execute(sql`UPDATE push_deliveries SET status = 'failed'
      WHERE status = 'sending' AND attempts >= 6 AND available_at < NOW()`);
    await db.execute(sql`DELETE FROM push_deliveries WHERE created_at < NOW() - INTERVAL '7 days'`);
  } catch {
    logger.error("Push worker unavailable; check notification schema and push service configuration");
  } finally { running = false; }
}
export function startPushDeliveryWorker() {
  void runPushDeliveryCycle();
  const timer = setInterval(() => void runPushDeliveryCycle(), 15000);
  timer.unref();
}
