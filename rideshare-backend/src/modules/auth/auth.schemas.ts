import { z } from "zod";

export const registerSchema = z.object({
  phone: z.string().min(7).max(20),
  email: z.string().email(),
  fullName: z.string().min(2).max(255),
  password: z.string().min(8),
  role: z.enum(["passenger", "driver"]).default("passenger"),
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(7).max(20),
  otp: z.string().length(6),
});

export const loginSchema = z.object({
  identifier: z.string().min(3).max(255),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(3).max(255),
});

export const resetPasswordSchema = z.object({
  identifier: z.string().min(3).max(255),
  otp: z.string().length(6),
  password: z.string().min(8),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
