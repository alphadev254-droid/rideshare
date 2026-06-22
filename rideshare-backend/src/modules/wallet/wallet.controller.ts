import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../../types/index.js";
import * as walletService from "./wallet.service.js";

export async function getWithdrawalByIdController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await walletService.getWithdrawalById(req.user!.sub, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getBalanceController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await walletService.getBalance(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getTransactionsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const data = await walletService.getTransactions(req.user!.sub, page, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getWithdrawalsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const data = await walletService.getWithdrawals(req.user!.sub, page, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function requestWithdrawalOtpController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await walletService.requestWithdrawalOtp(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function withdrawController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { amount_mwk, amountMwk, phone, provider, method, otp } = req.body as {
      amount_mwk?: number;
      amountMwk?: number;
      phone: string;
      provider?: string;
      method?: string;
      otp: string;
    };
    const data = await walletService.requestWithdrawal(
      req.user!.sub,
      Number(amount_mwk ?? amountMwk),
      phone,
      provider ?? method ?? "mobile_money",
      otp,
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
