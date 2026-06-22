import { z } from "zod";

export const createBookingSchema = z.object({
  tripId: z.string().uuid(),
  boardingPoint: z.string().min(2).max(255),
  boardingLat: z.coerce.number().optional(),
  boardingLng: z.coerce.number().optional(),
  dropOffPoint: z.string().max(255).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
