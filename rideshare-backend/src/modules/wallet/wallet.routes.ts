import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/auth.js";
import {
  getBalanceController,
  getTransactionsController,
  getWithdrawalsController,
  getWithdrawalByIdController,
  listAdminWalletTransactionsController,
  listAdminWithdrawalsController,
  reconcileWithdrawalController,
  requestWithdrawalOtpController,
  withdrawController,
} from "./wallet.controller.js";

const router = Router();

router.get("/admin/transactions", authenticate, requireRole("admin"), listAdminWalletTransactionsController);
router.get("/admin/withdrawals", authenticate, requireRole("admin"), listAdminWithdrawalsController);
router.post("/admin/withdrawals/:id/reconcile", authenticate, requireRole("admin"), reconcileWithdrawalController);

router.get("/balance", authenticate, requireRole("driver"), getBalanceController);
router.get("/transactions", authenticate, requireRole("driver"), getTransactionsController);
router.get("/withdrawals", authenticate, requireRole("driver"), getWithdrawalsController);
router.get("/withdrawals/:id", authenticate, requireRole("driver"), getWithdrawalByIdController);
router.post("/withdraw/otp", authenticate, requireRole("driver"), requestWithdrawalOtpController);
router.post("/withdraw", authenticate, requireRole("driver"), withdrawController);

export default router;
