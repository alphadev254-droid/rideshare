import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../../types/index.js";
import * as bookingsService from "./bookings.service.js";
import type { CreateBookingInput } from "./bookings.schemas.js";

export async function getTripBookingsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await bookingsService.getTripBookings(req.params.tripId, req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function verifyCodeController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await bookingsService.verifyBoardingCode(
      req.params.id,
      req.user!.sub,
      req.body.code as string,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createBookingController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await bookingsService.createBooking(req.user!.sub, req.body as CreateBookingInput);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getBookingController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await bookingsService.getBookingById(req.params.id, req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function resendCodeController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await bookingsService.resendCode(req.params.id, req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function cancelBookingController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await bookingsService.cancelBooking(req.params.id, req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getRefundPreviewController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await bookingsService.getRefundPreview(req.params.id, req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function requestRefundController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await bookingsService.requestBookingRefund(
      req.params.id,
      req.user!.sub,
      typeof req.body.reason === "string" ? req.body.reason : undefined,
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getMyBookingsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const data = await bookingsService.getMyBookings(req.user!.sub, page, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listAdminBookingsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 70;
    const data = await bookingsService.listAdminBookings({
      page,
      limit,
      status: req.query.status as string | undefined,
      paymentStatus: req.query.paymentStatus as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
