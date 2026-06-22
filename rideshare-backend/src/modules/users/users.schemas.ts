import { z } from "zod";

export const updateMeSchema = z.object({
  fullName: z.string().min(2).max(255).optional(),
  emergencyContactName: z.string().min(2).max(255).optional(),
  emergencyContactPhone: z.string().min(7).max(20).optional(),
  fcmToken: z.string().optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2).max(255).optional(),
  phone: z.string().min(7).max(20).optional(),
  email: z.string().email().nullable().optional(),
  role: z.enum(["passenger", "driver", "admin"]).optional(),
  emergencyContactName: z.string().min(2).max(255).nullable().optional(),
  emergencyContactPhone: z.string().min(7).max(20).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const sendUserEmailSchema = z.object({
  subject: z.string().min(2).max(255),
  message: z.string().min(2).max(5000),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type SendUserEmailInput = z.infer<typeof sendUserEmailSchema>;
