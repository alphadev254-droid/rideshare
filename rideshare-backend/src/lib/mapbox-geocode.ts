import { env } from "../config/env.js";
import { getRedisConnection } from "../config/redis.js";

export type ReverseGeocodeResult = {
  address: string;
  areaName: string;
  lat: number;
  lng: number;
  updatedAt: string;
};

type MapboxFeature = {
  properties?: {
    name?: string;
    full_address?: string;
    place_formatted?: string;
    feature_type?: string;
  };
};

type MapboxReverseResponse = {
  features?: MapboxFeature[];
};

const GEOCODE_CACHE_TTL_SECONDS = 60 * 60;

function geocodeKey(tripId: string) {
  return `trip:${tripId}:reverse-geocode`;
}

function geocodeThrottleKey(tripId: string) {
  return `trip:${tripId}:reverse-geocode-lock`;
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadiusMeters = 6371000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;

  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function pickDisplayName(features: MapboxFeature[]) {
  const preferred =
    features.find((feature) =>
      ["address", "street", "neighborhood", "locality", "place", "district", "region"].includes(
        feature.properties?.feature_type ?? "",
      ),
    ) ?? features[0];

  const props = preferred?.properties;
  const areaName = props?.name ?? "Unknown area";
  const address = props?.full_address ?? props?.place_formatted ?? areaName;

  return { address, areaName };
}

export async function getCachedReverseGeocode(tripId: string) {
  const raw = await getRedisConnection().get(geocodeKey(tripId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ReverseGeocodeResult;
  } catch {
    return null;
  }
}

export async function resolveReverseGeocodeForTrip(
  tripId: string,
  lat: number,
  lng: number,
) {
  const cached = await getCachedReverseGeocode(tripId);
  if (
    cached &&
    distanceMeters(cached, { lat, lng }) < env.MAPBOX_REVERSE_GEOCODE_MIN_DISTANCE_METERS
  ) {
    return cached;
  }

  const redis = getRedisConnection();
  const canCallMapbox = await redis.set(
    geocodeThrottleKey(tripId),
    "1",
    "EX",
    env.MAPBOX_REVERSE_GEOCODE_MIN_INTERVAL_SECONDS,
    "NX",
  );

  if (canCallMapbox !== "OK" || !env.MAPBOX_ACCESS_TOKEN) {
    return cached;
  }

  const params = new URLSearchParams({
    longitude: String(lng),
    latitude: String(lat),
    access_token: env.MAPBOX_ACCESS_TOKEN,
    types: "address,street,neighborhood,locality,place,district,region",
  });

  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?${params}`);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn(`[MAPBOX] Reverse geocode failed: ${response.status}`, {
      lat,
      lng,
      body: body.slice(0, 500),
    });
    return cached;
  }

  const data = (await response.json()) as MapboxReverseResponse;
  const features = data.features ?? [];
  console.log("[MAPBOX] Reverse geocode response", {
    lat,
    lng,
    featureCount: features.length,
    features: features.slice(0, 5).map((feature) => ({
      type: feature.properties?.feature_type ?? null,
      name: feature.properties?.name ?? null,
      fullAddress: feature.properties?.full_address ?? null,
      placeFormatted: feature.properties?.place_formatted ?? null,
    })),
  });
  if (!features.length) {
    console.warn(`[MAPBOX] No reverse geocode result for ${lat},${lng}`);
    return cached;
  }

  const result: ReverseGeocodeResult = {
    ...pickDisplayName(features),
    lat,
    lng,
    updatedAt: new Date().toISOString(),
  };

  await redis.set(geocodeKey(tripId), JSON.stringify(result), "EX", GEOCODE_CACHE_TTL_SECONDS);
  return result;
}
