import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../../types/index.js";
import * as driversService from "./drivers.service.js";
import { getAvatarUrl, getUploadUrl } from "../../lib/file-upload.js";
import { AppError } from "../../middleware/error-handler.js";
import type {
  AdminUpdateDriverProfileInput,
  RegisterDriverInput,
  AddVehicleInput,
  UploadDocumentsInput,
} from "./drivers.schemas.js";

export async function getDriverProfileController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await driversService.getDriverProfile(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getDriverByIdController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await driversService.getDriverProfileById(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getDashboardController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await driversService.getDriverDashboard(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function registerDriverController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await driversService.registerDriver(
      req.user!.sub,
      req.body as RegisterDriverInput,
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function addVehicleController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = {
      ...(req.body as AddVehicleInput),
      ...(req.file ? { insuranceDocUrl: getUploadUrl(req.file.filename) } : {}),
    } as AddVehicleInput;
    const data = await driversService.addVehicle(
      req.user!.sub,
      body,
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateVehicleController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = {
      ...(req.body as AddVehicleInput),
      ...(req.file ? { insuranceDocUrl: getUploadUrl(req.file.filename) } : {}),
    } as AddVehicleInput;
    const data = await driversService.updateVehicle(
      req.user!.sub,
      req.params.id,
      body,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteVehicleController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await driversService.deleteVehicle(req.user!.sub, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getMyVehiclesController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await driversService.getMyVehicles(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function uploadVehicleImageController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) throw new AppError(400, "No file uploaded");
    const data = await driversService.addVehicleImage(
      req.user!.sub,
      req.params.id,
      getUploadUrl(req.file.filename),
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function removeVehicleImageController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const url = typeof req.body?.url === "string" ? req.body.url : "";
    if (!url) throw new AppError(400, "Image url is required");
    const data = await driversService.removeVehicleImage(req.user!.sub, req.params.id, url);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function uploadVehicleInsuranceDocumentController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) throw new AppError(400, "No file uploaded");
    const url = getUploadUrl(req.file.filename);
    const data = await driversService.updateVehicleInsuranceDocument(
      req.user!.sub,
      req.params.id,
      url,
    );
    res.json({ success: true, data: { url, vehicle: data } });
  } catch (err) {
    next(err);
  }
}

export async function removeVehicleInsuranceDocumentController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await driversService.updateVehicleInsuranceDocument(req.user!.sub, req.params.id, null);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function addVehicleAdminController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = {
      ...(req.body as AddVehicleInput),
      ...(req.file ? { insuranceDocUrl: getUploadUrl(req.file.filename) } : {}),
    } as AddVehicleInput;
    const data = await driversService.addVehicleAdmin(req.params.id, body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateVehicleAdminController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = {
      ...(req.body as AddVehicleInput),
      ...(req.file ? { insuranceDocUrl: getUploadUrl(req.file.filename) } : {}),
    } as AddVehicleInput;
    const data = await driversService.updateVehicleAdmin(
      req.params.id,
      req.params.vehicleId,
      body,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteVehicleAdminController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await driversService.deleteVehicleAdmin(req.params.id, req.params.vehicleId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function uploadVehicleImageAdminController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) throw new AppError(400, "No file uploaded");
    const data = await driversService.addVehicleImageAdmin(
      req.params.id,
      req.params.vehicleId,
      getUploadUrl(req.file.filename),
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function removeVehicleImageAdminController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const url = typeof req.body?.url === "string" ? req.body.url : "";
    if (!url) throw new AppError(400, "Image url is required");
    const data = await driversService.removeVehicleImageAdmin(
      req.params.id,
      req.params.vehicleId,
      url,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function uploadVehicleInsuranceDocumentAdminController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) throw new AppError(400, "No file uploaded");
    const url = getUploadUrl(req.file.filename);
    const data = await driversService.updateVehicleInsuranceDocumentAdmin(
      req.params.id,
      req.params.vehicleId,
      url,
    );
    res.json({ success: true, data: { url, vehicle: data } });
  } catch (err) {
    next(err);
  }
}

export async function removeVehicleInsuranceDocumentAdminController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await driversService.updateVehicleInsuranceDocumentAdmin(
      req.params.id,
      req.params.vehicleId,
      null,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getMyEarningsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await driversService.getMyEarnings(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listDriversController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const approved =
      req.query.approved !== undefined
        ? req.query.approved === "true"
        : undefined;
    const data = await driversService.listDrivers(page, limit, approved);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function uploadDocumentsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await driversService.uploadDriverDocuments(
      req.user!.sub,
      req.body as UploadDocumentsInput,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function requestReviewController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await driversService.requestDriverReview(req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function approveDriverController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await driversService.approveDriver(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateDriverProfileAdminController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await driversService.updateDriverProfileAdmin(
      req.params.id,
      req.body as AdminUpdateDriverProfileInput,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

const adminDocFieldMap = {
  id_front: "idFrontUrl",
  id_back: "idBackUrl",
  license_doc: "licenseDocUrl",
} as const;

export async function uploadDriverProfilePhotoAdminController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) throw new AppError(400, "No file provided");
    const url = getAvatarUrl(req.file.filename);
    const data = await driversService.updateDriverProfileFileAdmin(
      req.params.id,
      "profilePhotoUrl",
      url,
    );
    res.json({ success: true, data: { url, profile: data } });
  } catch (err) {
    next(err);
  }
}

export async function uploadDriverDocumentAdminController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) throw new AppError(400, "No file provided");
    const type = req.body.type as keyof typeof adminDocFieldMap | undefined;
    if (!type || !(type in adminDocFieldMap)) {
      throw new AppError(400, "Invalid document type");
    }

    const url = getUploadUrl(req.file.filename);
    const data = await driversService.updateDriverProfileFileAdmin(
      req.params.id,
      adminDocFieldMap[type],
      url,
    );
    res.json({ success: true, data: { url, profile: data } });
  } catch (err) {
    next(err);
  }
}

export async function removeDriverProfileFileAdminController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const field = req.body.field as
      | "profilePhotoUrl"
      | "idFrontUrl"
      | "idBackUrl"
      | "licenseDocUrl"
      | undefined;
    if (
      field !== "profilePhotoUrl" &&
      field !== "idFrontUrl" &&
      field !== "idBackUrl" &&
      field !== "licenseDocUrl"
    ) {
      throw new AppError(400, "Invalid file field");
    }
    const data = await driversService.updateDriverProfileFileAdmin(req.params.id, field, null);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

function parseVehicleReviewStatus(body: unknown): "pending" | "approved" | "rejected" {
  const payload = body as { reviewStatus?: unknown; isActive?: unknown } | null;
  if (payload?.reviewStatus === "pending" || payload?.reviewStatus === "approved" || payload?.reviewStatus === "rejected") {
    return payload.reviewStatus;
  }

  if (typeof payload?.isActive === "boolean") return payload.isActive ? "approved" : "rejected";
  if (typeof payload?.isActive === "string") return payload.isActive.toLowerCase() === "true" ? "approved" : "rejected";

  throw new AppError(400, "Vehicle review status is required");
}

export async function reviewVehicleAdminController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const driverId = req.params.id;
    const vehicleId = req.params.vehicleId;
    const reviewStatus = parseVehicleReviewStatus(req.body);
    const data = await driversService.reviewVehicleAdmin(driverId, vehicleId, reviewStatus);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function toggleVehicleActiveAdminController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  return reviewVehicleAdminController(req, res, next);
}
