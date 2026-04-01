import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Runs CREATE TABLE IF NOT EXISTS for every table in the schema.
 * Called at server startup so the production database is always up-to-date.
 */
export async function runMigrations() {
  logger.info("Running database migrations...");

  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      first_name TEXT,
      last_name TEXT,
      name TEXT,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'customer',
      location TEXT,
      profile_image TEXT,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
      admin_notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT,
      title TEXT NOT NULL,
      description TEXT,
      price NUMERIC(10,2) NOT NULL,
      price_unit TEXT NOT NULL DEFAULT 'day',
      location TEXT NOT NULL,
      latitude NUMERIC(10,6),
      longitude NUMERIC(10,6),
      images TEXT[],
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      rating NUMERIC(3,2) DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_days INTEGER NOT NULL DEFAULT 1,
      total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider_id TEXT,
      listing_id TEXT,
      booking_id TEXT,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      listing_id TEXT,
      last_message TEXT,
      last_message_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS chat_participants (
      chat_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (chat_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      sms_alerts BOOLEAN NOT NULL DEFAULT TRUE,
      email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
      language TEXT NOT NULL DEFAULT 'en',
      currency TEXT NOT NULL DEFAULT 'INR',
      two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS blocked_users (
      id TEXT PRIMARY KEY,
      blocker_id TEXT NOT NULL,
      blocked_id TEXT NOT NULL,
      blocked_name TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      reported_user_id TEXT NOT NULL,
      reported_user_name TEXT,
      reason TEXT NOT NULL DEFAULT 'other',
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS emergency_contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      relation TEXT,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS admin_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS admin_notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      target_role TEXT NOT NULL DEFAULT 'all',
      target_user_id TEXT,
      type TEXT NOT NULL DEFAULT 'admin',
      image_url TEXT,
      deep_link TEXT,
      scheduled_at TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'pending',
      sent_count INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS password_reset_otps (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      otp TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
  ];

  for (const stmt of statements) {
    await db.execute(sql.raw(stmt));
  }

  const alterStatements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS dob TEXT`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_date TEXT`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS time_slot TEXT`,
    `CREATE TABLE IF NOT EXISTS equipment_provider_details (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      equipment_name TEXT NOT NULL,
      license_number TEXT,
      make TEXT,
      model TEXT,
      year TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS service_provider_details (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      area TEXT NOT NULL,
      address TEXT NOT NULL,
      aadhaar_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
  ];

  for (const stmt of alterStatements) {
    await db.execute(sql.raw(stmt));
  }

  const bookingAlters2 = [
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_type TEXT`,
  ];
  for (const stmt of bookingAlters2) {
    await db.execute(sql.raw(stmt));
  }

  const listingAlters = [
    `ALTER TABLE listings ADD COLUMN IF NOT EXISTS operator_included BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE listings ADD COLUMN IF NOT EXISTS fuel_included BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE listings ADD COLUMN IF NOT EXISTS delivery_charges NUMERIC(10,2)`,
  ];
  for (const stmt of listingAlters) {
    await db.execute(sql.raw(stmt));
  }

  const pricingAlters = [
    `CREATE TABLE IF NOT EXISTS pricing_rules (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL,
      base_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
      hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
      daily_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
      km_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
      operator_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
      fuel_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
      material_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
      urgency_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
      delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
      platform_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
      commission_percent NUMERIC(5,2) NOT NULL DEFAULT 10,
      security_deposit NUMERIC(10,2) NOT NULL DEFAULT 0,
      updated_by TEXT,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(category, subcategory)
    )`,
  ];
  for (const stmt of pricingAlters) {
    await db.execute(sql.raw(stmt));
  }

  // ── Rides table + new passenger/cancel columns ───────────────────────────────
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS rides (
      id TEXT PRIMARY KEY,
      rider_id TEXT NOT NULL,
      driver_id TEXT,
      pickup_lat NUMERIC(10,6) NOT NULL,
      pickup_lng NUMERIC(10,6) NOT NULL,
      pickup_address TEXT,
      drop_lat NUMERIC(10,6) NOT NULL,
      drop_lng NUMERIC(10,6) NOT NULL,
      drop_address TEXT,
      distance_km NUMERIC(10,2),
      duration_min INTEGER,
      fare NUMERIC(10,2),
      vehicle_type TEXT NOT NULL DEFAULT 'Car',
      status TEXT NOT NULL DEFAULT 'requested',
      ride_type TEXT NOT NULL DEFAULT 'instant',
      scheduled_at TIMESTAMP,
      requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
      accepted_at TIMESTAMP,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      canceled_at TIMESTAMP,
      ride_for_type TEXT NOT NULL DEFAULT 'me',
      passenger_name TEXT,
      passenger_phone TEXT,
      cancellation_reason TEXT
    )
  `));

  const ridesAlters = [
    `ALTER TABLE rides ADD COLUMN IF NOT EXISTS ride_for_type TEXT NOT NULL DEFAULT 'me'`,
    `ALTER TABLE rides ADD COLUMN IF NOT EXISTS passenger_name TEXT`,
    `ALTER TABLE rides ADD COLUMN IF NOT EXISTS passenger_phone TEXT`,
    `ALTER TABLE rides ADD COLUMN IF NOT EXISTS cancellation_reason TEXT`,
    `ALTER TABLE rides ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP`,
  ];
  for (const stmt of ridesAlters) {
    await db.execute(sql.raw(stmt));
  }

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS provider_price_reference (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      provider_name TEXT NOT NULL DEFAULT '',
      listing_id TEXT,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL DEFAULT '',
      provider_price NUMERIC(10,2) NOT NULL DEFAULT 0,
      admin_price_snapshot NUMERIC(10,2) NOT NULL DEFAULT 0,
      difference_percent NUMERIC(8,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  logger.info("Database migrations complete.");
}
