import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../../types/index.js";
import * as usersService from "./users.service.js";
import type { SendUserEmailInput, UpdateMeInput, UpdateUserInput } from "./users.schemas.js";

export async function getMeController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await usersService.getMe(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateMeController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await usersService.updateMe(req.user!.sub, req.body as UpdateMeInput);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getUserByIdController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await usersService.getUserById(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listUsersController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 50);
    const role = typeof req.query.role === "string" ? req.query.role : undefined;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
    const driverProfileStatus =
      typeof req.query.driverProfileStatus === "string" ? req.query.driverProfileStatus : undefined;
    const active =
      req.query.active === "true" ? true : req.query.active === "false" ? false : undefined;

    const data = await usersService.listUsers({
      page,
      limit,
      search: search || undefined,
      role: role === "passenger" || role === "driver" || role === "admin" ? role : undefined,
      active,
      driverProfileStatus:
        driverProfileStatus === "no_profile" ||
        driverProfileStatus === "not_submitted" ||
        driverProfileStatus === "pending" ||
        driverProfileStatus === "approved"
          ? driverProfileStatus
          : undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function sendUserEmailController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await usersService.sendUserEmail(
      req.params.id,
      req.body as SendUserEmailInput,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateUserController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await usersService.updateUser(req.params.id, req.body as UpdateUserInput);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function setUserStatusController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { isActive } = req.body as { isActive: boolean };
    const data = await usersService.setUserStatus(req.params.id, isActive);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteUserController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await usersService.deleteUser(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
