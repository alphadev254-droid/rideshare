import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/auth.js";
import {
  registerController,
  verifyOtpController,
  loginController,
  refreshController,
  logoutController,
} from "./auth.controller.js";
import {
  registerSchema,
  verifyOtpSchema,
  loginSchema,
  refreshSchema,
} from "./auth.schemas.js";

const router = Router();

router.post("/register", validate(registerSchema), registerController);
router.post("/verify-otp", validate(verifyOtpSchema), verifyOtpController);
router.post("/login", validate(loginSchema), loginController);
router.post("/refresh", validate(refreshSchema), refreshController);
router.post("/logout", authenticate, logoutController);

export default router;
