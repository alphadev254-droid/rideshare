import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { assertDriverProfileEditable } from "../../lib/upload-access.js";
import { enqueueNotification } from "../../jobs/queue.js";
import { driverApprovedEmail, driverApprovedText, driverChangesNeededEmail, driverChangesNeededText } from "../../lib/email-templates.js";
import type {
  AdminUpdateDriverProfileInput,
  RegisterDriverInput,
  AddVehicleInput,
  UploadDocumentsInput,
} from "./drivers.schemas.js";

async function attachVehicleImages<T extends { id: string; photoUrl?: string | null }>(
  vehicles: T[],
) {
  if (vehicles.length === 0) return vehicles.map((vehicle) => ({ ...vehicle, imageUrls: [] }));
  const ids = vehicles.map((vehicle) => vehicle.id);
  const rows = await prisma.vehicleImage.findMany({
    where: { vehicleId: { in: ids } },
    select: { vehicleId: true, url: true },
    orderBy: { createdAt: "asc" },
  });
  return vehicles.map((vehicle) => ({
    ...vehicle,
    imageUrls: rows
      .filter((row) => row.vehicleId === vehicle.id)
      .map((row) => row.url),
  }));
}

function vehicleData(input: AddVehicleInput) {
  return {
    make: input.make,
    model: input.model,
    year: input.year,
    plateNumber: input.plateNumber,
    cofNumber: input.cofNumber,
    cofExpiry: input.cofExpiry ? new Date(input.cofExpiry) : undefined,
    insuranceCategory: input.insuranceCategory,
    insuranceExpiry: input.insuranceExpiry ? new Date(input.insuranceExpiry) : undefined,
    insuranceDocUrl: input.insuranceDocUrl,
    color: input.color,
    comfortClass: input.comfortClass,
    seatCapacity: input.seatCapacity,
  };
}

function vehicleComplianceComplete(vehicle: {
  cofNumber: string | null;
  cofExpiry: Date | null;
  insuranceCategory: unknown | null;
  insuranceExpiry: Date | null;
  insuranceDocUrl: string | null;
}) {
  return !!(
    vehicle.cofNumber &&
    vehicle.cofExpiry &&
    vehicle.insuranceCategory &&
    vehicle.insuranceExpiry &&
    vehicle.insuranceDocUrl
  );
}

function isProfileComplete(profile: {
  licenseNumber: string;
  licenseExpiry: Date;
  profilePhotoUrl: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  licenseDocUrl: string | null;
  user?: { profilePhotoUrl: string | null } | null;
}) {
  const photo = profile.profilePhotoUrl ?? profile.user?.profilePhotoUrl;
  return (
    profile.licenseNumber.length >= 4 &&
    !!profile.licenseExpiry &&
    !!photo &&
    !!profile.idFrontUrl &&
    !!profile.idBackUrl &&
    !!profile.licenseDocUrl
  );
}

export async function registerDriver(userId: string, input: RegisterDriverInput) {
  const existing = await prisma.driverProfile.findUnique({ where: { userId } });
  if (existing) await assertDriverProfileEditable(userId);

  const [profile] = await prisma.$transaction([
    prisma.driverProfile.upsert({
      where: { userId },
      create: { userId, licenseNumber: input.licenseNumber, licenseExpiry: new Date(input.licenseExpiry) },
      update: { licenseNumber: input.licenseNumber, licenseExpiry: new Date(input.licenseExpiry) },
      select: { id: true, userId: true, licenseNumber: true, licenseExpiry: true, isApproved: true },
    }),
    prisma.user.update({ where: { id: userId }, data: { role: "driver" } }),
  ]);
  return profile;
}

export async function addVehicle(userId: string, input: AddVehicleInput) {
  const driver = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!driver) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");

  const vehicle = await prisma.vehicle.create({
    data: {
      driverId: driver.id,
      ...vehicleData(input),
    },
  });
  return { ...vehicle, imageUrls: [] };
}

export async function updateVehicle(userId: string, vehicleId: string, input: AddVehicleInput) {
  const driver = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!driver) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");

  const existing = await prisma.vehicle.findFirst({
    where: { id: vehicleId, driverId: driver.id, isActive: true },
  });
  if (!existing) throw new AppError(404, "Vehicle not found");

  const vehicle = await prisma.vehicle.update({
    where: { id: vehicleId },
    data: vehicleData(input),
  });
  const [withImages] = await attachVehicleImages([vehicle]);
  return withImages;
}

export async function deleteVehicle(userId: string, vehicleId: string) {
  const driver = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!driver) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, driverId: driver.id, isActive: true },
  });
  if (!vehicle) throw new AppError(404, "Vehicle not found");
  await prisma.vehicle.update({ where: { id: vehicleId }, data: { isActive: false } });
  return { id: vehicleId, deleted: true };
}

export async function getMyVehicles(userId: string) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
    select: { id: true, vehicles: { where: { isActive: true } } },
  });
  if (!driver) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");
  return attachVehicleImages(driver.vehicles);
}

export async function addVehicleImage(userId: string, vehicleId: string, url: string) {
  const driver = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!driver) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, driverId: driver.id, isActive: true },
  });
  if (!vehicle) throw new AppError(404, "Vehicle not found");

  const imageCount = await prisma.vehicleImage.count({ where: { vehicleId } });
  if (imageCount >= 4) {
    throw new AppError(400, "A vehicle can have a maximum of 4 images");
  }

  await prisma.vehicleImage.create({ data: { vehicleId, url } });
  const [withImages] = await attachVehicleImages([vehicle]);
  return withImages;
}

export async function removeVehicleImage(userId: string, vehicleId: string, url: string) {
  const driver = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!driver) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, driverId: driver.id, isActive: true },
  });
  if (!vehicle) throw new AppError(404, "Vehicle not found");
  await prisma.vehicleImage.deleteMany({ where: { vehicleId, url } });
  const [withImages] = await attachVehicleImages([vehicle]);
  return withImages;
}

export async function updateVehicleInsuranceDocument(userId: string, vehicleId: string, url: string | null) {
  const driver = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!driver) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, driverId: driver.id, isActive: true },
  });
  if (!vehicle) throw new AppError(404, "Vehicle not found");

  const updated = await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { insuranceDocUrl: url },
  });
  const [withImages] = await attachVehicleImages([updated]);
  return withImages;
}

export async function addVehicleAdmin(driverId: string, input: AddVehicleInput) {
  const driver = await prisma.driverProfile.findUnique({ where: { id: driverId } });
  if (!driver) throw new AppError(404, "Driver not found");
  const vehicle = await prisma.vehicle.create({
    data: {
      driverId,
      ...vehicleData(input),
    },
  });
  return { ...vehicle, imageUrls: [] };
}

export async function updateVehicleAdmin(driverId: string, vehicleId: string, input: AddVehicleInput) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, driverId, isActive: true },
  });
  if (!vehicle) throw new AppError(404, "Vehicle not found");
  const updated = await prisma.vehicle.update({
    where: { id: vehicleId },
    data: vehicleData(input),
  });
  const [withImages] = await attachVehicleImages([updated]);
  return withImages;
}

export async function deleteVehicleAdmin(driverId: string, vehicleId: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, driverId, isActive: true },
  });
  if (!vehicle) throw new AppError(404, "Vehicle not found");
  await prisma.vehicle.update({ where: { id: vehicleId }, data: { isActive: false } });
  return { id: vehicleId, deleted: true };
}

export async function addVehicleImageAdmin(driverId: string, vehicleId: string, url: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, driverId, isActive: true },
  });
  if (!vehicle) throw new AppError(404, "Vehicle not found");
  const imageCount = await prisma.vehicleImage.count({ where: { vehicleId } });
  if (imageCount >= 4) {
    throw new AppError(400, "A vehicle can have a maximum of 4 images");
  }
  await prisma.vehicleImage.create({ data: { vehicleId, url } });
  const [withImages] = await attachVehicleImages([vehicle]);
  return withImages;
}

export async function removeVehicleImageAdmin(driverId: string, vehicleId: string, url: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, driverId, isActive: true },
  });
  if (!vehicle) throw new AppError(404, "Vehicle not found");
  await prisma.vehicleImage.deleteMany({ where: { vehicleId, url } });
  const [withImages] = await attachVehicleImages([vehicle]);
  return withImages;
}

export async function updateVehicleInsuranceDocumentAdmin(driverId: string, vehicleId: string, url: string | null) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, driverId, isActive: true },
  });
  if (!vehicle) throw new AppError(404, "Vehicle not found");

  const updated = await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { insuranceDocUrl: url },
  });
  const [withImages] = await attachVehicleImages([updated]);
  return withImages;
}

export async function getMyEarnings(userId: string) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
    select: {
      isApproved: true,
      totalEarningsMwk: true,
      totalTrips: true,
      wallet: { select: { balanceMwk: true, totalEarnedMwk: true } },
    },
  });
  if (!driver || !driver.isApproved) {
    throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");
  }
  return driver;
}

export async function getDriverProfile(userId: string) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    include: { user: { select: { id: true, fullName: true, phone: true, rating: true, profilePhotoUrl: true } } },
  });
  if (!profile) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");
  return formatDriverProfile(profile);
}

function formatDriverProfile(
  profile: {
    user: { id: string; fullName: string; phone: string; rating: unknown; profilePhotoUrl: string | null };
  } & Record<string, unknown>,
) {
  const { user, ...rest } = profile;
  return {
    ...rest,
    totalEarningsMwk: (rest.totalEarningsMwk as bigint | null)?.toString() ?? "0",
    rating: user.rating?.toString() ?? null,
    profilePhotoUrl: (rest.profilePhotoUrl as string | null) ?? user.profilePhotoUrl,
    user: { id: user.id, fullName: user.fullName, phone: user.phone, profilePhotoUrl: user.profilePhotoUrl },
  };
}

export async function getDriverProfileById(driverId: string) {
  const profile = await prisma.driverProfile.findUnique({
    where: { id: driverId },
    include: {
      user: { select: { id: true, fullName: true, phone: true, rating: true, profilePhotoUrl: true } },
      vehicles: true,
    },
  });
  if (!profile) throw new AppError(404, "Driver not found");
  const vehicles = await attachVehicleImages(profile.vehicles);
  return formatDriverProfile({ ...profile, vehicles });
}

export async function updateProfilePhoto(userId: string, url: string) {
  await assertDriverProfileEditable(userId);
  const profile = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");

  return prisma.driverProfile.update({
    where: { userId },
    data: { profilePhotoUrl: url },
    select: { id: true, profilePhotoUrl: true },
  });
}

export async function uploadDriverDocuments(userId: string, input: UploadDocumentsInput) {
  await assertDriverProfileEditable(userId);
  const profile = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");

  const data: Record<string, string> = {};
  if (input.idFrontUrl) data.idFrontUrl = input.idFrontUrl;
  if (input.idBackUrl) data.idBackUrl = input.idBackUrl;
  if (input.licenseDocUrl) data.licenseDocUrl = input.licenseDocUrl;

  if (Object.keys(data).length === 0) throw new AppError(400, "No document URLs provided");

  return prisma.driverProfile.update({
    where: { userId },
    data,
    select: { id: true, idFrontUrl: true, idBackUrl: true, licenseDocUrl: true },
  });
}

export async function requestDriverReview(userId: string) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { profilePhotoUrl: true } },
    },
  });
  if (!profile) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");
  if (profile.isApproved) throw new AppError(400, "Driver is already approved");
  if (profile.reviewStatus === "pending") {
    return {
      id: profile.id,
      reviewStatus: profile.reviewStatus,
      reviewRequestedAt: profile.reviewRequestedAt,
      isApproved: profile.isApproved,
    };
  }

  if (!isProfileComplete({ ...profile, user: profile.user })) {
    throw new AppError(
      400,
      "Complete your license details, profile photo, and all required documents before requesting review",
    );
  }

  return prisma.driverProfile.update({
    where: { userId },
    data: { reviewStatus: "pending", reviewRequestedAt: new Date() },
    select: { id: true, reviewStatus: true, reviewRequestedAt: true, isApproved: true },
  });
}

export async function getDriverDashboard(userId: string) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
    select: { id: true, isApproved: true, totalTrips: true, totalEarningsMwk: true, wallet: { select: { balanceMwk: true } } },
  });
  if (!driver || !driver.isApproved) {
    throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");
  }

  const [pendingTrips, rating] = await Promise.all([
    prisma.trip.count({ where: { driverId: driver.id, status: { in: ["scheduled", "boarding"] } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { rating: true } }),
  ]);

  return {
    totalTrips: driver.totalTrips,
    totalEarningsMwk: driver.totalEarningsMwk.toString(),
    balanceMwk: driver.wallet?.balanceMwk?.toString() ?? "0",
    rating: rating?.rating?.toString() ?? null,
    pendingTrips,
  };
}

export async function listDrivers(page = 1, limit = 20, approved?: boolean) {
  const drivers = await prisma.driverProfile.findMany({
    where: {
      ...(approved === true ? { isApproved: true } : {}),
      ...(approved === false ? { isApproved: false, reviewRequestedAt: { not: null } } : {}),
    },
    include: {
      user: { select: { id: true, fullName: true, phone: true, rating: true, profilePhotoUrl: true } },
      vehicles: { where: { isActive: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });
  return Promise.all(drivers.map(async (d) => ({
    ...d,
    vehicles: await attachVehicleImages(d.vehicles),
    totalEarningsMwk: d.totalEarningsMwk?.toString() ?? "0",
  })));
}

export async function approveDriver(driverId: string) {
  try {
    return await prisma.driverProfile.update({
      where: { id: driverId },
      data: { isApproved: true, reviewStatus: "approved" },
      select: { id: true, isApproved: true, reviewStatus: true },
    });
  } catch {
    throw new AppError(404, "Driver not found");
  }
}

export async function updateDriverProfileAdmin(
  driverId: string,
  input: AdminUpdateDriverProfileInput,
) {
  const existing = await prisma.driverProfile.findUnique({
    where: { id: driverId },
    select: {
      isApproved: true,
      user: { select: { email: true, fullName: true } },
    },
  });
  if (!existing) throw new AppError(404, "Driver not found");

  const data: Record<string, unknown> = {};
  if (input.licenseNumber !== undefined) data.licenseNumber = input.licenseNumber;
  if (input.licenseExpiry !== undefined) data.licenseExpiry = new Date(input.licenseExpiry);
  if (input.profilePhotoUrl !== undefined) data.profilePhotoUrl = input.profilePhotoUrl;
  if (input.idFrontUrl !== undefined) data.idFrontUrl = input.idFrontUrl;
  if (input.idBackUrl !== undefined) data.idBackUrl = input.idBackUrl;
  if (input.licenseDocUrl !== undefined) data.licenseDocUrl = input.licenseDocUrl;
  if (input.isApproved !== undefined) data.isApproved = input.isApproved;
  if (input.reviewStatus !== undefined) data.reviewStatus = input.reviewStatus;
  if (input.reviewRequestedAt !== undefined) {
    data.reviewRequestedAt = input.reviewRequestedAt ? new Date(input.reviewRequestedAt) : null;
  }
  if (Object.keys(data).length === 0) throw new AppError(400, "No fields to update");

  try {
    const profile = await prisma.driverProfile.update({
      where: { id: driverId },
      data,
      include: {
        user: { select: { id: true, fullName: true, phone: true, rating: true, profilePhotoUrl: true } },
        vehicles: { where: { isActive: true } },
      },
    });
    const vehicles = await attachVehicleImages(profile.vehicles);
    if (
      input.isApproved !== undefined &&
      input.isApproved !== existing.isApproved &&
      existing.user.email &&
      input.notificationMessage
    ) {
      const isApproved = input.isApproved;
      const templateParams = {
        driverName: existing.user.fullName,
        message: input.notificationMessage,
      };

      await enqueueNotification({
        type: "email",
        to: existing.user.email,
        subject: isApproved
          ? "Your RideShare driver profile was approved"
          : "Your RideShare driver profile needs changes",
        text: isApproved
          ? driverApprovedText(templateParams)
          : driverChangesNeededText(templateParams),
        html: isApproved
          ? driverApprovedEmail(templateParams)
          : driverChangesNeededEmail(templateParams),
      });
    }
    return formatDriverProfile({ ...profile, vehicles });
  } catch {
    throw new AppError(404, "Driver not found");
  }
}

export async function toggleVehicleActiveAdmin(driverId: string, vehicleId: string, isActive: boolean) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, driverId, isActive: !isActive },
  });
  if (!vehicle) {
    // If not found with the opposite status, it may already be in that state or not exist
    const exists = await prisma.vehicle.findFirst({
      where: { id: vehicleId, driverId },
      select: { id: true, isActive: true },
    });
    if (!exists) throw new AppError(404, "Vehicle not found");
    return { id: vehicleId, isActive: exists.isActive, message: "Vehicle already in that state" };
  }

  const updated = await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { isActive },
    select: { id: true, isActive: true, make: true, model: true, plateNumber: true },
  });

  const [withImages] = await attachVehicleImages([updated]);
  return withImages;
}

export async function updateDriverProfileFileAdmin(
  driverId: string,
  field: "profilePhotoUrl" | "idFrontUrl" | "idBackUrl" | "licenseDocUrl",
  url: string | null,
) {
  try {
    const profile = await prisma.driverProfile.update({
      where: { id: driverId },
      data: { [field]: url },
      include: {
        user: { select: { id: true, fullName: true, phone: true, rating: true, profilePhotoUrl: true } },
        vehicles: { where: { isActive: true } },
      },
    });
    const vehicles = await attachVehicleImages(profile.vehicles);
    return formatDriverProfile({ ...profile, vehicles });
  } catch {
    throw new AppError(404, "Driver not found");
  }
}
