/** Format helpers used across the dashboard. */

import { format, isValid, parseISO } from "date-fns";

const EMPTY_VALUE = "-";

export function formatMwk(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "MK 0";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "MK 0";
  return `MK ${num.toLocaleString("en-MW", { maximumFractionDigits: 0 })}`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return EMPTY_VALUE;
  const date = parseISO(iso);
  if (!isValid(date)) return EMPTY_VALUE;
  return format(date, "dd MMM yyyy");
}

export function formatTime(iso?: string | null): string {
  if (!iso) return EMPTY_VALUE;
  const date = parseISO(iso);
  if (!isValid(date)) return EMPTY_VALUE;
  return format(date, "HH:mm");
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return EMPTY_VALUE;
  return `${formatDate(iso)} - ${formatTime(iso)}`;
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDistanceKm(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value)) || Number(value) <= 0) {
    return "Not provided";
  }
  return `${Number(value).toLocaleString("en-MW", { maximumFractionDigits: 1 })} km`;
}

export function formatDuration(minutes: number | null | undefined): string {
  const totalMinutes = Number(minutes);
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "Not set";
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (!hours) return `${mins} min`;
  if (!mins) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}
