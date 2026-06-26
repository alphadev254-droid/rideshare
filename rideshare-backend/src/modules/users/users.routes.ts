import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getMeController,
  updateMeController,
  listUsersController,
  getUserByIdController,
  updateUserController,
  setUserStatusController,
  sendUserEmailController,
  deleteUserController,
  getAdminStatsController,
} from "./users.controller.js";
import { sendUserEmailSchema, updateMeSchema, updateUserSchema } from "./users.schemas.js";

const router = Router();

router.get("/me", authenticate, getMeController);
router.patch("/me", authenticate, validate(updateMeSchema), updateMeController);
router.get("/admin-stats", authenticate, requireRole("admin"), getAdminStatsController);
router.get("/", authenticate, requireRole("admin"), listUsersController);
router.get("/:id", authenticate, requireRole("admin"), getUserByIdController);
router.patch("/:id", authenticate, requireRole("admin"), validate(updateUserSchema), updateUserController);
router.patch("/:id/status", authenticate, requireRole("admin"), setUserStatusController);
router.post("/:id/email", authenticate, requireRole("admin"), validate(sendUserEmailSchema), sendUserEmailController);
router.delete("/:id", authenticate, requireRole("admin"), deleteUserController);

export default router;
