import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { transformSync } from "esbuild";
import { PgDialect } from "drizzle-orm/pg-core";
import * as policy from "./pushPolicy.js";

// Opt-in development DB test. Every row is rolled back; all Expo traffic is mocked.
test("push registration, delivery, receipts and logout are isolated by device/account", {
  skip: process.env.RUN_PUSH_DB_TESTS !== "1",
}, async () => {
  assert.notEqual(process.env.NODE_ENV, "production", "Never run against production");
  const { pool } = await import("@workspace/db");
  const client = await pool.connect();
  const dialect = new PgDialect();
  const execute = async (query: any) => {
    const q = dialect.sqlToQuery(query);
    return client.query(q.sql, q.params);
  };
  const db: any = { execute, transaction: async (work: any) => work(db) };
  const req = createRequire(import.meta.url);
  const sent: any[] = [];
  let mode = "ok";
  const load = (relative: string) => {
    const module = { exports: {} as any };
    runInNewContext(transformSync(readFileSync(new URL(relative, import.meta.url), "utf8"), { loader: "ts", format: "cjs" }).code, {
      module, exports: module.exports, process: { env: {} }, AbortSignal, setInterval,
      fetch: async (url: string, init: any) => {
        if (mode === "network") throw new Error("test network failure");
        const body = JSON.parse(init.body);
        if (url.endsWith("/send")) {
          sent.push(...body);
          return { ok: true, json: async () => ({ data: body.map(() => mode === "invalid"
            ? { status: "error", details: { error: "DeviceNotRegistered" } }
            : { status: "ok", id: "test-ticket" }) }) };
        }
        return { ok: true, json: async () => ({ data: Object.fromEntries(body.ids.map((id: string) =>
          [id, { status: "ok" }])) }) };
      },
      require: (name: string) => {
        if (name === "@workspace/db") return { db };
        if (name.includes("pushPolicy")) return policy;
        if (name.includes("logger")) return { logger: { warn() {}, error() {} } };
        if (name === "./users.js") return { authMiddleware: (_req: any, _res: any, next: any) => next() };
        return req(name);
      },
    });
    return module.exports;
  };
  const routes = load("../routes/pushDevices.ts").default;
  const worker = load("./pushDelivery.ts");
  const invoke = async (method: string, userId: string, body: unknown) => {
    const route = routes.stack.find((layer: any) => layer.route?.path === "/device" && layer.route.methods[method]).route;
    const handler = route.stack.at(-1).handle;
    let status = 200;
    const res = { status(n: number) { status = n; return res; }, end() {}, json() {} };
    await handler({ userId, body, log: { error() {} } }, res);
    return status;
  };
  const a = `push-test-a-${randomUUID()}`, b = `push-test-b-${randomUUID()}`;
  const device = randomUUID();
  const data = { installationId: device, secret: "a".repeat(64), platform: "android", expoPushToken: "ExponentPushToken[isolated-test]" };
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO users(id, phone, name) VALUES ($1,$1,'Push Test'),($2,$2,'Push Test')", [a, b]);
    assert.equal(await invoke("put", a, { ...data, platform: "wrong" }), 400);
    assert.equal(await invoke("put", a, data), 204);
    assert.equal(await invoke("put", b, { ...data, secret: "b".repeat(64) }), 409);
    await client.query("UPDATE push_devices SET registered_at=NOW()-INTERVAL '1 hour' WHERE id=$1", [device]);
    await client.query(`INSERT INTO notifications(id,user_id,title,message,category,target_type,target_id,created_at)
      VALUES($1,$2,'Booking accepted','Booking update','bookings','booking','safe-booking',NOW()),
      ($3,$2,'Old event','Do not replay','account',NULL,NULL,NOW()-INTERVAL '2 hours')`, [`${a}-new`, a, `${a}-old`]);
    await worker.enqueuePushDeliveries();
    await worker.enqueuePushDeliveries();
    let rows = (await client.query("SELECT * FROM push_deliveries WHERE device_id=$1", [device])).rows;
    assert.equal(rows.length, 1, "no history replay or duplicate deliveries");
    await worker.deliverPushBatch();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].data.userId, a);
    assert.equal(sent[0].data.targetId, "safe-booking");
    assert.equal(sent[0].channelId, "bookings");
    await client.query("UPDATE push_deliveries SET available_at=NOW()-INTERVAL '1 minute' WHERE device_id=$1", [device]);
    await worker.checkPushReceipts();
    assert.equal((await client.query("SELECT status FROM push_deliveries WHERE device_id=$1", [device])).rows[0].status, "delivered");
    assert.equal(await invoke("put", b, data), 204);
    assert.equal((await client.query("SELECT user_id FROM push_devices WHERE id=$1", [device])).rows[0].user_id, b);
    assert.equal((await client.query("SELECT id FROM push_deliveries WHERE device_id=$1", [device])).rows.length, 0);
    assert.equal(await invoke("delete", "", { ...data, secret: "b".repeat(64) }), 204);
    assert.equal((await client.query("SELECT id FROM push_devices WHERE id=$1", [device])).rows.length, 1);
    await client.query("UPDATE push_devices SET registered_at=NOW()-INTERVAL '1 hour' WHERE id=$1", [device]);
    await client.query("INSERT INTO notifications(id,user_id,title,message) VALUES($1,$2,'Test','Test')", [`${b}-new`, b]);
    await worker.enqueuePushDeliveries();
    mode = "network";
    await worker.deliverPushBatch();
    rows = (await client.query("SELECT status, attempts, available_at FROM push_deliveries WHERE device_id=$1", [device])).rows;
    assert.equal(rows[0].status, "pending");
    assert.equal(rows[0].attempts, 1);
    assert.ok(new Date(rows[0].available_at).getTime() > Date.now());
    mode = "invalid";
    await client.query("UPDATE push_deliveries SET available_at=NOW()-INTERVAL '1 minute' WHERE device_id=$1", [device]);
    await worker.deliverPushBatch();
    assert.equal((await client.query("SELECT id FROM push_devices WHERE id=$1", [device])).rows.length, 0);
    assert.equal(await invoke("put", b, data), 204);
    assert.equal(await invoke("delete", "", data), 204);
    assert.equal((await client.query("SELECT id FROM push_devices WHERE id=$1", [device])).rows.length, 0);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
