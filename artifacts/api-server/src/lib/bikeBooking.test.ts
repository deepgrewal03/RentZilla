import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { transformSync } from "esbuild";
import * as rideVehicles from "./rideVehicles.js";

const requireLocal = createRequire(import.meta.url);
const code = transformSync(readFileSync(new URL("../routes/ridesRoute.ts", import.meta.url), "utf8"), { loader: "ts", format: "cjs" }).code;
async function book(vehicleType: string, routeFails = false, pricing: any[] = []) {
  const writes: string[] = [];
  const module = { exports: {} as any };
  runInNewContext(code, {
    module, exports: module.exports, Date, Math,
    require: (name: string) => {
      if (name === "@workspace/db") return { db: { execute: async (query: any) => {
        if (typeof query === "string" && query.includes("INSERT INTO rides")) {
          writes.push(query); return { rows: [{ vehicle_type: vehicleType }] };
        }
        return { rows: pricing };
      } } };
      if (name === "@workspace/db/schema") return { usersTable: {} };
      if (name === "./users.js") return { authMiddleware: () => {} };
      if (name === "../lib/rideVehicles.js") return rideVehicles;
      if (name === "../lib/roadRoute.js") return { roadRoute: async () => {
        if (routeFails) throw new Error("Route unavailable");
        return { distanceKm: 5, durationMin: 12 };
      } };
      return requireLocal(name);
    },
  });
  const route = module.exports.default.stack.find((l: any) => l.route?.path === "/request").route;
  let status = 200;
  let body: any;
  const res = { status: (n: number) => { status = n; return res; }, json: (data: any) => { body = data; } };
  await route.stack.at(-1).handle({ userId: "test", body: { vehicleType, pickupLat: 30.7, pickupLng: 76.7, dropLat: 30.8, dropLng: 76.8 }, log: { error: () => {} } }, res);
  return { status, body, writes };
}
test("Bike booking stores Bike with its own fare on a confirmed road route", async () => {
  const r = await book("Bike");
  assert.equal(r.status, 200);
  assert.equal(r.body.vehicle_type, "Bike");
  assert.match(r.writes[0], /5\.00, 12, 60, 'Bike'/);
});
test("Bike booking uses admin fare and platform fee including a zero base", async () => {
  const r = await book("Bike", false, [{ base_fee: 0, km_rate: 8, platform_fee: 7 }]);
  assert.match(r.writes[0], /5\.00, 12, 47, 'Bike'/);
});
test("Unavailable road route never creates a bike booking", async () => {
  const r = await book("Bike", true);
  assert.equal(r.status, 503);
  assert.equal(r.writes.length, 0);
});
test("Unknown vehicle is rejected before a booking is created", async () => {
  const r = await book("Bicycle");
  assert.equal(r.status, 400);
  assert.equal(r.writes.length, 0);
});
