import { z } from "zod";

const travelerNameSchema = z.string().trim().min(2).max(255);

export const initiatePaymentSchema = z.object({
  bookingId: z.string().uuid(),
  method: z.enum(["airtel_money", "tnm_mpamba", "visa", "mastercard", "bank_transfer"]).default("airtel_money"),
  callbackUrl: z.string().url().optional(),
  returnUrl: z.string().url().optional(),
});

export const initiateRidePaymentSchema = z.object({
  tripId: z.string().uuid(),
  segmentId: z.string().uuid().optional(),
  boardingPoint: z.string().min(2),
  dropOffPoint: z.string().min(2).optional(),
  method: z.enum(["airtel_money", "tnm_mpamba", "visa", "mastercard", "bank_transfer"]).default("airtel_money"),
  seatsBooked: z.coerce.number().int().min(1).max(50).default(1),
  travelerNames: z.array(travelerNameSchema).max(50).optional().default([]),
  callbackUrl: z.string().url().optional(),
  returnUrl: z.string().url().optional(),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type InitiateRidePaymentInput = z.infer<typeof initiateRidePaymentSchema>;
