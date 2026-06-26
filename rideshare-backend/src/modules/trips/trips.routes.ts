import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createTripController,
  searchTripsController,
  getTripController,
  updateTripStatusController,
  updateLocationController,
  getTripLocationController,
  authenticateCodeController,
  completeTripController,
  listPublicTripsController,
  listTripsAdminController,
  getDriverTripsController,
  startTripController,
  cancelTripController,
  updateTripController,
  createTripAdminController,
  updateTripAdminController,
  updateTripStatusAdminController,
  deleteTripAdminController,
} from "./trips.controller.js";
import {
  adminTripSchema,
  createTripSchema,
  searchTripsSchema,
  updateTripSchema,
  updateTripStatusSchema,
  locationUpdateSchema,
  authenticateCodeSchema,
} from "./trips.schemas.js";

const router = Router();

router.post("/", authenticate, requireRole("driver"), validate(createTripSchema), createTripController);
router.get("/search", validate(searchTripsSchema, "query"), searchTripsController);
router.get("/public", listPublicTripsController);
router.get("/mine", authenticate, requireRole("driver"), getDriverTripsController);
router.get("/", authenticate, requireRole("admin"), listTripsAdminController);
router.post("/admin", authenticate, requireRole("admin"), validate(adminTripSchema), createTripAdminController);
router.patch("/admin/:id", authenticate, requireRole("admin"), validate(adminTripSchema), updateTripAdminController);
router.patch("/admin/:id/status", authenticate, requireRole("admin"), validate(updateTripStatusSchema), updateTripStatusAdminController);
router.delete("/admin/:id", authenticate, requireRole("admin"), deleteTripAdminController);
router.get("/:id/location", authenticate, getTripLocationController);
router.get("/:id", getTripController);  // public — no auth required to view a trip
router.patch("/:id", authenticate, requireRole("driver"), validate(updateTripSchema), updateTripController);
router.patch("/:id/start", authenticate, requireRole("driver"), startTripController);
router.patch("/:id/complete", authenticate, requireRole("driver"), completeTripController);
router.patch("/:id/cancel", authenticate, requireRole("driver"), cancelTripController);
router.patch("/:id/status", authenticate, requireRole("driver"), validate(updateTripStatusSchema), updateTripStatusController);
router.post("/:id/location", authenticate, requireRole("driver"), validate(locationUpdateSchema), updateLocationController);
router.post("/:id/authenticate", authenticate, requireRole("driver"), validate(authenticateCodeSchema), authenticateCodeController);

export default router;
