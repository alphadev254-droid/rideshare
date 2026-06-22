import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../../types/index.js";
import * as driversService from "../drivers/drivers.service.js";
import * as usersService from "../users/users.service.js";
import { getUploadUrl, getAvatarUrl } from "../../lib/file-upload.js";
import { canAccessUpload, resolveUploadFilePath } from "../../lib/upload-access.js";
import { AppError } from "../../middleware/error-handler.js";

const DOCUMENT_TYPES = ["id_front", "id_back", "license_doc"] as const;
type DocumentType = (typeof DOCUMENT_TYPES)[number];

const fieldMap: Record<DocumentType, string> = {
  id_front: "idFrontUrl",
  id_back: "idBackUrl",
  license_doc: "licenseDocUrl",
};

export async function uploadDriverDocumentController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: "No file provided" });
      return;
    }

    const docType = req.body.type as DocumentType | undefined;
    if (!docType || !DOCUMENT_TYPES.includes(docType)) {
      res.status(400).json({
        success: false,
        error: `Invalid document type. Must be one of: ${DOCUMENT_TYPES.join(", ")}`,
      });
      return;
    }

    const url = getUploadUrl(req.file.filename);
    const dbField = fieldMap[docType];
    const data = await driversService.uploadDriverDocuments(req.user!.sub, {
      [dbField]: url,
    });
    res.json({ success: true, data: { url, ...data } });
  } catch (err) {
    next(err);
  }
}

export async function uploadProfilePhotoController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: "No file provided" });
      return;
    }

    const url = getAvatarUrl(req.file.filename);
    const data = await driversService.updateProfilePhoto(req.user!.sub, url);
    res.json({ success: true, data: { url, ...data } });
  } catch (err) {
    next(err);
  }
}

export async function uploadUserAvatarController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: "No file provided" });
      return;
    }
    const url = getAvatarUrl(req.file.filename);
    const data = await usersService.updateUserProfilePhoto(req.user!.sub, url);
    res.json({ success: true, data: { url, ...data } });
  } catch (err) {
    next(err);
  }
}

export async function serveUploadController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uploadPath = req.query.path;
    if (typeof uploadPath !== "string" || !uploadPath) {
      throw new AppError(400, "Missing upload path");
    }

    const allowed = await canAccessUpload(req.user!.sub, req.user!.role, uploadPath);
    if (!allowed) throw new AppError(403, "Forbidden");

    const filePath = resolveUploadFilePath(uploadPath);
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
}
