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
  listAdminRefundsController,
  getRefundPreviewController,
  getAdminCancelPreviewController,
  adminCancelOnlyController,
  adminCancelAndRefundController,
  reconcileRefundController,
  requestRefundController,
} from "./bookings.controller.js";

const router = Router();

router.get("/my", authenticate, getMyBookingsController);
router.get("/mine", authenticate, getMyBookingsController);
router.get("/admin", authenticate, requireRole("admin"), listAdminBookingsController);
router.get("/admin/refunds", authenticate, requireRole("admin"), listAdminRefundsController);
router.post("/admin/refunds/:id/reconcile", authenticate, requireRole("admin"), reconcileRefundController);
router.get("/admin/:id/cancel-preview", authenticate, requireRole("admin"), getAdminCancelPreviewController);
router.post("/admin/:id/cancel-only", authenticate, requireRole("admin"), adminCancelOnlyController);
router.post("/admin/:id/cancel-and-refund", authenticate, requireRole("admin"), adminCancelAndRefundController);
router.get("/trip/:tripId", authenticate, getTripBookingsController);
router.get("/:id", authenticate, getBookingController);
router.get("/:id/refund-preview", authenticate, requireRole("passenger"), getRefundPreviewController);
router.post("/:id/resend-code", authenticate, resendCodeController);
router.post("/:id/verify-code", authenticate, verifyCodeController);
router.post("/:id/refund", authenticate, requireRole("passenger"), requestRefundController);
router.patch("/:id/cancel", authenticate, cancelBookingController);
router.delete("/:id", authenticate, cancelBookingController);

export default router;
