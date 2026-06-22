import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/auth.js";
import {
  getBalanceController,
  getTransactionsController,
  getWithdrawalsController,
  getWithdrawalByIdController,
  requestWithdrawalOtpController,
  withdrawController,
} from "./wallet.controller.js";

const router = Router();

router.get("/balance", authenticate, requireRole("driver"), getBalanceController);
router.get("/transactions", authenticate, requireRole("driver"), getTransactionsController);
router.get("/withdrawals", authenticate, requireRole("driver"), getWithdrawalsController);
router.get("/withdrawals/:id", authenticate, requireRole("driver"), getWithdrawalByIdController);
router.post("/withdraw/otp", authenticate, requireRole("driver"), requestWithdrawalOtpController);
router.post("/withdraw", authenticate, requireRole("driver"), withdrawController);

export default router;
