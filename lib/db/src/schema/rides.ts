import { pgTable, text, timestamp, integer, boolean, numeric, doublePrecision } from "drizzle-orm/pg-core";

export const ridesTable = pgTable("rides", {
  id: text("id").primaryKey(),
  riderId: text("rider_id").notNull(),
  driverId: text("driver_id"),
  pickupLat: doublePrecision("pickup_lat").notNull(),
  pickupLng: doublePrecision("pickup_lng").notNull(),
  pickupAddress: text("pickup_address"),
  dropLat: doublePrecision("drop_lat").notNull(),
  dropLng: doublePrecision("drop_lng").notNull(),
  dropAddress: text("drop_address"),
  distanceKm: doublePrecision("distance_km"),
  durationMin: integer("duration_min"),
  fare: doublePrecision("fare"),
  vehicleType: text("vehicle_type").notNull().default("Car"),
  status: text("status").notNull().default("requested"),
  rideType: text("ride_type").notNull().default("instant"),
  scheduledAt: timestamp("scheduled_at"),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  canceledAt: timestamp("canceled_at"),
  rideForType: text("ride_for_type").notNull().default("me"),
  passengerName: text("passenger_name"),
  passengerPhone: text("passenger_phone"),
  cancellationReason: text("cancellation_reason"),
  isActive: boolean("is_active").notNull().default(true),
  tripStartedAt: timestamp("trip_started_at"),
  navigationStatus: text("navigation_status").notNull().default("idle"),
  driverCurrentLat: numeric("driver_current_lat", { precision: 10, scale: 6 }),
  driverCurrentLng: numeric("driver_current_lng", { precision: 10, scale: 6 }),
  liveEta: integer("live_eta"),
});

export const driverLocationsTable = pgTable("driver_locations", {
  driverId: text("driver_id").primaryKey(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  heading: numeric("heading", { precision: 6, scale: 2 }).notNull().default("0"),
  speed: numeric("speed", { precision: 6, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const driverProfilesTable = pgTable("driver_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  licenseNumber: text("license_number"),
  vehicleType: text("vehicle_type"),
  vehicleMake: text("vehicle_make"),
  vehicleModel: text("vehicle_model"),
  vehicleYear: text("vehicle_year"),
  vehicleColor: text("vehicle_color"),
  isApproved: boolean("is_approved").notNull().default(false),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const driverStatusTable = pgTable("driver_status", {
  driverId: text("driver_id").primaryKey(),
  isOnline: boolean("is_online").notNull().default(false),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const savedLocationsTable = pgTable("saved_locations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  label: text("label"),
  address: text("address"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  type: text("type"),
  usedAt: timestamp("used_at"),
});

export type Ride = typeof ridesTable.$inferSelect;
export type DriverLocation = typeof driverLocationsTable.$inferSelect;
