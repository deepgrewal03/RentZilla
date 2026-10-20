import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { transformSync } from "esbuild";

const requireLocal = createRequire(import.meta.url);
const code = transformSync(readFileSync(new URL("../routes/settings.ts", import.meta.url), "utf8"), {
  loader: "ts", format: "cjs",
}).code;

async function request(method: "get" | "patch", path: string, notifications?: unknown) {
  const settings = { notifications, privacy: { profileVisibility: "public", showPhone: true }, preferences: { darkMode: "system" } };
  let writes = 0;
  const module = { exports: {} as any };
  runInNewContext(code, {
    module, exports: module.exports, Date,
    require: (name: string) => {
      if (name === "@workspace/db") return { db: {
        select: () => ({ from: () => ({ where: () => ({ limit: async () => [settings] }) }) }),
        update: () => { writes++; throw new Error("Unexpected write"); },
      } };
      if (name === "@workspace/db/schema") return { usersTable: {}, userSettingsTable: { userId: "userId" } };
      if (name === "./users.js") return { authMiddleware: (_req: any, _res: any, next: any) => next() };
      return requireLocal(name);
    },
  });
  const route = module.exports.default.stack.find((l: any) => l.route?.path === path && l.route.methods[method]).route;
  let status = 200;
  let body: any;
  const res = { status: (n: number) => { status = n; return res; }, json: (data: any) => { body = data; } };
  await route.stack.at(-1).handle({ userId: "test", body: { messages: false }, log: { error: () => {} } }, res);
  return { status, body, writes };
}

test("older Settings screens can read every legacy notification field", async () => {
  for (const stored of [undefined, null, {}, { messages: false }]) {
    const { status, body, writes } = await request("get", "/", stored);
    assert.equal(status, 200);
    for (const key of ["bookingRequests", "bookingConfirmations", "messages", "paymentUpdates", "promotions"]) {
      assert.equal(typeof body.notifications[key], "boolean");
    }
    assert.equal(body.notifications.messages, stored && "messages" in stored ? stored.messages : true);
    assert.equal(body.notificationManagement, "device");
    assert.equal(body.privacy.profileVisibility, "public");
    assert.equal(body.preferences.darkMode, "system");
    assert.equal(writes, 0);
  }
});

test("legacy notification writes stay disabled and cannot change OS permission", async () => {
  const { status, writes } = await request("patch", "/notifications");
  assert.equal(status, 410);
  assert.equal(writes, 0);
});
