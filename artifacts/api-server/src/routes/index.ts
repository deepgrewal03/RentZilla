import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import listingsRouter from "./listings.js";
import bookingsRouter from "./bookings.js";
import reviewsRouter from "./reviews.js";
import chatsRouter from "./chats.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/listings", listingsRouter);
router.use("/bookings", bookingsRouter);
router.use("/reviews", reviewsRouter);
router.use("/chats", chatsRouter);

export default router;
