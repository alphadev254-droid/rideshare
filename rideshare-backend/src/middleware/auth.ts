import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/index.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { AppError } from "./error-handler.js";

export function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "Missing or invalid Authorization header"));
  }
  const token = header.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token"));
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, "Forbidden: insufficient permissions"));
    }
    next();
  };
}
