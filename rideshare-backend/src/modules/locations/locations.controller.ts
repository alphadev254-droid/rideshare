import type { Request, Response, NextFunction } from "express";
import * as locationsService from "./locations.service.js";

export async function getDistrictsController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await locationsService.getDistricts();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}