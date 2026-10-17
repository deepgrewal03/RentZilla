import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { transformSync } from "esbuild";

// Exercise the real route with isolated database and Google boundaries.
// No network calls, credentials, or real accounts are used.
const source = readFileSync(new URL("../routes/auth.ts", import.meta.url), "utf8");
const compiled = transformSync(source, { loader: "ts", format: "cjs" }).code;
const localRequire = createRequire(import.meta.url);
const createdAt = new Date("2026-01-02T03:04:05Z");
const baseUser = {
  id: "social-test", phone: "test-only", email: "test@example.invalid",
  firstName: "Test", lastName: "User", name: "Test User",
  role: "customer", createdAt, profileComplete: false,
  photoUrl: "https://example.invalid/photo", location: null, profileImage: null,
};

async function signIn(selectResults: unknown[][], verified = true) {
  let selected = 0;
  let inserted = false;
  let updated = false;
  const db = {
    select: () => ({
      from: () => ({ where: () => ({
        limit: async () => {
          assert.ok(selected < selectResults.length, "unexpected account lookup");
          return selectResults[selected++];
        },
      }) }),
    }),
    insert: () => ({
      values: (values: object) => ({
        returning: async () => { inserted = true; return [{ ...baseUser, ...values }]; },
      }),
    }),
    update: () => ({
      set: (values: object) => ({
        where: () => ({
          returning: async () => { updated = true; return [{ ...baseUser, ...values }]; },
        }),
      }),
    }),
    execute: () => { throw new Error("Social sign-in must not return raw snake_case rows"); },
  };
  const module = { exports: {} as any };
  runInNewContext(compiled, {
    module, exports: module.exports, Buffer, console,
    process: { env: { JWT_SECRET: "isolated-test-only" } },
    require: (name: string) => {
      if (name === "@workspace/db") return { db };
      if (name === "@workspace/db/schema") return {
        usersTable: { id: "id", email: "email", googleId: "google_id", appleId: "apple_id" },
      };
      if (name === "../lib/email") return { sendOtpEmail: async () => {} };
      return localRequire(name);
    },
    fetch: async () => ({
      ok: verified,
      json: async () => ({
        sub: "test-google-id", email: baseUser.email, name: baseUser.name,
        picture: baseUser.photoUrl, email_verified: "true",
      }),
    }),
  });
  const handler = module.exports.default.stack
    .find((layer: any) => layer.route?.path === "/google").route.stack[0].handle;
  let status = 200;
  let body: any;
  const res = {
    status: (value: number) => { status = value; return res; },
    json: (value: unknown) => { body = value; return res; },
  };
  await handler({
    body: { id_token: "isolated-test-token" },
    log: { error: () => {} },
  }, res);
  return { status, body, inserted, updated };
}

test("repeat Google sign-in returns mapped dates, names, photo and incomplete profile", async () => {
  const result = await signIn([[baseUser]]);
  assert.equal(result.status, 200);
  assert.equal(result.body.user.createdAt, createdAt.toISOString());
  assert.equal(result.body.user.firstName, "Test");
  assert.equal(result.body.user.photo_url, baseUser.photoUrl);
  assert.equal(result.body.profile_complete, false);
  assert.equal(result.body.is_new_user, false);
  assert.equal(result.inserted, false);
});

test("email-linked Google account returns refreshed mapped user", async () => {
  const result = await signIn([[], [baseUser]]);
  assert.equal(result.status, 200);
  assert.equal(result.updated, true);
  assert.equal(result.body.profile_complete, false);
  assert.equal(result.body.user.createdAt, createdAt.toISOString());
});

test("new Google account requires profile completion", async () => {
  const result = await signIn([[], []]);
  assert.equal(result.status, 200);
  assert.equal(result.inserted, true);
  assert.equal(result.body.is_new_user, true);
  assert.equal(result.body.profile_complete, false);
});

test("repeat Google sign-in updates missing photo without losing mapped fields", async () => {
  const result = await signIn([[{ ...baseUser, photoUrl: null, profileComplete: true }]]);
  assert.equal(result.status, 200);
  assert.equal(result.updated, true);
  assert.equal(result.body.user.photo_url, baseUser.photoUrl);
});

test("invalid Google token never looks up or creates an account", async () => {
  const result = await signIn([], false);
  assert.equal(result.status, 401);
  assert.equal(result.inserted, false);
  assert.equal(result.updated, false);
});
