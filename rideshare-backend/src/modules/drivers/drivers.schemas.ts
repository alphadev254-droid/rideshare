import { z } from "zod";

export const registerDriverSchema = z.object({
  licenseNumber: z.string().min(4).max(50),
  licenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD"),
});

export const addVehicleSchema = z.object({
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1),
  plateNumber: z.string().min(3).max(20),
  cofNumber: z.string().min(1).max(80).optional(),
  cofExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD").optional(),
  insuranceCategory: z.enum(["third_party", "comprehensive"]).optional(),
  insuranceExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD").optional(),
  insuranceDocUrl: z.string().url().nullable().optional(),
  color: z.string().max(50).optional(),
  comfortClass: z.enum(["economy", "standard", "comfort"]),
  seatCapacity: z.coerce.number().int().min(2).max(30),
});

export const uploadDocumentsSchema = z.object({
  idFrontUrl: z.string().url().optional(),
  idBackUrl: z.string().url().optional(),
  licenseDocUrl: z.string().url().optional(),
});

export const adminUpdateDriverProfileSchema = z.object({
  licenseNumber: z.string().min(4).max(50).optional(),
  licenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD").optional(),
  profilePhotoUrl: z.string().nullable().optional(),
  idFrontUrl: z.string().nullable().optional(),
  idBackUrl: z.string().nullable().optional(),
  licenseDocUrl: z.string().nullable().optional(),
  isApproved: z.boolean().optional(),
  reviewStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  reviewRequestedAt: z.string().datetime().nullable().optional(),
  approvalReason: z.string().max(1000).optional(),
  notificationMessage: z.string().max(5000).optional(),
});

export type RegisterDriverInput = z.infer<typeof registerDriverSchema>;
export type AddVehicleInput = z.infer<typeof addVehicleSchema>;
export type UploadDocumentsInput = z.infer<typeof uploadDocumentsSchema>;
export type AdminUpdateDriverProfileInput = z.infer<typeof adminUpdateDriverProfileSchema>;
