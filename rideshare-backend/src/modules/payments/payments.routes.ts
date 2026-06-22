import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  initiatePaymentController,
  initiateRidePaymentController,
  paychanguWebhookController,
  paychanguCallbackController,
  verifyPaymentController,
  getPaymentStatusController,
  adminRefundController,
  listPassengerTransactionsController,
  listDriverTransactionsController,
  listAdminTransactionsController,
  getTransactionController,
} from "./payments.controller.js";
import { initiatePaymentSchema, initiateRidePaymentSchema } from "./payments.schemas.js";

const router = Router();

router.post("/initiate", authenticate, validate(initiatePaymentSchema), initiatePaymentController);
router.post("/initiate-ride", authenticate, validate(initiateRidePaymentSchema), initiateRidePaymentController);
router.post("/webhook/paychangu", paychanguWebhookController);
router.get("/callback/paychangu", paychanguCallbackController);
router.get("/transactions/my", authenticate, listPassengerTransactionsController);
router.get("/transactions/driver", authenticate, requireRole("driver"), listDriverTransactionsController);
router.get("/transactions/admin", authenticate, requireRole("admin"), listAdminTransactionsController);
router.get("/transactions/:id", authenticate, getTransactionController);
router.get("/verify/:paymentId", authenticate, verifyPaymentController);
router.get("/:bookingId", authenticate, getPaymentStatusController);
router.post("/:id/refund", authenticate, requireRole("admin"), adminRefundController);

export default router;
