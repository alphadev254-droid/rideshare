import axios from "axios";
import { env } from "../config/env.js";

const MAPS_BASE = "https://maps.googleapis.com/maps/api";

export interface DistanceResult {
  distanceKm: number;
  durationSeconds: number;
}

export async function getDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<DistanceResult> {
  if (!env.GOOGLE_MAPS_API_KEY) {
    const latDiff = Math.abs(destLat - originLat);
    const lngDiff = Math.abs(destLng - originLng);
    const distanceKm = Math.sqrt(latDiff ** 2 + lngDiff ** 2) * 111;
    return { distanceKm: Math.max(1, distanceKm), durationSeconds: distanceKm * 72 };
  }

  const res = await axios.get(`${MAPS_BASE}/distancematrix/json`, {
    params: {
      origins: `${originLat},${originLng}`,
      destinations: `${destLat},${destLng}`,
      key: env.GOOGLE_MAPS_API_KEY,
      units: "metric",
    },
  });

  const element = res.data?.rows?.[0]?.elements?.[0];
  if (element?.status !== "OK") {
    throw new Error(`Distance Matrix error: ${element?.status}`);
  }

  return {
    distanceKm: element.distance.value / 1000,
    durationSeconds: element.duration.value,
  };
}

export async function geocode(address: string): Promise<{ lat: number; lng: number }> {
  if (!env.GOOGLE_MAPS_API_KEY) {
    return { lat: -13.9626, lng: 33.7741 };
  }

  const res = await axios.get(`${MAPS_BASE}/geocode/json`, {
    params: { address, key: env.GOOGLE_MAPS_API_KEY },
  });

  const location = res.data?.results?.[0]?.geometry?.location;
  if (!location) throw new Error("Geocoding failed: no results");
  return { lat: location.lat, lng: location.lng };
}
