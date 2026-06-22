import type { Server as SocketServer } from "socket.io";
import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../config/prisma.js";
import { resolveReverseGeocodeForTrip } from "../lib/mapbox-geocode.js";
import { saveTripLocationToRedis, shouldPersistTripLocationToDb } from "../lib/trip-location-cache.js";

interface GpsUpdate {
  tripId: string;
  lat: number;
  lng: number;
  timestamp: number;
}

function isValidCoordinate(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function registerGpsHandlers(io: SocketServer): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Authentication required"));
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id} [user: ${socket.data.user?.sub}]`);

    socket.on("trip:join", async (tripId: string) => {
      const user = socket.data.user;
      if (!user?.sub || !tripId) return;

      const trip = await prisma.trip.findFirst({
        where: user.role === "admin" ? {
          id: tripId,
        } : {
          id: tripId,
          OR: [
            { driver: { userId: user.sub } },
            { bookings: { some: { passengerId: user.sub, paymentStatus: "held_in_escrow", status: { in: ["confirmed", "authenticated"] } } } },
          ],
        },
        select: { id: true },
      });
      if (!trip) return;

      socket.join(`trip:${tripId}`);
    });

    socket.on("trip:leave", (tripId: string) => {
      socket.leave(`trip:${tripId}`);
    });

    socket.on("driver:location", async (data: GpsUpdate) => {
      const { tripId, lat, lng } = data;
      const timestamp = Number.isFinite(data.timestamp) ? data.timestamp : Date.now();

      if (socket.data.user?.role !== "driver") return;
      if (!isValidCoordinate(lat, lng)) return;

      const trip = await prisma.trip.findFirst({
        where: {
          id: tripId,
          driver: { userId: socket.data.user.sub },
          status: "in_transit",
          gpsTrackingActive: true,
        },
        select: { id: true },
      });
      if (!trip) return;

      const place = await resolveReverseGeocodeForTrip(tripId, lat, lng).catch((err: unknown) => {
        console.error("GPS reverse geocode error:", err);
        return null;
      });

      const payload = {
        tripId,
        lat,
        lng,
        address: place?.address ?? null,
        areaName: place?.areaName ?? null,
        addressUpdatedAt: place?.updatedAt ?? null,
        timestamp,
        updatedAt: new Date(timestamp).toISOString(),
      };
      await saveTripLocationToRedis(payload).catch((err: unknown) =>
        console.error("GPS Redis update error:", err),
      );

      const shouldPersist = await shouldPersistTripLocationToDb(tripId).catch((err: unknown) => {
        console.error("GPS Redis DB-throttle error:", err);
        return false;
      });

      if (shouldPersist) {
        await prisma.$executeRaw`
          UPDATE trips
          SET current_location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
              updated_at = now()
          WHERE id = ${tripId}::uuid`
          .catch((err: unknown) => console.error("GPS DB update error:", err));
      }

      io.to(`trip:${tripId}`).emit("location:update", payload);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}
