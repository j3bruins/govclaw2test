export function federalToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso: string, days: number): string {
  const date = new Date(Date.parse(`${iso}T00:00:00Z`));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysUntil(iso: string | null, today: string): number | null {
  if (!iso) return null;
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

export function shiftWeekday(iso: string, end: string): string {
  const date = new Date(Date.parse(`${iso}T00:00:00Z`));
  const day = date.getUTCDay();
  if (day === 6) date.setUTCDate(date.getUTCDate() - 1);
  if (day === 0) date.setUTCDate(date.getUTCDate() + 1);
  let out = date.toISOString().slice(0, 10);
  if (out > end) out = end;
  if (out < "1970-01-01") out = iso;
  return out;
}

export function parseUsDate(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return iso ? iso[1] : null;
}

export function parseMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return null;
  const number = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(number) ? number : null;
}

export function prettyDate(iso: string | null | undefined): string {
  if (!iso) return "No close date";
  const parsed = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function prettyWhen(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(date);
}

export function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "Not listed";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function closeLabel(iso: string | null, today: string): string {
  const days = daysUntil(iso, today);
  if (days == null) return "No close date";
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  if (days > 1) return `Closes in ${days} days`;
  if (days === -1) return "Closed yesterday";
  return `Closed ${Math.abs(days)} days ago`;
}
