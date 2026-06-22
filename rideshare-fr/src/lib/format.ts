/** Format helpers used across the dashboard. */

export function formatMwk(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "MK 0";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "MK 0";
  return `MK ${num.toLocaleString("en-MW", { maximumFractionDigits: 0 })}`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return `${formatDate(iso)} · ${formatTime(iso)}`;
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
