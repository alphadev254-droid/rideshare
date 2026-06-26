import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import { getDistance } from "../../lib/maps.js";
import { verifyCode, isCodeExpired } from "../../lib/secret-code.js";
import { creditTripPayout } from "../wallet/wallet.service.js";
import { getTripLocationFromRedis } from "../../lib/trip-location-cache.js";
import { resolveReverseGeocodeForTrip } from "../../lib/mapbox-geocode.js";
import type {
  AdminTripInput,
  CreateTripInput,
  UpdateTripInput,
  SearchTripsInput,
  UpdateTripStatusInput,
  LocationUpdateInput,
  AuthenticateCodeInput,
} from "./trips.schemas.js";
import type { ComfortClass } from "../../types/index.js";

const TRIP_STATUSES = ["scheduled", "boarding", "in_transit", "completed", "cancelled"] as const;

export async function createTrip(userId: string, input: CreateTripInput) {
  const driver = await prisma.driverProfile.findFirst({
    where: { userId, isApproved: true },
  });
  if (!driver) {
    throw new AppError(403, "Driver profile not found or not approved", "DRIVER_NOT_ONBOARDED");
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: input.vehicleId, driverId: driver.id, reviewStatus: "approved" },
  });
  if (!vehicle) throw new AppError(400, "Selected vehicle is not approved by admin yet");

  const departureTime = new Date(input.departureTime);
  if (Number.isNaN(departureTime.getTime())) {
    throw new AppError(400, "Departure time is invalid");
  }
  if (departureTime <= new Date()) {
    throw new AppError(400, "Departure time must be in the future");
  }
  if (input.totalSeats > vehicle.seatCapacity) {
    throw new AppError(400, "Total seats cannot exceed the selected vehicle capacity");
  }

  const coordinateValues = [
    input.originLat,
    input.originLng,
    input.destinationLat,
    input.destinationLng,
  ];
  const hasAnyCoords = coordinateValues.some((value) => value !== 0);
  const hasAllCoords = coordinateValues.every((value) => value !== 0);
  if (hasAnyCoords && !hasAllCoords) {
    throw new AppError(400, "Provide both origin and destination coordinates, or use distance only");
  }

  const distanceKm = hasAllCoords
    ? (await getDistance(input.originLat, input.originLng, input.destinationLat, input.destinationLng)).distanceKm
    : input.distanceKm ?? 0;

  const comfortClass = vehicle.comfortClass as ComfortClass;
  const baseFareMwk = input.farePerSeatMwk;

  type TripRow = {
    id: string; origin_name: string; pickup_point: string | null; destination_name: string;
    departure_time: Date; available_seats: number; comfort_class: string;
    base_fare_mwk: bigint; distance_km: number; estimated_duration_minutes: number | null;
    status: string;
  };

  const rows = await prisma.$queryRaw<TripRow[]>`
    INSERT INTO trips (
      driver_id, vehicle_id, origin_name, pickup_point, origin_point, destination_name,
      destination_point, departure_time, total_seats, available_seats,
      comfort_class, distance_km, base_fare_mwk, estimated_duration_minutes
    ) VALUES (
      ${driver.id}::uuid, ${input.vehicleId}::uuid,
      ${input.originName},
      ${input.pickupPoint ?? null},
      ST_SetSRID(ST_MakePoint(${input.originLng}, ${input.originLat}), 4326),
      ${input.destinationName},
      ST_SetSRID(ST_MakePoint(${input.destinationLng}, ${input.destinationLat}), 4326),
      ${departureTime},
      ${input.totalSeats}, ${input.totalSeats},
      ${comfortClass}::"ComfortClass",
      ${distanceKm}, ${BigInt(baseFareMwk)}, ${input.estimatedDurationMinutes}
    )
    RETURNING id, origin_name, pickup_point, destination_name, departure_time,
              available_seats, comfort_class, base_fare_mwk, distance_km,
              estimated_duration_minutes, status`;

  const r = rows[0];
  return {
    id: r.id,
    status: r.status,
    originName: r.origin_name,
    pickupPoint: r.pickup_point ?? null,
    destinationName: r.destination_name,
    departureTime: r.departure_time,
    availableSeats: r.available_seats,
    totalSeats: input.totalSeats,
    comfortClass: r.comfort_class,
    distanceKm: Number(r.distance_km),
    estimatedDurationMinutes: r.estimated_duration_minutes,
    farePerSeatMwk: r.base_fare_mwk.toString(),
  };
}

export async function updateTrip(userId: string, tripId: string, input: UpdateTripInput) {
  const driver = await prisma.driverProfile.findFirst({
    where: { userId, isApproved: true },
  });
  if (!driver) {
    throw new AppError(403, "Driver profile not found or not approved", "DRIVER_NOT_ONBOARDED");
  }

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, driverId: driver.id },
    select: {
      id: true,
      status: true,
      totalSeats: true,
      availableSeats: true,
      startedAt: true,
    },
  });
  if (!trip) throw new AppError(404, "Trip not found or unauthorized");
  if (trip.startedAt || trip.status === "in_transit" || trip.status === "completed" || trip.status === "cancelled") {
    throw new AppError(400, "Only trips that have not started can be edited");
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: input.vehicleId, driverId: driver.id, reviewStatus: "approved" },
  });
  if (!vehicle) throw new AppError(400, "Selected vehicle is not approved by admin yet");

  const bookedSeats = trip.totalSeats - trip.availableSeats;
  if (input.totalSeats < bookedSeats) {
    throw new AppError(400, `Total seats cannot be lower than the ${bookedSeats} already booked`);
  }
  if (input.totalSeats > vehicle.seatCapacity) {
    throw new AppError(400, "Total seats cannot exceed the selected vehicle capacity");
  }

  const departureTime = new Date(input.departureTime);
  if (Number.isNaN(departureTime.getTime())) {
    throw new AppError(400, "Departure time is invalid");
  }
  if (departureTime <= new Date()) {
    throw new AppError(400, "Departure time must be in the future");
  }

  const coordinateValues = [
    input.originLat,
    input.originLng,
    input.destinationLat,
    input.destinationLng,
  ];
  const hasAnyCoords = coordinateValues.some((value) => value !== 0);
  const hasAllCoords = coordinateValues.every((value) => value !== 0);
  if (hasAnyCoords && !hasAllCoords) {
    throw new AppError(400, "Provide both origin and destination coordinates, or use distance only");
  }

  const distanceKm = hasAllCoords
    ? (await getDistance(input.originLat, input.originLng, input.destinationLat, input.destinationLng)).distanceKm
    : input.distanceKm ?? 0;
  const availableSeats = input.totalSeats - bookedSeats;

  type TripRow = {
    id: string; origin_name: string; pickup_point: string | null; destination_name: string;
    departure_time: Date; total_seats: number; available_seats: number;
    comfort_class: string; base_fare_mwk: bigint; distance_km: number;
    estimated_duration_minutes: number | null; status: string;
  };

  const rows = await prisma.$queryRaw<TripRow[]>`
    UPDATE trips
    SET vehicle_id = ${input.vehicleId}::uuid,
        origin_name = ${input.originName},
        pickup_point = ${input.pickupPoint ?? null},
        origin_point = ST_SetSRID(ST_MakePoint(${input.originLng}, ${input.originLat}), 4326),
        destination_name = ${input.destinationName},
        destination_point = ST_SetSRID(ST_MakePoint(${input.destinationLng}, ${input.destinationLat}), 4326),
        departure_time = ${departureTime},
        total_seats = ${input.totalSeats},
        available_seats = ${availableSeats},
        comfort_class = ${vehicle.comfortClass as ComfortClass}::"ComfortClass",
        distance_km = ${distanceKm},
        base_fare_mwk = ${BigInt(input.farePerSeatMwk)},
        estimated_duration_minutes = ${input.estimatedDurationMinutes},
        updated_at = now()
    WHERE id = ${tripId}::uuid AND driver_id = ${driver.id}::uuid
    RETURNING id, origin_name, pickup_point, destination_name, departure_time, total_seats,
              available_seats, comfort_class, base_fare_mwk, distance_km,
              estimated_duration_minutes, status`;

  const r = rows[0];
  return {
    id: r.id,
    status: r.status,
    originName: r.origin_name,
    pickupPoint: r.pickup_point ?? null,
    destinationName: r.destination_name,
    departureTime: r.departure_time,
    availableSeats: r.available_seats,
    totalSeats: r.total_seats,
    comfortClass: r.comfort_class,
    distanceKm: Number(r.distance_km),
    estimatedDurationMinutes: r.estimated_duration_minutes,
    farePerSeatMwk: r.base_fare_mwk.toString(),
  };
}

export async function createTripAdmin(input: AdminTripInput) {
  const driver = await prisma.driverProfile.findFirst({
    where: { id: input.driverId, isApproved: true },
  });
  if (!driver) throw new AppError(404, "Approved driver profile not found");

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: input.vehicleId, driverId: driver.id, reviewStatus: "approved" },
  });
  if (!vehicle) throw new AppError(400, "Selected vehicle is not approved by admin yet");

  const departureTime = new Date(input.departureTime);
  if (Number.isNaN(departureTime.getTime())) throw new AppError(400, "Departure time is invalid");
  if (departureTime <= new Date()) throw new AppError(400, "Departure time must be in the future");
  if (input.totalSeats > vehicle.seatCapacity) {
    throw new AppError(400, "Total seats cannot exceed the selected vehicle capacity");
  }

  const coordinateValues = [input.originLat, input.originLng, input.destinationLat, input.destinationLng];
  const hasAnyCoords = coordinateValues.some((value) => value !== 0);
  const hasAllCoords = coordinateValues.every((value) => value !== 0);
  if (hasAnyCoords && !hasAllCoords) {
    throw new AppError(400, "Provide all coordinates or leave all coordinates blank");
  }
  const distanceKm = hasAllCoords
    ? (await getDistance(input.originLat, input.originLng, input.destinationLat, input.destinationLng)).distanceKm
    : input.distanceKm ?? 0;

  type TripRow = {
    id: string; origin_name: string; destination_name: string;
    departure_time: Date; total_seats: number; available_seats: number;
    comfort_class: string; base_fare_mwk: bigint; distance_km: number;
    estimated_duration_minutes: number | null; status: string;
  };

  const rows = await prisma.$queryRaw<TripRow[]>`
    INSERT INTO trips (
      driver_id, vehicle_id, origin_name, pickup_point, origin_point, destination_name, destination_point,
      departure_time, total_seats, available_seats, comfort_class, distance_km, base_fare_mwk,
      estimated_duration_minutes
    )
    VALUES (
      ${driver.id}::uuid, ${input.vehicleId}::uuid,
      ${input.originName}, ${input.pickupPoint ?? null},
      ST_SetSRID(ST_MakePoint(${input.originLng}, ${input.originLat}), 4326),
      ${input.destinationName}, ST_SetSRID(ST_MakePoint(${input.destinationLng}, ${input.destinationLat}), 4326),
      ${departureTime}, ${input.totalSeats}, ${input.totalSeats},
      ${vehicle.comfortClass as ComfortClass}::"ComfortClass",
      ${distanceKm}, ${BigInt(input.farePerSeatMwk)}, ${input.estimatedDurationMinutes}
    )
    RETURNING id, origin_name, pickup_point, destination_name, departure_time, total_seats,
              available_seats, comfort_class, base_fare_mwk, distance_km,
              estimated_duration_minutes, status`;

  const r = rows[0];
  return {
    id: r.id,
    status: r.status,
    originName: r.origin_name,
    pickupPoint: (r as { pickup_point?: string | null }).pickup_point ?? null,
    destinationName: r.destination_name,
    departureTime: r.departure_time,
    availableSeats: r.available_seats,
    totalSeats: r.total_seats,
    comfortClass: r.comfort_class,
    distanceKm: Number(r.distance_km),
    estimatedDurationMinutes: r.estimated_duration_minutes,
    farePerSeatMwk: r.base_fare_mwk.toString(),
  };
}

export async function updateTripAdmin(tripId: string, input: AdminTripInput) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, totalSeats: true, availableSeats: true },
  });
  if (!trip) throw new AppError(404, "Trip not found");

  const driver = await prisma.driverProfile.findFirst({
    where: { id: input.driverId, isApproved: true },
  });
  if (!driver) throw new AppError(404, "Approved driver profile not found");

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: input.vehicleId, driverId: driver.id, reviewStatus: "approved" },
  });
  if (!vehicle) throw new AppError(400, "Selected vehicle is not approved by admin yet");

  const bookedSeats = trip.totalSeats - trip.availableSeats;
  if (input.totalSeats < bookedSeats) {
    throw new AppError(400, `Total seats cannot be lower than the ${bookedSeats} already booked`);
  }
  if (input.totalSeats > vehicle.seatCapacity) {
    throw new AppError(400, "Total seats cannot exceed the selected vehicle capacity");
  }

  const departureTime = new Date(input.departureTime);
  if (Number.isNaN(departureTime.getTime())) throw new AppError(400, "Departure time is invalid");

  const coordinateValues = [input.originLat, input.originLng, input.destinationLat, input.destinationLng];
  const hasAnyCoords = coordinateValues.some((value) => value !== 0);
  const hasAllCoords = coordinateValues.every((value) => value !== 0);
  if (hasAnyCoords && !hasAllCoords) {
    throw new AppError(400, "Provide all coordinates or leave all coordinates blank");
  }
  const distanceKm = hasAllCoords
    ? (await getDistance(input.originLat, input.originLng, input.destinationLat, input.destinationLng)).distanceKm
    : input.distanceKm ?? 0;
  const availableSeats = input.totalSeats - bookedSeats;

  type TripRow = {
    id: string; origin_name: string; destination_name: string;
    departure_time: Date; total_seats: number; available_seats: number;
    comfort_class: string; base_fare_mwk: bigint; distance_km: number;
    estimated_duration_minutes: number | null; status: string;
  };

  const rows = await prisma.$queryRaw<TripRow[]>`
    UPDATE trips
    SET driver_id = ${driver.id}::uuid,
        vehicle_id = ${input.vehicleId}::uuid,
        origin_name = ${input.originName},
        pickup_point = ${input.pickupPoint ?? null},
        origin_point = ST_SetSRID(ST_MakePoint(${input.originLng}, ${input.originLat}), 4326),
        destination_name = ${input.destinationName},
        destination_point = ST_SetSRID(ST_MakePoint(${input.destinationLng}, ${input.destinationLat}), 4326),
        departure_time = ${departureTime},
        total_seats = ${input.totalSeats},
        available_seats = ${availableSeats},
        comfort_class = ${vehicle.comfortClass as ComfortClass}::"ComfortClass",
        distance_km = ${distanceKm},
        base_fare_mwk = ${BigInt(input.farePerSeatMwk)},
        estimated_duration_minutes = ${input.estimatedDurationMinutes},
        updated_at = now()
    WHERE id = ${tripId}::uuid
    RETURNING id, origin_name, pickup_point, destination_name, departure_time, total_seats,
              available_seats, comfort_class, base_fare_mwk, distance_km,
              estimated_duration_minutes, status`;

  const r = rows[0];
  return {
    id: r.id,
    status: r.status,
    originName: r.origin_name,
    pickupPoint: (r as { pickup_point?: string | null }).pickup_point ?? null,
    destinationName: r.destination_name,
    departureTime: r.departure_time,
    availableSeats: r.available_seats,
    totalSeats: r.total_seats,
    comfortClass: r.comfort_class,
    distanceKm: Number(r.distance_km),
    estimatedDurationMinutes: r.estimated_duration_minutes,
    farePerSeatMwk: r.base_fare_mwk.toString(),
  };
}

export async function updateTripStatusAdmin(tripId: string, input: UpdateTripStatusInput) {
  try {
    return await prisma.trip.update({
      where: { id: tripId },
      data: {
        status: input.status,
        gpsTrackingActive: input.status === "in_transit",
        startedAt: input.status === "in_transit" ? new Date() : undefined,
        completedAt: input.status === "completed" ? new Date() : undefined,
      },
      select: { id: true, status: true },
    });
  } catch {
    throw new AppError(404, "Trip not found");
  }
}

export async function deleteTripAdmin(tripId: string) {
  const [bookings, pendingPayments] = await prisma.$transaction([
    prisma.booking.count({ where: { tripId } }),
    prisma.pendingPayment.count({ where: { tripId } }),
  ]);
  if (bookings > 0 || pendingPayments > 0) {
    throw new AppError(400, "Trips with bookings or pending payments cannot be deleted. Cancel the trip instead.");
  }
  try {
    await prisma.trip.delete({ where: { id: tripId } });
    return { id: tripId, deleted: true };
  } catch {
    throw new AppError(404, "Trip not found");
  }
}

export async function searchTrips(input: SearchTripsInput) {
  const { originLat, originLng, destLat, destLng, date, seats, comfortClass, page, limit } = input;
  const offset = (page - 1) * limit;
  const radiusM = 30_000;

  type SearchRow = {
    id: string; origin_name: string; destination_name: string;
    departure_time: Date; available_seats: number; comfort_class: string;
    base_fare_mwk: bigint; distance_km: number; estimatedDurationMinutes: number | null;
    status: string;
    driver_name: string; driver_rating: number | null;
    make: string; model: string; year: number; plate_number: string;
  };

  if (comfortClass) {
    return prisma.$queryRaw<SearchRow[]>`
      SELECT t.id, t.origin_name, t.destination_name, t.departure_time,
             t.available_seats, t.comfort_class, t.base_fare_mwk, t.distance_km,
             t.estimated_duration_minutes AS "estimatedDurationMinutes",
             t.status, u.full_name AS driver_name, u.rating AS driver_rating,
             v.make, v.model, v.year, v.plate_number
      FROM trips t
      JOIN driver_profiles dp ON dp.id = t.driver_id
      JOIN users u ON u.id = dp.user_id
      JOIN vehicles v ON v.id = t.vehicle_id
      WHERE t.status = 'scheduled'
        AND t.available_seats >= ${seats}
        AND t.departure_time::date = ${date}::date
        AND ST_DWithin(t.origin_point::geography,
              ST_SetSRID(ST_MakePoint(${originLng}, ${originLat}), 4326)::geography, ${radiusM})
        AND ST_DWithin(t.destination_point::geography,
              ST_SetSRID(ST_MakePoint(${destLng}, ${destLat}), 4326)::geography, ${radiusM})
        AND t.comfort_class = ${comfortClass}::"ComfortClass"
      ORDER BY t.departure_time ASC
      LIMIT ${limit} OFFSET ${offset}`;
  }

  return prisma.$queryRaw<SearchRow[]>`
    SELECT t.id, t.origin_name, t.destination_name, t.departure_time,
           t.available_seats, t.comfort_class, t.base_fare_mwk, t.distance_km,
           t.estimated_duration_minutes AS "estimatedDurationMinutes",
           t.status, u.full_name AS driver_name, u.rating AS driver_rating,
           v.make, v.model, v.year, v.plate_number
    FROM trips t
    JOIN driver_profiles dp ON dp.id = t.driver_id
    JOIN users u ON u.id = dp.user_id
    JOIN vehicles v ON v.id = t.vehicle_id
    WHERE t.status = 'scheduled'
      AND t.available_seats >= ${seats}
      AND t.departure_time::date = ${date}::date
      AND ST_DWithin(t.origin_point::geography,
            ST_SetSRID(ST_MakePoint(${originLng}, ${originLat}), 4326)::geography, ${radiusM})
      AND ST_DWithin(t.destination_point::geography,
            ST_SetSRID(ST_MakePoint(${destLng}, ${destLat}), 4326)::geography, ${radiusM})
    ORDER BY t.departure_time ASC
    LIMIT ${limit} OFFSET ${offset}`;
}

export async function listPublicTrips(
  page = 1,
  limit = 50,
  filters: {
    originName?: string;
    destName?: string;
    date?: string;
    seats?: number;
    comfortClass?: string;
    driverId?: string;
  } = {},
) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const where: Prisma.TripWhereInput = {
    status: "scheduled",
    departureTime: { gte: today },
    // Never show fully-booked trips in public listing
    availableSeats: { gt: 0 },
  };
  if (filters.originName?.trim()) {
    where.originName = { contains: filters.originName.trim(), mode: "insensitive" };
  }
  if (filters.destName?.trim()) {
    where.destinationName = { contains: filters.destName.trim(), mode: "insensitive" };
  }
  if (filters.date) {
    const selected = new Date(filters.date);
    if (!Number.isNaN(selected.getTime())) {
      const nextDay = new Date(selected);
      nextDay.setDate(selected.getDate() + 1);
      where.departureTime = { gte: selected, lt: nextDay };
    }
  }
  if (filters.seats && filters.seats > 0) {
    where.availableSeats = { gte: filters.seats };
  }
  if (filters.comfortClass) {
    where.comfortClass = filters.comfortClass as never;
  }
  if (filters.driverId) {
    where.driverId = filters.driverId;
  }

  const [total, trips] = await prisma.$transaction([
    prisma.trip.count({ where }),
    prisma.trip.findMany({
      where,
      orderBy: [{ departureTime: "asc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      include: {
        driver: {
          select: {
            id: true,
            user: { select: { fullName: true, profilePhotoUrl: true, rating: true } },
          },
        },
        vehicle: {
          select: {
            make: true,
            model: true,
            plateNumber: true,
            year: true,
            color: true,
            images: { select: { url: true }, orderBy: { createdAt: "asc" } },
          },
        },
      },
    }),
  ]);

  return {
    items: trips.map(({ baseFareMwk, distanceKm, vehicle, ...trip }) => ({
      ...trip,
      vehicle: {
        ...vehicle,
        imageUrls: vehicle.images.map((row) => row.url),
        images: undefined,
      },
      farePerSeatMwk: baseFareMwk?.toString() ?? "0",
      distanceKm: distanceKm ? Number(distanceKm) : 0,
    })),
    total,
    page: safePage,
    limit: safeLimit,
  };
}

export async function getTripById(tripId: string, _userId?: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      driver: {
        select: {
          id: true,
          user: { select: { fullName: true, phone: true, rating: true } },
        },
      },
      vehicle: {
        select: {
          make: true,
          model: true,
          plateNumber: true,
          year: true,
          color: true,
          images: { select: { url: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!trip) throw new AppError(404, "Trip not found");
  const { baseFareMwk, distanceKm, vehicle, ...rest } = trip;
  return {
    ...rest,
    vehicle: {
      ...vehicle,
      imageUrls: vehicle.images.map((row) => row.url),
      images: undefined,
    },
    farePerSeatMwk: baseFareMwk?.toString() ?? "0",
    distanceKm: distanceKm ? Number(distanceKm) : 0,
    estimatedDurationMinutes: trip.estimatedDurationMinutes ?? null,
  };
}

export async function updateTripStatus(
  tripId: string,
  userId: string,
  input: UpdateTripStatusInput,
) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, driver: { userId } },
  });
  if (!trip) throw new AppError(404, "Trip not found or unauthorized");

  const updateData: Prisma.TripUpdateInput = { status: input.status };
  if (input.status === "in_transit") {
    updateData.startedAt = new Date();
    updateData.gpsTrackingActive = true;
  }
  if (input.status === "completed") {
    updateData.completedAt = new Date();
    updateData.gpsTrackingActive = false;
  }

  if (input.status !== "completed") {
    return prisma.trip.update({
      where: { id: tripId },
      data: updateData,
      select: { id: true, status: true },
    });
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.trip.update({
      where: { id: tripId },
      data: updateData,
      select: { id: true, status: true },
    });

    const releasablePayments = await tx.payment.findMany({
      where: {
        driverId: trip.driverId,
        status: "escrow_held",
        booking: {
          tripId,
          paymentStatus: "held_in_escrow",
          status: { in: ["confirmed", "authenticated"] },
        },
      },
      select: {
        id: true,
        bookingId: true,
        driverId: true,
        netAmountMwk: true,
        gatewayRef: true,
      },
    });

    for (const payment of releasablePayments) {
      await creditTripPayout(tx, {
        driverId: payment.driverId,
        bookingId: payment.bookingId,
        paymentId: payment.id,
        amountMwk: payment.netAmountMwk,
        reference: payment.gatewayRef,
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "released", releasedAt: new Date() },
      });
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: "completed", paymentStatus: "released" },
      });
    }

    return updated;
  });
}

export async function updateLocation(
  tripId: string,
  userId: string,
  input: LocationUpdateInput,
) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, driver: { userId } },
  });
  if (!trip) throw new AppError(404, "Trip not found or unauthorized");
  if (trip.status !== "in_transit" || !trip.gpsTrackingActive) {
    throw new AppError(400, "GPS tracking is not active for this trip");
  }

  await prisma.$executeRaw`
    UPDATE trips
    SET current_location = ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)
    WHERE id = ${tripId}::uuid`;

  return { updated: true };
}

export async function getTripLocation(tripId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) throw new AppError(404, "User not found");

  const allowedTrip = await prisma.trip.findFirst({
    where: user.role === "admin" ? {
      id: tripId,
    } : {
      id: tripId,
      OR: [
        { driver: { userId } },
        {
          bookings: {
            some: {
              passengerId: userId,
              paymentStatus: "held_in_escrow",
              status: { in: ["confirmed", "authenticated"] },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      status: true,
      gpsTrackingActive: true,
      updatedAt: true,
    },
  });
  if (!allowedTrip) throw new AppError(404, "Trip not found or unauthorized");

  const cached = await getTripLocationFromRedis(tripId).catch(() => null);
  if (cached) {
    const place = cached.areaName
      ? null
      : await resolveReverseGeocodeForTrip(tripId, cached.lat, cached.lng).catch(() => null);
    return {
      tripId,
      status: allowedTrip.status,
      gpsTrackingActive: allowedTrip.gpsTrackingActive,
      lat: cached.lat,
      lng: cached.lng,
      address: cached.address ?? place?.address ?? null,
      areaName: cached.areaName ?? place?.areaName ?? null,
      addressUpdatedAt: cached.addressUpdatedAt ?? place?.updatedAt ?? null,
      updatedAt: cached.updatedAt,
    };
  }

  const rows = await prisma.$queryRaw<Array<{ lat: number | null; lng: number | null }>>`
    SELECT ST_Y(current_location::geometry) AS lat,
           ST_X(current_location::geometry) AS lng
    FROM trips
    WHERE id = ${tripId}::uuid
    LIMIT 1`;

  const point = rows[0];
  const place =
    typeof point?.lat === "number" && typeof point?.lng === "number"
      ? await resolveReverseGeocodeForTrip(tripId, point.lat, point.lng).catch(() => null)
      : null;
  return {
    tripId,
    status: allowedTrip.status,
    gpsTrackingActive: allowedTrip.gpsTrackingActive,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    address: place?.address ?? null,
    areaName: place?.areaName ?? null,
    addressUpdatedAt: place?.updatedAt ?? null,
    updatedAt: allowedTrip.updatedAt,
  };
}

export async function authenticatePassenger(
  tripId: string,
  driverUserId: string,
  input: AuthenticateCodeInput,
  clientIp: string,
) {
  const booking = await prisma.booking.findFirst({
    where: {
      id: input.bookingId,
      trip: { id: tripId, driver: { userId: driverUserId } },
    },
    select: {
      id: true,
      secretCode: true,
      codeUsed: true,
      authAttemptCount: true,
      status: true,
      paymentStatus: true,
    },
  });

  if (!booking) throw new AppError(404, "Booking not found");
  if (booking.paymentStatus !== "held_in_escrow" && booking.paymentStatus !== "released") {
    throw new AppError(400, "Passenger payment has not been confirmed");
  }
  if (booking.status !== "confirmed" && booking.status !== "authenticated") {
    throw new AppError(400, "Booking is not ready for boarding verification");
  }

  const driver = await prisma.driverProfile.findUnique({ where: { userId: driverUserId } });
  const driverId = driver?.id ?? null;

  if (booking.codeUsed) {
    await logCodeAttempt(booking.id, driverId, input.code, "already_used", clientIp);
    throw new AppError(400, "Code already used");
  }

  const expired = await isCodeExpired(input.bookingId);
  if (expired) {
    await logCodeAttempt(booking.id, driverId, input.code, "expired", clientIp);
    throw new AppError(400, "Code expired");
  }

  const valid = await verifyCode(input.code, booking.secretCode);
  if (!valid) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { authAttemptCount: { increment: 1 } },
    });
    await logCodeAttempt(booking.id, driverId, input.code, "mismatch", clientIp);
    if (booking.authAttemptCount + 1 >= 5) throw new AppError(429, "Too many failed attempts");
    throw new AppError(400, "Invalid code");
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { codeUsed: true, rawSecretCode: null, status: "authenticated" },
  });
  await logCodeAttempt(booking.id, driverId, input.code, "success", clientIp);

  return { authenticated: true, bookingId: input.bookingId };
}

async function logCodeAttempt(
  bookingId: string,
  driverId: string | null,
  code: string,
  result: "success" | "mismatch" | "expired" | "already_used",
  ip: string,
) {
  await prisma.secretCodeAuditLog.create({
    data: { bookingId, driverId, enteredCode: code, result, ipAddress: ip },
  });
}

export async function completeTrip(tripId: string, userId: string) {
  return updateTripStatus(tripId, userId, { status: "completed" });
}

export async function getDriverTrips(userId: string) {
  const driver = await prisma.driverProfile.findFirst({ where: { userId }, select: { id: true, isApproved: true } });
  if (!driver || !driver.isApproved) {
    throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");
  }
  const trips = await prisma.trip.findMany({
    where: { driverId: driver.id },
    select: {
      id: true, status: true, originName: true, destinationName: true,
      departureTime: true, totalSeats: true, availableSeats: true,
      comfortClass: true, distanceKm: true, baseFareMwk: true,
      gpsTrackingActive: true, startedAt: true, completedAt: true, createdAt: true,
      vehicle: { select: { make: true, model: true, plateNumber: true, year: true, seatCapacity: true } },
    },
    orderBy: { departureTime: "desc" },
  });
  return trips.map(({ baseFareMwk, distanceKm, ...t }) => ({
    ...t,
    farePerSeatMwk: baseFareMwk?.toString() ?? "0",
    distanceKm: distanceKm ? Number(distanceKm) : 0,
  }));
}

export async function startTrip(tripId: string, userId: string) {
  return updateTripStatus(tripId, userId, { status: "in_transit" });
}

export async function cancelTrip(tripId: string, userId: string) {
  return updateTripStatus(tripId, userId, { status: "cancelled" });
}

export async function listTripsAdmin(
  page = 1,
  limit = 20,
  options?: { status?: string; search?: string; dateFrom?: string; dateTo?: string },
) {
  const where: Prisma.TripWhereInput = {};

  if (options?.status) {
    where.status = options.status as never;
  }

  if (options?.search?.trim()) {
    const q = options.search.trim();
    const normalizedQ = q.toLowerCase();
    const matchingStatuses = TRIP_STATUSES.filter((status) => status.includes(normalizedQ));
    const searchFilters: Prisma.TripWhereInput[] = [
      { originName: { contains: q, mode: "insensitive" } },
      { destinationName: { contains: q, mode: "insensitive" } },
      { driver: { user: { fullName: { contains: q, mode: "insensitive" } } } },
      { driver: { user: { phone: { contains: q, mode: "insensitive" } } } },
      { vehicle: { plateNumber: { contains: q, mode: "insensitive" } } },
      { vehicle: { make: { contains: q, mode: "insensitive" } } },
      { vehicle: { model: { contains: q, mode: "insensitive" } } },
      ...matchingStatuses.map((status) => ({ status })),
    ];
    where.OR = searchFilters;
  }

  // Date range filter on departureTime
  if (options?.dateFrom || options?.dateTo) {
    const departureFilter: Prisma.DateTimeFilter = {};
    if (options.dateFrom) {
      departureFilter.gte = new Date(options.dateFrom);
    }
    if (options.dateTo) {
      const dateTo = new Date(options.dateTo);
      dateTo.setDate(dateTo.getDate() + 1); // inclusive of the full day
      departureFilter.lt = dateTo;
    }
    // Merge with existing departureTime filter if any
    if (where.departureTime) {
      Object.assign(where.departureTime, departureFilter);
    } else {
      where.departureTime = departureFilter;
    }
  }

  const trips = await prisma.trip.findMany({
    where,
    select: {
      id: true,
      driverId: true,
      vehicleId: true,
      originName: true,
      destinationName: true,
      departureTime: true,
      availableSeats: true,
      totalSeats: true,
      comfortClass: true,
      status: true,
      distanceKm: true,
      baseFareMwk: true,
      estimatedDurationMinutes: true,
      gpsTrackingActive: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      driver: { select: { id: true, user: { select: { fullName: true, phone: true } } } },
      vehicle: {
        select: {
          make: true,
          model: true,
          plateNumber: true,
          year: true,
          color: true,
          seatCapacity: true,
        },
      },
      _count: { select: { bookings: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return trips.map(({ baseFareMwk, distanceKm, ...trip }) => ({
    ...trip,
    farePerSeatMwk: baseFareMwk?.toString() ?? "0",
    distanceKm: distanceKm ? Number(distanceKm) : 0,
  }));
}

