import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/auth.js";
import {
  getBookingController,
  resendCodeController,
  cancelBookingController,
  getMyBookingsController,
  getTripBookingsController,
  verifyCodeController,
  listAdminBookingsController,
  getRefundPreviewController,
  requestRefundController,
} from "./bookings.controller.js";

const router = Router();

router.get("/my", authenticate, getMyBookingsController);
router.get("/mine", authenticate, getMyBookingsController);
router.get("/admin", authenticate, requireRole("admin"), listAdminBookingsController);
router.get("/trip/:tripId", authenticate, getTripBookingsController);
router.get("/:id", authenticate, getBookingController);
router.get("/:id/refund-preview", authenticate, requireRole("passenger"), getRefundPreviewController);
router.post("/:id/resend-code", authenticate, resendCodeController);
router.post("/:id/verify-code", authenticate, verifyCodeController);
router.post("/:id/refund", authenticate, requireRole("passenger"), requestRefundController);
router.patch("/:id/cancel", authenticate, cancelBookingController);
router.delete("/:id", authenticate, cancelBookingController);

export default router;
