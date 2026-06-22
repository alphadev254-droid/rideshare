import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../../types/index.js";
import * as authService from "./auth.service.js";
import type { RegisterInput, VerifyOtpInput, LoginInput, RefreshInput } from "./auth.schemas.js";

export async function registerController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.register(req.body as RegisterInput);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function verifyOtpController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.verifyOtp(req.body as VerifyOtpInput);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.login(req.body as LoginInput);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function refreshController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.refresh(req.body as RefreshInput);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function logoutController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await authService.logout(req.user!.sub);
    res.json({ success: true, message: "Logged out" });
  } catch (err) {
    next(err);
  }
}
