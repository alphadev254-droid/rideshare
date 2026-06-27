import { API_CONFIG } from "./config";
import { tokenStorage } from "./storage";

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
  details?: Record<string, string[]>;
};

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean; // attach bearer (default: true)
  raw?: boolean; // return entire envelope (default: false → returns .data)
  formData?: boolean; // if true, body is FormData (skip JSON.stringify & Content-Type)
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) return null;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_CONFIG.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        tokenStorage.clear();
        return null;
      }
      const json = (await res.json()) as ApiResponse<{ accessToken: string }>;
      const newAccess = json.data?.accessToken;
      if (!newAccess) {
        tokenStorage.clear();
        return null;
      }
      tokenStorage.setTokens(newAccess);
      return newAccess;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path.startsWith("http") ? path : `${API_CONFIG.baseUrl}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function performRequest<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const { body, query, auth = true, raw = false, formData = false, headers, ...rest } = opts;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(body !== undefined && !formData ? { "Content-Type": "application/json" } : {}),
    ...(headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = tokenStorage.getAccess();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers: finalHeaders,
      body: body !== undefined ? (formData ? (body as FormData) : JSON.stringify(body)) : undefined,
      ...rest,
    });
  } catch (e) {
    throw new ApiError("Network error — could not reach the server. Check your connection.", 0);
  }

  // 401 → try refresh once
  if (res.status === 401 && auth && !isRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return performRequest<T>(method, path, opts, true);
  }

  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    /* non-JSON */
  }

  if (!res.ok) {
    const message = json?.error ?? json?.message ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status, json);
  }

  if (raw) return json as unknown as T;
  // API envelope { success, data } — unwrap data; fall back to full body.
  return (json?.data ?? (json as unknown as T)) as T;
}

export function extractApiError(err: unknown, fallback = "Something went wrong"): string {
  if (!(err instanceof ApiError)) {
    return err instanceof Error && err.message ? err.message : fallback;
  }

  const data = err.data as {
    error?: string;
    message?: string;
    details?: Record<string, string[] | string>;
  } | null;

  if (data?.details) {
    const msgs = Object.values(data.details)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter(Boolean);
    if (msgs.length) return msgs.join("; ");
  }

  return data?.error ?? data?.message ?? err.message ?? fallback;
}

export function getApiErrorCode(err: unknown): string | undefined {
  if (!(err instanceof ApiError)) return undefined;
  return (err.data as { code?: string } | null)?.code;
}

export function isDriverNotOnboardedError(err: unknown): boolean {
  return getApiErrorCode(err) === "DRIVER_NOT_ONBOARDED";
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => performRequest<T>("GET", path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    performRequest<T>("POST", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    performRequest<T>("PATCH", path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    performRequest<T>("PUT", path, { ...opts, body }),
  delete: <T>(path: string, opts?: RequestOptions) => performRequest<T>("DELETE", path, opts),
  upload: <T>(path: string, formData: FormData, opts?: RequestOptions) =>
    performRequest<T>("POST", path, { ...opts, body: formData, formData: true }),
};

