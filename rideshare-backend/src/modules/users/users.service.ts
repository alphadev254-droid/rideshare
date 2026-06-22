import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { enqueueNotification } from "../../jobs/queue.js";
import { adminCustomEmail, adminCustomText } from "../../lib/email-templates.js";
import type { SendUserEmailInput, UpdateMeInput, UpdateUserInput } from "./users.schemas.js";

const userPublicSelect = {
  id: true, phone: true, email: true, fullName: true, role: true,
  profilePhotoUrl: true, rating: true,
  emergencyContactName: true, emergencyContactPhone: true,
  isActive: true, createdAt: true,
} as const;

const adminUserSelect = {
  ...userPublicSelect,
  updatedAt: true,
  driverProfile: {
    select: {
      id: true,
      userId: true,
      licenseNumber: true,
      licenseExpiry: true,
      licenseDocUrl: true,
      profilePhotoUrl: true,
      idFrontUrl: true,
      idBackUrl: true,
      isApproved: true,
      reviewRequestedAt: true,
      totalTrips: true,
      totalEarningsMwk: true,
      createdAt: true,
      vehicles: {
        select: {
          id: true,
          driverId: true,
          make: true,
          model: true,
          year: true,
          plateNumber: true,
          color: true,
          comfortClass: true,
          seatCapacity: true,
          isActive: true,
          createdAt: true,
        },
      },
    },
  },
} as const;

async function attachAdminVehicleImages<T extends { id: string; photoUrl?: string | null }>(
  vehicles: T[] = [],
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
      .map((row) => row.url)
      .concat(vehicle.photoUrl ? [vehicle.photoUrl] : []),
  }));
}

async function formatAdminUser<T extends {
  rating?: unknown;
  driverProfile?: { totalEarningsMwk?: bigint | null; vehicles?: Array<{ id: string; photoUrl?: string | null }> } | null;
}>(
  user: T,
) {
  const vehicles = user.driverProfile?.vehicles
    ? await attachAdminVehicleImages(user.driverProfile.vehicles)
    : undefined;

  return {
    ...user,
    rating: user.rating?.toString() ?? null,
    driverProfile: user.driverProfile
      ? {
          ...user.driverProfile,
          totalEarningsMwk: user.driverProfile.totalEarningsMwk?.toString() ?? "0",
          ...(vehicles ? { vehicles } : {}),
        }
      : null,
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...userPublicSelect, emergencyContactPhone: true },
  });
  if (!user) throw new AppError(404, "User not found");
  return user;
}

export async function updateMe(userId: string, input: UpdateMeInput) {
  const data: Record<string, unknown> = {};
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.emergencyContactName !== undefined) data.emergencyContactName = input.emergencyContactName;
  if (input.emergencyContactPhone !== undefined) data.emergencyContactPhone = input.emergencyContactPhone;
  if (input.fcmToken !== undefined) data.fcmToken = input.fcmToken;
  if (Object.keys(data).length === 0) throw new AppError(400, "No fields to update");

  return prisma.user.update({
    where: { id: userId },
    data,
    select: { ...userPublicSelect, emergencyContactPhone: true },
  });
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: adminUserSelect,
  });
  if (!user) throw new AppError(404, "User not found");
  return formatAdminUser(user);
}

export async function listUsers({
  page = 1,
  limit = 70,
  search,
  role,
  active,
  driverProfileStatus,
}: {
  page?: number;
  limit?: number;
  search?: string;
  role?: "passenger" | "driver" | "admin";
  active?: boolean;
  driverProfileStatus?: "no_profile" | "not_submitted" | "pending" | "approved";
}) {
  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(active !== undefined ? { isActive: active } : {}),
    ...(driverProfileStatus ? { role: "driver" as const } : {}),
    ...(driverProfileStatus === "no_profile" ? { driverProfile: null } : {}),
    ...(driverProfileStatus === "not_submitted"
      ? { driverProfile: { is: { isApproved: false, reviewRequestedAt: null } } }
      : {}),
    ...(driverProfileStatus === "pending"
      ? { driverProfile: { is: { isApproved: false, reviewRequestedAt: { not: null } } } }
      : {}),
    ...(driverProfileStatus === "approved" ? { driverProfile: { is: { isApproved: true } } } : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const safePage = Math.max(page, 1);
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: adminUserSelect,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: await Promise.all(items.map(formatAdminUser)),
    total,
    page: safePage,
    limit: safeLimit,
  };
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const data: Record<string, unknown> = {};
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.email !== undefined) data.email = input.email;
  if (input.role !== undefined) data.role = input.role;
  if (input.emergencyContactName !== undefined) data.emergencyContactName = input.emergencyContactName;
  if (input.emergencyContactPhone !== undefined) data.emergencyContactPhone = input.emergencyContactPhone;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (Object.keys(data).length === 0) throw new AppError(400, "No fields to update");

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: adminUserSelect,
    });
    return formatAdminUser(user);
  } catch {
    throw new AppError(404, "User not found");
  }
}

export async function sendUserEmail(id: string, input: SendUserEmailInput) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, fullName: true },
  });
  if (!user) throw new AppError(404, "User not found");
  if (!user.email) throw new AppError(400, "User has no email address");

  await enqueueNotification({
    type: "email",
    to: user.email,
    subject: input.subject,
    text: adminCustomText({ subject: input.subject, message: input.message }),
    html: adminCustomEmail({ subject: input.subject, message: input.message }),
  });
  return { id: user.id, email: user.email, sent: true };
}

export async function setUserStatus(id: string, isActive: boolean) {
  try {
    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: adminUserSelect,
    });
    return formatAdminUser(user);
  } catch {
    throw new AppError(404, "User not found");
  }
}

export async function updateUserProfilePhoto(userId: string, url: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { profilePhotoUrl: url },
    select: { id: true, profilePhotoUrl: true },
  });
}

export async function deleteUser(id: string) {
  try {
    await prisma.user.delete({ where: { id } });
    return { id, deleted: true };
  } catch {
    throw new AppError(404, "User not found");
  }
}
