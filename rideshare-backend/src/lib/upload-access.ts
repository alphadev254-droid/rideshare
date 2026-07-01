import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { prisma } from "../config/prisma.js";
import { AppError } from "../middleware/error-handler.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(moduleDir, "../..");
const PRIMARY_UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? path.join(backendRoot, "uploads"));

function getUploadDirs(): string[] {
  const dirs = [PRIMARY_UPLOAD_DIR, path.resolve(process.cwd(), "uploads")];
  return [...new Set(dirs)];
}

function isInsideDir(filePath: string, dir: string): boolean {
  const relative = path.relative(dir, filePath);
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveExistingFile(relative: string): string | null {
  for (const uploadDir of getUploadDirs()) {
    const filePath = path.resolve(uploadDir, relative);
    if (!isInsideDir(filePath, uploadDir)) continue;
    if (fs.existsSync(filePath)) return filePath;
  }

  return null;
}

export function resolveUploadFilePath(uploadPath: string): string {
  if (!uploadPath.startsWith("/uploads/")) {
    throw new AppError(400, "Invalid upload path");
  }

  const relative = uploadPath.replace(/^\/uploads\//, "");
  if (!relative || relative.includes("..")) {
    throw new AppError(400, "Invalid upload path");
  }

  const directFilePath = resolveExistingFile(relative);
  if (directFilePath) return directFilePath;

  if (relative.startsWith("avatars/")) {
    const legacyDocumentPath = path.join("documents", path.basename(relative));
    const legacyFilePath = resolveExistingFile(legacyDocumentPath);
    if (legacyFilePath) return legacyFilePath;
  }

  throw new AppError(404, "File not found");
}

export async function canAccessUpload(
  userId: string,
  role: string,
  uploadPath: string,
): Promise<boolean> {
  if (!uploadPath.startsWith("/uploads/avatars/") && !uploadPath.startsWith("/uploads/documents/")) {
    return false;
  }

  if (role === "admin") return true;

  if (uploadPath.startsWith("/uploads/avatars/")) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profilePhotoUrl: true, driverProfile: { select: { profilePhotoUrl: true } } },
    });
    return (
      user?.profilePhotoUrl === uploadPath || user?.driverProfile?.profilePhotoUrl === uploadPath
    );
  }

  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    select: { idFrontUrl: true, idBackUrl: true, licenseDocUrl: true },
  });
  const isOwnDriverDocument =
    !!profile &&
    [profile.idFrontUrl, profile.idBackUrl, profile.licenseDocUrl]
      .filter(Boolean)
      .includes(uploadPath);
  if (isOwnDriverDocument) return true;

  const vehicleDocument = await prisma.vehicle.findFirst({
    where: { insuranceDocUrl: uploadPath },
    select: { driver: { select: { userId: true } } },
  });
  if (vehicleDocument?.driver.userId === userId) return true;

  const vehicleImage = await prisma.vehicleImage.findFirst({
    where: { url: uploadPath },
    select: {
      vehicle: {
        select: {
          driver: { select: { userId: true } },
          _count: {
            select: {
              trips: { where: { status: { in: ["scheduled", "boarding", "in_transit"] } } },
            },
          },
        },
      },
    },
  });
  if (!vehicleImage) return false;

  return vehicleImage.vehicle.driver.userId === userId || vehicleImage.vehicle._count.trips > 0;
}


export async function canPublicAccessUpload(uploadPath: string): Promise<boolean> {
  if (uploadPath.startsWith("/uploads/avatars/")) {
    const driverWithPublicTrip = await prisma.driverProfile.findFirst({
      where: {
        OR: [
          { profilePhotoUrl: uploadPath },
          { user: { profilePhotoUrl: uploadPath } },
        ],
        trips: { some: { status: { in: ["scheduled", "boarding", "in_transit"] } } },
      },
      select: { id: true },
    });

    return !!driverWithPublicTrip;
  }

  if (!uploadPath.startsWith("/uploads/documents/")) return false;

  const vehicleImage = await prisma.vehicleImage.findFirst({
    where: { url: uploadPath },
    select: {
      vehicle: {
        select: {
          _count: {
            select: {
              trips: { where: { status: { in: ["scheduled", "boarding", "in_transit"] } } },
            },
          },
        },
      },
    },
  });

  return (vehicleImage?.vehicle._count.trips ?? 0) > 0;
}
export async function assertDriverProfileEditable(userId: string): Promise<void> {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    select: { isApproved: true, reviewStatus: true },
  });
  if (!profile) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");
  if (profile.isApproved) throw new AppError(403, "Approved profile cannot be edited by driver");
  if (profile.reviewStatus === "pending") throw new AppError(403, "Profile is under review and cannot be edited");
}
