import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/migrate";
import { seedSuperAdmins } from "./lib/seed-admins";
import { startPayoutScheduler } from "./lib/payout-scheduler.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Run migrations and seed admin accounts before accepting requests
runMigrations()
  .then(() => seedSuperAdmins())
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
      startPayoutScheduler();
    });
  })
  .catch((err) => {
    logger.error({ err }, "Startup failed during migrations");
    process.exit(1);
  });
