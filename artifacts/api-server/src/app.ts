import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import legalRouter from "./routes/legal.js";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());

// Capture raw body for Razorpay webhook signature verification
app.use((req, res, next) => {
  if (req.path === "/api/payments/webhook") {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => { data += chunk; });
    req.on("end", () => {
      (req as any).rawBody = data;
      try { (req as any).body = JSON.parse(data); } catch { (req as any).body = {}; }
      next();
    });
  } else {
    next();
  }
});

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Serve uploaded provider documents as static files
const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

// Legal pages — served at root level so /privacy and /terms are direct URLs
app.use(legalRouter);

app.use("/api", router);

export default app;
