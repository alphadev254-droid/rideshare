import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../../types/index.js";
import * as tripsService from "./trips.service.js";
import type {
  AdminTripInput,
  CreateTripInput,
  SearchTripsInput,
  UpdateTripInput,
  UpdateTripStatusInput,
  LocationUpdateInput,
  AuthenticateCodeInput,
} from "./trips.schemas.js";

export async function getDriverTripsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await tripsService.getDriverTrips(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function startTripController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await tripsService.startTrip(req.params.id, req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function cancelTripController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await tripsService.cancelTrip(req.params.id, req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createTripController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await tripsService.createTrip(req.user!.sub, req.body as CreateTripInput);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateTripController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await tripsService.updateTrip(
      req.user!.sub,
      req.params.id,
      req.body as UpdateTripInput,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function searchTripsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await tripsService.searchTrips(req.query as unknown as SearchTripsInput);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listPublicTripsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const data = await tripsService.listPublicTrips(page, limit, {
      originName: req.query.originName ? String(req.query.originName) : undefined,
      destName: req.query.destName ? String(req.query.destName) : undefined,
      date: req.query.date ? String(req.query.date) : undefined,
      seats: req.query.seats ? Number(req.query.seats) : undefined,
      comfortClass: req.query.comfortClass ? String(req.query.comfortClass) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getTripController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await tripsService.getTripById(req.params.id, req.user?.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateTripStatusController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await tripsService.updateTripStatus(
      req.params.id,
      req.user!.sub,
      req.body as UpdateTripStatusInput,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateLocationController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await tripsService.updateLocation(
      req.params.id,
      req.user!.sub,
      req.body as LocationUpdateInput,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getTripLocationController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await tripsService.getTripLocation(req.params.id, req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function authenticateCodeController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const clientIp = req.ip ?? "unknown";
    const data = await tripsService.authenticatePassenger(
      req.params.id,
      req.user!.sub,
      req.body as AuthenticateCodeInput,
      clientIp,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function completeTripController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await tripsService.completeTrip(req.params.id, req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listTripsAdminController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const data = await tripsService.listTripsAdmin(page, limit, {
      status,
      search,
      dateFrom,
      dateTo,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createTripAdminController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await tripsService.createTripAdmin(req.body as AdminTripInput);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateTripAdminController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await tripsService.updateTripAdmin(req.params.id, req.body as AdminTripInput);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateTripStatusAdminController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await tripsService.updateTripStatusAdmin(
      req.params.id,
      req.body as UpdateTripStatusInput,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteTripAdminController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await tripsService.deleteTripAdmin(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
