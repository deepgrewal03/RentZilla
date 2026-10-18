import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { transformSync } from "esbuild";

const requireLocal = createRequire(import.meta.url);
const code = transformSync(readFileSync(new URL("../routes/settings.ts", import.meta.url), "utf8"), {
  loader: "ts", format: "cjs",
}).code;

async function update(body: object) {
  const user = { id: "test", firstName: "Old", lastName: "Name", name: "Old Name", email: "test@example.invalid" };
  let written: any;
  const module = { exports: {} as any };
  runInNewContext(code, {
    module, exports: module.exports, Date,
    require: (name: string) => {
      if (name === "@workspace/db") return { db: {
        select: () => ({ from: () => ({ where: () => ({ limit: async () => [user] }) }) }),
        update: () => ({ set: (values: any) => ({ where: async () => {
          written = values; Object.assign(user, values);
        } }) }),
      } };
      if (name === "@workspace/db/schema") return { usersTable: { id: "id" }, userSettingsTable: {} };
      if (name === "./users.js") return { authMiddleware: (_req: any, _res: any, next: any) => next() };
      return requireLocal(name);
    },
  });
  const route = module.exports.default.stack.find((l: any) => l.route?.path === "/account" && l.route.methods.patch).route;
  let status = 200;
  let result: any;
  const res = { status: (n: number) => { status = n; return res; }, json: (data: any) => { result = data; } };
  await route.stack.at(-1).handle({ userId: "test", body, log: { error: () => {} } }, res);
  return { status, result, written };
}

test("account settings saves names without writing email or other account fields", async () => {
  const { status, result, written } = await update({ firstName: "New", lastName: "Person", role: "admin" });
  assert.equal(status, 200);
  assert.equal(result.name, "New Person");
  assert.equal(result.email, "test@example.invalid");
  assert.equal(written.email, undefined);
  assert.equal(written.role, undefined);
});

test("changed email is rejected without writing any account data", async () => {
  const result = await update({ firstName: "New", email: "other@example.invalid" });
  assert.equal(result.status, 400);
  assert.equal(result.written, undefined);
});

test("older clients can send unchanged email while saving a name", async () => {
  const result = await update({ firstName: "New", email: "test@example.invalid" });
  assert.equal(result.status, 200);
  assert.equal(result.result.name, "New Name");
  assert.equal(result.written.email, undefined);
});

test("both settings screens expose static email and omit removed controls", () => {
  for (const path of ["../../../mobile/app/settings.tsx", "../../../mobile/app/(tabs)/settings.tsx"]) {
    const text = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(text, /label="(?:Login Activity|Currency|Data Saver)"/);
    assert.doesNotMatch(text, /setEmail|firstName, lastName, email\s*[}]/);
    assert.match(text, /label="Email"[^\n]*chevron=\{false\}/);
    assert.match(text, /label="Edit Name"/);
  }
});
