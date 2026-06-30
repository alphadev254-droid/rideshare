import { z } from "zod";

const tripStopInputSchema = z.object({
  name: z.string().trim().min(2).max(255),
  pickupPoint: z.string().trim().max(255).optional(),
  dropOffPoint: z.string().trim().max(255).optional(),
  arrivalOffsetMinutes: z.coerce.number().int().min(0).max(4320).optional(),
  departureOffsetMinutes: z.coerce.number().int().min(0).max(4320).optional(),
});

const tripSegmentInputSchema = z.object({
  fromStopIndex: z.coerce.number().int().min(0).max(50),
  toStopIndex: z.coerce.number().int().min(1).max(51),
  farePerSeatMwk: z.coerce.number().int().min(1).max(10_000_000),
  maxSeats: z.coerce.number().int().min(1).max(50).optional(),
  distanceKm: z.coerce.number().min(0).optional(),
  estimatedDurationMinutes: z.coerce.number().int().min(1).max(4320).optional(),
  isEnabled: z.coerce.boolean().optional().default(true),
});

export const createTripSchema = z.object({
  vehicleId: z.string().uuid(),
  originName: z.string().min(2).max(255),
  pickupPoint: z.string().max(255).optional(),
  originLat: z.coerce.number().min(-90).max(90).optional().default(0),
  originLng: z.coerce.number().min(-180).max(180).optional().default(0),
  destinationName: z.string().min(2).max(255),
  dropOffPoint: z.string().max(255).optional(),
  destinationLat: z.coerce.number().min(-90).max(90).optional().default(0),
  destinationLng: z.coerce.number().min(-180).max(180).optional().default(0),
  departureTime: z.string(),
  totalSeats: z.coerce.number().int().min(1).max(50),
  comfortClass: z.enum(["economy", "standard", "comfort"]).optional().default("economy"),
  distanceKm: z.coerce.number().optional(),
  estimatedDurationMinutes: z.coerce.number().int().min(1).max(4320),
  farePerSeatMwk: z.coerce.number().int().min(1).max(10_000_000),
  stops: z.array(tripStopInputSchema).max(20).optional().default([]),
  segments: z.array(tripSegmentInputSchema).max(231).optional().default([]),
});

export const updateTripSchema = createTripSchema;
export const adminTripSchema = createTripSchema.extend({
  driverId: z.string().uuid(),
  pickupPoint: z.string().max(255).optional(),
});

export const searchTripsSchema = z.object({
  originName: z.string().min(1).optional(),
  destName: z.string().min(1).optional(),
  originLat: z.coerce.number().optional(),
  originLng: z.coerce.number().optional(),
  destLat: z.coerce.number().optional(),
  destLng: z.coerce.number().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  seats: z.coerce.number().int().min(1).default(1),
  comfortClass: z.enum(["economy", "standard", "comfort"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const tripLocationSearchSchema = z.object({
  type: z.enum(["origin", "destination"]),
  q: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export const updateTripStatusSchema = z.object({
  status: z.enum(["boarding", "in_transit", "completed", "cancelled"]),
});

export const locationUpdateSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const authenticateCodeSchema = z.object({
  bookingId: z.string().uuid(),
  code: z.string().length(6),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type AdminTripInput = z.infer<typeof adminTripSchema>;
export type SearchTripsInput = z.infer<typeof searchTripsSchema>;
export type TripLocationSearchInput = z.infer<typeof tripLocationSearchSchema>;
export type UpdateTripStatusInput = z.infer<typeof updateTripStatusSchema>;
export type LocationUpdateInput = z.infer<typeof locationUpdateSchema>;
export type AuthenticateCodeInput = z.infer<typeof authenticateCodeSchema>;
