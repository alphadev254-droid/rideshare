import { z } from "zod";

export const initiatePaymentSchema = z.object({
  bookingId: z.string().uuid(),
  method: z.enum(["airtel_money", "tnm_mpamba", "visa", "mastercard", "bank_transfer"]).default("airtel_money"),
  callbackUrl: z.string().url().optional(),
  returnUrl: z.string().url().optional(),
});

export const initiateRidePaymentSchema = z.object({
  tripId: z.string().uuid(),
  boardingPoint: z.string().min(2),
  dropOffPoint: z.string().min(2).optional(),
  method: z.enum(["airtel_money", "tnm_mpamba", "visa", "mastercard", "bank_transfer"]).default("airtel_money"),
  callbackUrl: z.string().url().optional(),
  returnUrl: z.string().url().optional(),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type InitiateRidePaymentInput = z.infer<typeof initiateRidePaymentSchema>;
