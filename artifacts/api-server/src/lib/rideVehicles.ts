import { sql } from "drizzle-orm";

export const RIDE_VEHICLES = ["Car", "SUV", "Van", "Auto", "Bike"] as const;
export function isRideVehicle(value: unknown): value is typeof RIDE_VEHICLES[number] {
  return typeof value === "string" && (RIDE_VEHICLES as readonly string[]).includes(value);
}

// Use the same classification for availability, matching and atomic acceptance.
// Existing car listings may predate vehicle_type.
export const listingRideType = sql`CASE
  WHEN l.subcategory = 'Bike' OR l.vehicle_type = 'Bike' THEN 'Bike'
  WHEN l.vehicle_type IN ('Car', 'SUV', 'Van', 'Auto') THEN l.vehicle_type
  WHEN l.subcategory IN ('SUV', 'Van', 'Auto') THEN l.subcategory
  WHEN l.engine_size > 2.4 THEN 'Van'
  WHEN l.engine_size > 1.6 THEN 'SUV'
  ELSE 'Car' END`;

export function eligibleVehicleListings(userId: string) {
  return sql`l.provider_id = ${userId} AND l.category = 'cars'
    AND l.is_available = true
    AND EXISTS (SELECT 1 FROM users u WHERE u.id = ${userId} AND u.role IN ('provider', 'both'))`;
}

export function canAcceptRide(userId: string) {
  return sql`EXISTS (SELECT 1 FROM listings l WHERE ${eligibleVehicleListings(userId)}
    AND ${listingRideType} = r.vehicle_type)
    AND EXISTS (SELECT 1 FROM driver_status ds WHERE ds.driver_id = ${userId} AND ds.is_online = true)`;
}
