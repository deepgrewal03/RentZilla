import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import { migrateReportTargets } from "./reportMigration";

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
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id TEXT UNIQUE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'email'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT TRUE`,
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
      cancellation_reason TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true
    )
  `));

  const ridesAlters = [
    `ALTER TABLE rides ADD COLUMN IF NOT EXISTS ride_for_type TEXT NOT NULL DEFAULT 'me'`,
    `ALTER TABLE rides ADD COLUMN IF NOT EXISTS passenger_name TEXT`,
    `ALTER TABLE rides ADD COLUMN IF NOT EXISTS passenger_phone TEXT`,
    `ALTER TABLE rides ADD COLUMN IF NOT EXISTS cancellation_reason TEXT`,
    `ALTER TABLE rides ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP`,
    `ALTER TABLE rides ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`,
    `ALTER TABLE rides ADD COLUMN IF NOT EXISTS trip_started_at TIMESTAMP`,
    `ALTER TABLE rides ADD COLUMN IF NOT EXISTS navigation_status TEXT NOT NULL DEFAULT 'idle'`,
    `ALTER TABLE rides ADD COLUMN IF NOT EXISTS driver_current_lat NUMERIC(10,6)`,
    `ALTER TABLE rides ADD COLUMN IF NOT EXISTS driver_current_lng NUMERIC(10,6)`,
    `ALTER TABLE rides ADD COLUMN IF NOT EXISTS live_eta INTEGER`,
  ];
  for (const stmt of ridesAlters) {
    await db.execute(sql.raw(stmt));
  }

  // driver_locations: add heading + speed if missing
  const driverLocAlters = [
    `CREATE TABLE IF NOT EXISTS driver_locations (
      driver_id TEXT PRIMARY KEY,
      lat NUMERIC(10,6) NOT NULL,
      lng NUMERIC(10,6) NOT NULL,
      heading NUMERIC(6,2) NOT NULL DEFAULT 0,
      speed NUMERIC(6,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
    `ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS heading NUMERIC(6,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS speed NUMERIC(6,2) NOT NULL DEFAULT 0`,
  ];
  for (const stmt of driverLocAlters) {
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

  // ── Promo codes ───────────────────────────────────────────────────────────────
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'percent',
      value NUMERIC(10,2) NOT NULL DEFAULT 0,
      min_order NUMERIC(10,2) NOT NULL DEFAULT 0,
      max_uses INTEGER NOT NULL DEFAULT 100,
      used_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      description TEXT,
      expires_at TIMESTAMP,
      created_by TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  // ── Extra booking columns for multi-slot + promo support ──────────────────────
  const bookingExtras = [
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS time_slots TEXT`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_types TEXT`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promo_code TEXT`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10,2) NOT NULL DEFAULT 0`,
  ];
  for (const stmt of bookingExtras) {
    await db.execute(sql.raw(stmt));
  }

  // ── Engine size + vehicle type on listings ────────────────────────────────────
  const listingEngineColumns = [
    `ALTER TABLE listings ADD COLUMN IF NOT EXISTS engine_size REAL`,
    `ALTER TABLE listings ADD COLUMN IF NOT EXISTS vehicle_type TEXT`,
    `ALTER TABLE listings ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,6)`,
    `ALTER TABLE listings ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,6)`,
  ];
  for (const stmt of listingEngineColumns) {
    await db.execute(sql.raw(stmt));
  }

  // ── Add in_progress to booking_status enum (if it exists as an enum type) ──────
  // Silently ignored when the status column is plain TEXT (dev environment).
  try {
    await db.execute(sql.raw(`ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'in_progress'`));
  } catch (_) { /* enum type doesn't exist in this env — safe to ignore */ }

  // ── Service fee + extra charges on bookings ───────────────────────────────────
  const jobColumns = [
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_fee NUMERIC(10,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS extra_charges TEXT`,
  ];
  for (const stmt of jobColumns) {
    await db.execute(sql.raw(stmt));
  }

  // ── Pricing service-type rules (per service type within a subcategory) ────────
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS pricing_service_type_rules (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL,
      service_type TEXT NOT NULL,
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
      UNIQUE(category, subcategory, service_type)
    )
  `));

  // ── Wallet & commission system ─────────────────────────────────────────────
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      balance_after NUMERIC(10,2) NOT NULL DEFAULT 0,
      reference_id TEXT,
      reference_type TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS payouts (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      method TEXT NOT NULL DEFAULT 'instant',
      bank_ref TEXT,
      upi_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      scheduled_at TIMESTAMP,
      processed_at TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS user_payment_methods (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      encrypted_details TEXT NOT NULL,
      masked_display TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS platform_payment_methods (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  const walletAlters = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(10,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_preference TEXT NOT NULL DEFAULT 'wallet'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS upi_id TEXT`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_earning NUMERIC(10,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) NOT NULL DEFAULT 15`,
    `ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS reference_type TEXT`,
  ];
  for (const stmt of walletAlters) {
    await db.execute(sql.raw(stmt));
  }

  // ── Gold Membership ──────────────────────────────────────────────────────────
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS gold_purchases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount NUMERIC(10,2) NOT NULL DEFAULT 2.49,
      status TEXT NOT NULL DEFAULT 'completed',
      tx_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  const goldAlters = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_gold_member BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS gold_activated_at TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS gold_expires_at TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS gold_purchase_tx_id TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS total_membership_savings NUMERIC(10,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gold_discount_applied BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gold_discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE gold_purchases ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`,
  ];
  for (const stmt of goldAlters) {
    await db.execute(sql.raw(stmt));
  }

  // ── Wheel of Fortune ─────────────────────────────────────────────────────────
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS wheel_spins (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      spin_type TEXT NOT NULL DEFAULT 'free',
      reward_label TEXT,
      discount_value NUMERIC(5,2) NOT NULL DEFAULT 0,
      payment_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      segment_index INTEGER NOT NULL DEFAULT 6,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS promo_vault (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'wheel',
      discount_value NUMERIC(5,2) NOT NULL DEFAULT 0,
      discount_type TEXT NOT NULL DEFAULT 'percent',
      description TEXT,
      expiry_date TIMESTAMP,
      spin_id TEXT,
      is_used BOOLEAN NOT NULL DEFAULT FALSE,
      is_expired BOOLEAN NOT NULL DEFAULT FALSE,
      used_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  const wheelAlters = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS free_spin_last_used TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS paid_spin_balance INTEGER NOT NULL DEFAULT 0`,
  ];
  for (const stmt of wheelAlters) {
    await db.execute(sql.raw(stmt));
  }

  // ── Referral System ───────────────────────────────────────────────────────────
  const referralUserAlters = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_progress INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_referral_reward BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS total_referral_rewards INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_first_completion_counted BOOLEAN NOT NULL DEFAULT FALSE`,
  ];
  for (const stmt of referralUserAlters) {
    await db.execute(sql.raw(stmt));
  }

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      referred_user_id TEXT NOT NULL,
      referral_code TEXT NOT NULL,
      first_completion_done BOOLEAN NOT NULL DEFAULT FALSE,
      reward_granted BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS referral_rewards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      reward_type TEXT NOT NULL,
      reward_value NUMERIC(5,2) NOT NULL DEFAULT 10,
      status TEXT NOT NULL DEFAULT 'pending',
      unlocked_at TIMESTAMP NOT NULL DEFAULT NOW(),
      used_at TIMESTAMP,
      used_in_booking_id TEXT
    )
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      contact TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMP
    )
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS user_verification (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      phone_verified BOOLEAN NOT NULL DEFAULT TRUE,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      gov_id_status TEXT NOT NULL DEFAULT 'none',
      gov_id_doc_id TEXT,
      selfie_status TEXT NOT NULL DEFAULT 'none',
      selfie_doc_id TEXT,
      address_status TEXT NOT NULL DEFAULT 'none',
      address_doc_id TEXT,
      trust_score INTEGER NOT NULL DEFAULT 0,
      verification_level TEXT NOT NULL DEFAULT 'unverified',
      admin_note TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS provider_documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      service_type TEXT NOT NULL,
      document_type TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT,
      file_size INTEGER,
      mime_type TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMP
    )
  `));

  // ── P0: Booking integrity — transition audit log ──────────────────────────────
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS booking_transition_log (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      reason TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  // ── P0: Payment event log for idempotency + reconciliation ───────────────────
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS payment_event_logs (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT UNIQUE NOT NULL,
      booking_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      actor_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'success',
      error_message TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  // ── P1: Idempotency keys for booking creation (prevent duplicate taps) ────────
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  // ── Indexes for performance ───────────────────────────────────────────────────
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_listing ON bookings(listing_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date)`,
    `CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_wallet_tx_ref ON wallet_transactions(reference_id)`,
    `CREATE INDEX IF NOT EXISTS idx_booking_log_booking ON booking_transition_log(booking_id)`,
    `CREATE INDEX IF NOT EXISTS idx_payment_log_booking ON payment_event_logs(booking_id)`,
    `CREATE INDEX IF NOT EXISTS idx_listings_provider ON listings(provider_id)`,
    `CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category)`,
  ];
  for (const stmt of indexes) {
    await db.execute(sql.raw(stmt));
  }

  // ── Add updated_at to bookings ────────────────────────────────────────────────
  const timestampAlters = [
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_status TEXT`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fraud_hold BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE`,
  ];
  for (const stmt of timestampAlters) {
    await db.execute(sql.raw(stmt));
  }

  // ── P4: Unique index to prevent same listing+date+slot double booking ─────────
  // Uses a partial unique index only for active bookings
  try {
    await db.execute(sql.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_booking_slot
      ON bookings(listing_id, booking_date, time_slot)
      WHERE status NOT IN ('cancelled', 'refunded', 'closed')
        AND time_slot IS NOT NULL
        AND booking_date IS NOT NULL
    `));
  } catch (_) { /* Index may already exist or time_slot is null — safe to skip */ }

  // ── Add dispute tracking columns to bookings ──────────────────────────────────
  const disputeAlters = [
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_reason TEXT`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_opened_at TIMESTAMP`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2) NOT NULL DEFAULT 0`,
  ];
  for (const stmt of disputeAlters) {
    await db.execute(sql.raw(stmt));
  }

  // ── Razorpay orders table ─────────────────────────────────────────────────────
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS razorpay_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      razorpay_order_id TEXT UNIQUE NOT NULL,
      razorpay_payment_id TEXT,
      razorpay_signature TEXT,
      purpose TEXT NOT NULL,
      amount_inr NUMERIC(10,2) NOT NULL,
      amount_paise INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'created',
      notes JSONB,
      paid_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_rz_orders_user ON razorpay_orders(user_id)`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_rz_orders_status ON razorpay_orders(status)`));

  // ── Booking payment + invoice records ──────────────────────────────────────
  // Bookings remain payment-pending until a verified Razorpay capture updates
  // these fields. Keeping the invoice as an immutable record makes retries safe.
  const bookingPaymentAlters = [
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_due_amount NUMERIC(10,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_order_id TEXT`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_id TEXT`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promo_reserved_order_id TEXT`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promo_released_at TIMESTAMP`,
    `ALTER TABLE razorpay_orders ADD COLUMN IF NOT EXISTS booking_id TEXT`,
    `ALTER TABLE razorpay_orders ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMP`,
    `ALTER TABLE razorpay_orders ADD COLUMN IF NOT EXISTS refund_id TEXT`,
    `ALTER TABLE razorpay_orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP`,
  ];
  for (const stmt of bookingPaymentAlters) {
    await db.execute(sql.raw(stmt));
  }
  await db.execute(sql.raw(`
    UPDATE bookings
    SET payment_due_amount = COALESCE(NULLIF(final_amount, 0), total_amount)
    WHERE payment_due_amount = 0 AND payment_status = 'pending'
  `));
  await db.execute(sql.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rz_booking_open_order
    ON razorpay_orders(booking_id) WHERE booking_id IS NOT NULL AND status = 'created'
  `));
  await db.execute(sql.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rz_payment_id
    ON razorpay_orders(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL
  `));

  // ── P4: Booking cleanup ──────────────────────────────────────────────────────
  // A merely-created checkout may be cancelled; a late capture is refunded by
  // the webhook path. Already-collected payments require the refund workflow.
  try {
    await db.execute(sql.raw(`
      WITH cancelled AS (
        UPDATE bookings b
        SET status = 'cancelled',
            updated_at = NOW(),
            promo_released_at = CASE
              WHEN promo_reserved_order_id IS NOT NULL AND promo_released_at IS NULL THEN NOW()
              ELSE promo_released_at
            END
        WHERE b.status = 'pending'
          AND b.listing_id NOT IN (SELECT id FROM listings)
          AND NOT EXISTS (
            SELECT 1 FROM razorpay_orders ro
            WHERE ro.booking_id = b.id
              AND ro.purpose = 'booking_payment'
              AND ro.status = 'paid'
          )
        RETURNING b.promo_code, b.promo_reserved_order_id, b.promo_released_at
      ), released AS (
        SELECT UPPER(promo_code) AS code, COUNT(*)::INTEGER AS count
        FROM cancelled
        WHERE promo_code IS NOT NULL
          AND promo_reserved_order_id IS NOT NULL
          AND promo_released_at IS NOT NULL
        GROUP BY UPPER(promo_code)
      )
      UPDATE promo_codes p
      SET used_count = GREATEST(0, p.used_count - released.count)
      FROM released WHERE UPPER(p.code) = released.code
    `));
  } catch (_) { /* Non-critical */ }
  try {
    await db.execute(sql.raw(`
      WITH cancelled AS (
        UPDATE bookings b
        SET status = 'cancelled',
            updated_at = NOW(),
            promo_released_at = CASE
              WHEN promo_reserved_order_id IS NOT NULL AND promo_released_at IS NULL THEN NOW()
              ELSE promo_released_at
            END
        WHERE (b.provider_id IS NULL OR b.provider_id = '')
          AND b.status NOT IN ('completed', 'cancelled', 'closed')
          AND NOT EXISTS (
            SELECT 1 FROM razorpay_orders ro
            WHERE ro.booking_id = b.id
              AND ro.purpose = 'booking_payment'
              AND ro.status = 'paid'
          )
        RETURNING b.promo_code, b.promo_reserved_order_id, b.promo_released_at
      ), released AS (
        SELECT UPPER(promo_code) AS code, COUNT(*)::INTEGER AS count
        FROM cancelled
        WHERE promo_code IS NOT NULL
          AND promo_reserved_order_id IS NOT NULL
          AND promo_released_at IS NOT NULL
        GROUP BY UPPER(promo_code)
      )
      UPDATE promo_codes p
      SET used_count = GREATEST(0, p.used_count - released.count)
      FROM released WHERE UPPER(p.code) = released.code
    `));
  } catch (_) { /* Non-critical */ }
  try {
    await db.execute(sql.raw(`
      WITH cancelled AS (
        UPDATE bookings b
        SET status = 'cancelled',
            updated_at = NOW(),
            promo_released_at = CASE
              WHEN promo_reserved_order_id IS NOT NULL AND promo_released_at IS NULL THEN NOW()
              ELSE promo_released_at
            END
        WHERE b.status = 'pending'
          AND b.created_at < NOW() - INTERVAL '48 hours'
          AND NOT EXISTS (
            SELECT 1 FROM razorpay_orders ro
            WHERE ro.booking_id = b.id
              AND ro.purpose = 'booking_payment'
              AND ro.status = 'paid'
          )
        RETURNING b.promo_code, b.promo_reserved_order_id, b.promo_released_at
      ), released AS (
        SELECT UPPER(promo_code) AS code, COUNT(*)::INTEGER AS count
        FROM cancelled
        WHERE promo_code IS NOT NULL
          AND promo_reserved_order_id IS NOT NULL
          AND promo_released_at IS NOT NULL
        GROUP BY UPPER(promo_code)
      )
      UPDATE promo_codes p
      SET used_count = GREATEST(0, p.used_count - released.count)
      FROM released WHERE UPPER(p.code) = released.code
    `));
  } catch (_) { /* Non-critical */ }

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      booking_id TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      payment_order_id TEXT NOT NULL,
      razorpay_payment_id TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      subtotal NUMERIC(10,2) NOT NULL,
      discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(10,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'issued',
      issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id)`));

  // ── dispute_messages table ─────────────────────────────────────────────────
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS dispute_messages (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_role TEXT NOT NULL DEFAULT 'customer',
      content TEXT NOT NULL,
      attachment_url TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_dispute_msgs_booking ON dispute_messages(booking_id)`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_dispute_msgs_sender ON dispute_messages(sender_id)`));

  // ── fraud_scores cache table ───────────────────────────────────────────────
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS fraud_scores (
      user_id TEXT PRIMARY KEY,
      score INTEGER NOT NULL DEFAULT 0,
      risk_level TEXT NOT NULL DEFAULT 'low',
      factors JSONB NOT NULL DEFAULT '[]',
      computed_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));

  // ── Add dispute resolution columns to bookings ────────────────────────────
  const disputeResolutionAlters = [
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_resolution TEXT`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMP`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_resolved_by TEXT`,
  ];
  for (const stmt of disputeResolutionAlters) {
    try { await db.execute(sql.raw(stmt)); } catch (_) {}
  }

  // ── Foreign key constraints (DO block — idempotent, NOT VALID skips existing rows) ──
  await db.execute(sql.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_listings_provider') THEN
        ALTER TABLE listings ADD CONSTRAINT fk_listings_provider FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_reviews_user') THEN
        ALTER TABLE reviews ADD CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_reviews_listing') THEN
        ALTER TABLE reviews ADD CONSTRAINT fk_reviews_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE NOT VALID;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_favorites_user') THEN
        ALTER TABLE favorites ADD CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_favorites_listing') THEN
        ALTER TABLE favorites ADD CONSTRAINT fk_favorites_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE NOT VALID;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_messages_chat') THEN
        ALTER TABLE messages ADD CONSTRAINT fk_messages_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE NOT VALID;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_notifications_user') THEN
        ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_wallet_user') THEN
        ALTER TABLE wallet_transactions ADD CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_dispute_msgs_booking') THEN
        ALTER TABLE dispute_messages ADD CONSTRAINT fk_dispute_msgs_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE NOT VALID;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_dispute_msgs_sender') THEN
        ALTER TABLE dispute_messages ADD CONSTRAINT fk_dispute_msgs_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
      END IF;
    END $$
  `)).catch(() => {});

  await migrateReportTargets();
  logger.info("Database migrations complete.");
}
