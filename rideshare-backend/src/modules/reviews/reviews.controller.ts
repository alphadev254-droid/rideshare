import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../../types/index.js";
import * as reviewsService from "./reviews.service.js";
import type { CreateReviewInput } from "./reviews.schemas.js";

export async function createReviewController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await reviewsService.createReview(
      req.user!.sub,
      req.body as CreateReviewInput,
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getDriverReviewsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const data = await reviewsService.getDriverReviews(req.params.driverId, page, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listReviewsForAdminController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 70;
    const rating = req.query.rating ? Number(req.query.rating) : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const data = await reviewsService.listReviewsForAdmin({ page, limit, search, rating });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
