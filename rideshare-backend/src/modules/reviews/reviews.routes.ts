import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { createReviewController, getDriverReviewsController, listReviewsForAdminController } from "./reviews.controller.js";
import { createReviewSchema } from "./reviews.schemas.js";

const router = Router();

router.post("/", authenticate, validate(createReviewSchema), createReviewController);
router.get("/admin", authenticate, requireRole("admin"), listReviewsForAdminController);
router.get("/driver/:driverId", getDriverReviewsController);

export default router;
