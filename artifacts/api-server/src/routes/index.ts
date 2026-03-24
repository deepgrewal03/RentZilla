import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import listingsRouter from "./listings.js";
import bookingsRouter from "./bookings.js";
import reviewsRouter from "./reviews.js";
import chatsRouter from "./chats.js";
import notificationsRouter from "./notifications.js";
import favoritesRouter from "./favorites.js";
import settingsRouter from "./settings.js";
import rolesRouter from "./roles.js";
import ridesRouter from "./ridesRoute.js";
import providerRouter from "./provider.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/listings", listingsRouter);
router.use("/bookings", bookingsRouter);
router.use("/reviews", reviewsRouter);
router.use("/chats", chatsRouter);
router.use("/notifications", notificationsRouter);
router.use("/favorites", favoritesRouter);
router.use("/settings", settingsRouter);
router.use("/roles", rolesRouter);
router.use("/rides", ridesRouter);
router.use("/provider", providerRouter);

export default router;
