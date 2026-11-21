import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/migrate";
import { seedSuperAdmins } from "./lib/seed-admins";
import { startPayoutScheduler } from "./lib/payout-scheduler.js";
import { startPushDeliveryWorker } from "./lib/pushDelivery.js";

const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Migrations are best-effort: a transient database problem must not stop the
// server from binding its port, otherwise the deployment health check fails and
// the whole publish is rejected with no useful error.
runMigrations()
  .then(() => seedSuperAdmins())
  .catch((err) => {
    logger.error({ err }, "Startup migration failed; serving anyway");
  })
  .then(() => {
    app.listen(port, "0.0.0.0", (err?: Error) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
      startPayoutScheduler();
      startPushDeliveryWorker();
    });
  });
