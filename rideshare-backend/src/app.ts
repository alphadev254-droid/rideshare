import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";

import authRoutes from "./modules/auth/auth.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import driversRoutes from "./modules/drivers/drivers.routes.js";
import tripsRoutes from "./modules/trips/trips.routes.js";
import bookingsRoutes from "./modules/bookings/bookings.routes.js";
import paymentsRoutes from "./modules/payments/payments.routes.js";
import walletRoutes from "./modules/wallet/wallet.routes.js";
import reviewsRoutes from "./modules/reviews/reviews.routes.js";
import uploadRoutes from "./modules/uploads/uploads.routes.js";
import locationsRoutes from "./modules/locations/locations.routes.js";
import contactRoutes from "./modules/contact/contact.routes.js";

const app = express();

app.set("etag", false);

app.use("/api/v1", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

const corsOrigins = env.CORS_ORIGINS.split(",").map((o) => o.trim());

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.use("/api/v1/payments/webhook/paychangu", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/drivers", driversRoutes);
app.use("/api/v1/trips", tripsRoutes);
app.use("/api/v1/bookings", bookingsRoutes);
app.use("/api/v1/payments", paymentsRoutes);
app.use("/api/v1/wallet", walletRoutes);
app.use("/api/v1/reviews", reviewsRoutes);
app.use("/api/v1/uploads", uploadRoutes);
app.use("/api/v1/locations", locationsRoutes);
app.use("/api/v1/contact", contactRoutes);

app.use(errorHandler);

export default app;

