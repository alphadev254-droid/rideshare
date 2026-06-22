/**
 * Centralized API configuration.
 * Change the base URL via VITE_API_BASE_URL in your .env.
 */
export const API_CONFIG = {
  baseUrl:
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:5000/api/v1",
  mapboxAccessToken: (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined) ?? "",
  storage: {
    accessToken: "rsm.accessToken",
    refreshToken: "rsm.refreshToken",
    user: "rsm.user",
  },
} as const;

/** Root origin of the backend (without /api/v1) — used for building image URLs. */
export const BACKEND_ORIGIN = (() => {
  const u = new URL(API_CONFIG.baseUrl);
  return `${u.protocol}//${u.host}`;
})();

/**
 * Resolves a relative upload path (e.g. "/uploads/documents/abc.jpg")
 * to a full URL pointing to the backend.
 */
export function uploadUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${BACKEND_ORIGIN}${path}`;
}
