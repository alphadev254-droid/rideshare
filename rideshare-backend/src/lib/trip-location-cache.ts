import { getRedisConnection } from "../config/redis.js";

export type CachedTripLocation = {
  tripId: string;
  lat: number;
  lng: number;
  address?: string | null;
  areaName?: string | null;
  addressUpdatedAt?: string | null;
  timestamp: number;
  updatedAt: string;
};

const LOCATION_TTL_SECONDS = 60 * 60 * 24;
const DB_WRITE_INTERVAL_SECONDS = 30;

function locationKey(tripId: string) {
  return `trip:${tripId}:location`;
}

function dbWriteKey(tripId: string) {
  return `trip:${tripId}:location:db-write-lock`;
}

export async function saveTripLocationToRedis(location: CachedTripLocation) {
  const redis = getRedisConnection();
  await redis.set(locationKey(location.tripId), JSON.stringify(location), "EX", LOCATION_TTL_SECONDS);
}

export async function getTripLocationFromRedis(tripId: string) {
  const raw = await getRedisConnection().get(locationKey(tripId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedTripLocation;
  } catch {
    return null;
  }
}

export async function shouldPersistTripLocationToDb(tripId: string) {
  const redis = getRedisConnection();
  const result = await redis.set(dbWriteKey(tripId), "1", "EX", DB_WRITE_INTERVAL_SECONDS, "NX");
  return result === "OK";
}
