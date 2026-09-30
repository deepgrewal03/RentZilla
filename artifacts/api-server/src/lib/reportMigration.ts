import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

// Additive migration: retain all historic reports, including historic duplicates.
export async function migrateReportTargets() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(63192016)`);
    await tx.execute(sql`
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'user';
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_id TEXT;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS target_name TEXT;
      UPDATE reports SET target_id = reported_user_id, target_name = reported_user_name
        WHERE target_id IS NULL;
      CREATE INDEX IF NOT EXISTS reports_reporter_target_idx ON reports (reporter_id, target_type, target_id);
      CREATE INDEX IF NOT EXISTS reports_reporter_created_idx ON reports (reporter_id, created_at);
    `);
  });
}