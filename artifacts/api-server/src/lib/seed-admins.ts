import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const SUPER_ADMINS = [
  { email: "admin@rentzilla.com",  password: "admin123",  name: "Super Admin" },
  { email: "admin1@rentzilla.com", password: "Admin@123", name: "Super Admin 1" },
  { email: "admin2@rentzilla.com", password: "Admin@123", name: "Super Admin 2" },
  { email: "admin3@rentzilla.com", password: "Admin@123", name: "Super Admin 3" },
];

function genId() {
  return Date.now().toString() + Math.random().toString(36).slice(2, 9);
}

function randomPhone() {
  return "+91" + (9000000000 + Math.floor(Math.random() * 999999999)).toString();
}

export async function seedSuperAdmins() {
  try {
    logger.info("Seeding super admin accounts...");

    for (const admin of SUPER_ADMINS) {
      const existing = await db
        .select({ id: usersTable.id, isAdmin: usersTable.isAdmin })
        .from(usersTable)
        .where(eq(usersTable.email, admin.email))
        .limit(1);

      if (existing.length === 0) {
        const hash = await bcrypt.hash(admin.password, 10);
        await db.execute(sql`
          INSERT INTO users (id, phone, email, name, password_hash, role, is_admin, is_suspended, created_at)
          VALUES (${genId()}, ${randomPhone()}, ${admin.email}, ${admin.name}, ${hash}, 'customer', TRUE, FALSE, NOW())
        `);
        logger.info({ email: admin.email }, "Super admin seeded");
      } else {
        // Ensure the flag is set even if the user existed before
        await db.execute(sql`UPDATE users SET is_admin = TRUE WHERE email = ${admin.email}`);
        logger.info({ email: admin.email }, "Super admin confirmed");
      }
    }

    logger.info("Super admin seeding complete.");
  } catch (err) {
    logger.error({ err }, "Super admin seeding failed (non-fatal)");
    // Non-fatal — don't crash the server if seeding fails
  }
}
