import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { canAcceptRide, isRideVehicle, listingRideType } from "./rideVehicles.js";

test("ride vehicle validation accepts Bike and rejects unknown/injected types", () => {
  for (const type of ["Bike", "Car", "SUV", "Van", "Auto"]) assert.equal(isRideVehicle(type), true);
  for (const type of [null, "", "Bicycle", "Bike'; DROP TABLE rides;--"]) assert.equal(isRideVehicle(type), false);
});

test("classification preserves legacy cars and explicitly identifies motorcycles", async () => {
  const result = await db.execute(sql`
    WITH listings(subcategory, vehicle_type, engine_size) AS (VALUES
      ('Bike', NULL::text, NULL::real), ('Motorcycle', 'Bike', 0.15),
      ('Sedan', NULL, 1.5), ('SUV', NULL, 2.0), ('Car', NULL, 3.0))
    SELECT ${listingRideType} AS type FROM listings l`);
  assert.deepEqual(result.rows.map((r: any) => r.type), ["Bike", "Bike", "Car", "SUV", "Van"]);
});

test("only online providers with available matching vehicles can accept", async () => {
  // Read-only fixtures: no real accounts or listings created or modified.
  for (const [driver, expected] of [
    ["biker", ["Bike"]], ["car-driver", ["Car"]], ["offline", []],
    ["unavailable", []], ["customer", []], ["unregistered", []],
  ] as [string, string[]][]) {
    const result = await db.execute(sql`
      WITH users(id, role) AS (VALUES ('biker','provider'), ('car-driver','both'),
        ('offline','provider'), ('unavailable','provider'), ('customer','customer')),
      listings(provider_id, category, subcategory, vehicle_type, engine_size, is_available) AS (
        VALUES ('biker','cars','Bike','Bike',NULL::real,true),
        ('car-driver','cars','Sedan','Car',1.5,true),
        ('offline','cars','Bike','Bike',NULL,true),
        ('unavailable','cars','Bike','Bike',NULL,false),
        ('customer','cars','Bike','Bike',NULL,true)),
      driver_status(driver_id,is_online) AS (
        VALUES ('biker',true),('car-driver',true),('offline',false),
        ('unavailable',true),('customer',true)),
      rides(vehicle_type) AS (VALUES ('Bike'), ('Car'), ('SUV'))
      SELECT r.vehicle_type FROM rides r WHERE ${canAcceptRide(driver)}`);
    assert.deepEqual(result.rows.map((r: any) => r.vehicle_type), expected);
  }
});
