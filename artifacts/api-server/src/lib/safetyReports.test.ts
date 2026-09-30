import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";

test("report validation and durable submission rules", { skip: !process.env.DATABASE_URL }, async (t) => {
  const { createSafetyReport, parseReport, ReportError } = await import("./safetyReports.js");
  const { db, pool, reportsTable, usersTable, listingsTable } = await import("@workspace/db");
  const { eq, inArray, sql } = await import("drizzle-orm");
  const reporter = randomUUID();
  const provider = randomUUID();
  const customer = randomUUID();
  const listingIds = Array.from({ length: 8 }, () => randomUUID());
  const users = [reporter, provider, customer];
  const rejects = (status: number) => (err: unknown) => err instanceof ReportError && err.status === status;
  try {
    await t.test("report route rejects unsigned/forged identity but accepts real login tokens", async () => {
      const { generateToken } = await import("../routes/auth.js");
      const { signedAuthMiddleware } = await import("../routes/users.js");
      const { default: safetyRouter } = await import("../routes/safety.js");
      // Verify the actual POST route is guarded, not just an unused helper.
      const route = safetyRouter.stack.find((layer: any) => layer.route?.path === "/reports")?.route;
      assert.ok(route);
      assert.equal(route.stack[0].handle, signedAuthMiddleware);
      const validToken = generateToken(reporter);
      const [payload, signature] = validToken.split(".");
      const victimPayload = Buffer.from(`${provider}:${Date.now()}`).toString("base64");
      const attempt = (authorization?: string) => {
        const req = { headers: { authorization } } as Request & { userId?: string };
        let status = 200;
        let nextCalled = false;
        const res = {
          status(code: number) { status = code; return this; },
          json() { return this; },
        } as unknown as Response;
        signedAuthMiddleware(req, res, () => { nextCalled = true; });
        return { status, nextCalled, userId: req.userId };
      };
      for (const authorization of [
        undefined, "", `Basic ${validToken}`, `Bearer ${payload}`,
        `Bearer ${victimPayload}`, `Bearer ${victimPayload}.${signature}`,
        `Bearer ${payload}.${signature === "0000000000000000" ? "1111111111111111" : "0000000000000000"}`,
        `Bearer ${payload}.`, `Bearer ${payload}.invalid`, `Bearer ${validToken}.extra`,
      ]) {
        assert.deepEqual(attempt(authorization), { status: 401, nextCalled: false, userId: undefined });
      }
      assert.deepEqual(attempt(`Bearer ${validToken}`), { status: 200, nextCalled: true, userId: reporter });
    });
    await t.test("strict inputs and legacy compatibility", () => {
      assert.equal(parseReport({ reportedUserId: provider, reason: "spam" }).targetType, "user");
      for (const reason of ["spam", "fraud", "abuse", "fake_listing", "other"]) {
        assert.equal(parseReport({ targetType: "listing", targetId: listingIds[0], reason }).reason, reason);
      }
      for (const body of [
        null, {}, { targetType: "invalid", targetId: provider, reason: "spam" },
        { targetType: "provider", reason: "spam" },
        { reportedUserId: provider, reason: "invalid" },
        { reportedUserId: provider, reason: "spam", description: 123 },
        { reportedUserId: provider, reason: "spam", description: "x".repeat(2001) },
        { targetType: "listing", targetId: listingIds[0], reportedUserId: provider, reason: "spam" },
      ]) assert.throws(() => parseReport(body), rejects(400));
      assert.equal(parseReport({ reportedUserId: provider, reason: "other", description: "x".repeat(2000) }).description?.length, 2000);
    });
    await db.insert(usersTable).values(users.map((id) => ({
      id, phone: `test-report-${id}`, name: id === provider ? "Safety test provider" : "Safety test customer",
      role: id === provider ? "provider" as const : "customer" as const,
    })));
    await db.insert(listingsTable).values(listingIds.map((id, index) => ({
      id, providerId: provider, category: "equipment" as const, title: `Safety test listing ${index}`,
      price: 10, location: "Test",
    })));
    const body = (targetType: string, targetId: string) => ({ targetType, targetId, reason: "fraud" });
    await t.test("missing targets, nonproviders and self reports rejected", async () => {
      for (const type of ["listing", "provider", "user"]) {
        await assert.rejects(createSafetyReport(reporter, body(type, randomUUID())), rejects(404));
      }
      await assert.rejects(createSafetyReport(reporter, body("provider", customer)), rejects(404));
      await assert.rejects(createSafetyReport(reporter, body("user", reporter)), rejects(400));
      await assert.rejects(createSafetyReport(provider, body("provider", provider)), rejects(400));
      await assert.rejects(createSafetyReport(provider, body("listing", listingIds[0])), rejects(400));
    });
    await t.test("concurrent duplicates create exactly one preserved listing target", async () => {
      const results = await Promise.allSettled(Array.from({ length: 8 }, () =>
        createSafetyReport(reporter, body("listing", listingIds[0]))));
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      for (const result of results) {
        if (result.status === "rejected") assert.ok(rejects(409)(result.reason));
        else {
          assert.equal(result.value.targetType, "listing");
          assert.equal(result.value.targetId, listingIds[0]);
          assert.equal(result.value.targetName, "Safety test listing 0");
          assert.equal(result.value.reportedUserId, provider);
        }
      }
    });
    await t.test("provider and legacy user targets stay distinct and retain names", async () => {
      const report = await createSafetyReport(reporter, body("provider", provider));
      assert.equal(report.targetName, "Safety test provider");
      const legacy = await createSafetyReport(reporter, { reportedUserId: provider, reason: "abuse" });
      assert.equal(legacy.targetId, provider);
      assert.equal(legacy.targetType, "user");
    });
    await t.test("rolling hourly quota is atomic under concurrent different targets", async () => {
      const results = await Promise.allSettled(listingIds.slice(1).map((id) =>
        createSafetyReport(reporter, body("listing", id))));
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
      for (const result of results) if (result.status === "rejected") assert.ok(rejects(429)(result.reason));
      // Quota persists in DB, while duplicates still return a clear 409.
      await assert.rejects(createSafetyReport(reporter, body("listing", listingIds[0])), rejects(409));
    });
    await t.test("daily quota includes reports older than one hour", async () => {
      await db.update(reportsTable).set({ createdAt: new Date(Date.now() - 2 * 3600000) })
        .where(eq(reportsTable.reporterId, reporter));
      await db.insert(reportsTable).values(Array.from({ length: 15 }, () => ({
        id: randomUUID(), reporterId: reporter, reportedUserId: provider,
        targetType: "user", targetId: randomUUID(), reason: "other",
        createdAt: new Date(Date.now() - 2 * 3600000),
      })));
      await assert.rejects(createSafetyReport(reporter, body("user", customer)), rejects(429));
      await db.execute(sql`UPDATE reports SET created_at = NOW() - INTERVAL '25 hours' WHERE reporter_id = ${reporter}`);
      assert.equal((await createSafetyReport(reporter, body("user", customer))).targetId, customer);
    });
  } finally {
    await db.delete(reportsTable).where(inArray(reportsTable.reporterId, users));
    await db.delete(listingsTable).where(inArray(listingsTable.id, listingIds));
    await db.delete(usersTable).where(inArray(usersTable.id, users));
    await pool.end();
  }
});