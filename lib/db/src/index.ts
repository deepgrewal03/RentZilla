import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Do not throw at import time: that kills the server before it can bind its
  // port, which shows up as an opaque deployment failure. Log loudly instead and
  // let individual queries fail with a real error.
  console.error(
    "[db] DATABASE_URL is not set. Did you forget to provision a database? " +
      "Database queries will fail until it is configured.",
  );
}

export const pool = new Pool(connectionString ? { connectionString } : {});
export const db = drizzle(pool, { schema });

export * from "./schema";
