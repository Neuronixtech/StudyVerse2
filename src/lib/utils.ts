type ClassValue = string | number | false | null | undefined | ClassValue[];

/** Tiny className joiner (no dependency) */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (Array.isArray(v)) {
      const inner = cn(...v);
      if (inner) out.push(inner);
    } else {
      out.push(String(v));
    }
  }
  return out.join(" ");
}

export const DAY = 86_400_000;
export const HOUR = 3_600_000;
export const MINUTE = 60_000;

const TZ = "Asia/Kolkata";

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("en-IN");
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TZ,
});
const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: TZ,
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TZ,
});
const weekdayFormatter = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: TZ });
const hourFormatter = new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: TZ });

export const formatINR = (n: number) => inrFormatter.format(n);
export const formatNumber = (n: number) => numberFormatter.format(n);
export const formatDate = (ms: number) => dateFormatter.format(ms);
export const formatShortDate = (ms: number) => shortDateFormatter.format(ms);
export const formatDateTime = (ms: number) => dateTimeFormatter.format(ms);
export const formatWeekday = (ms: number) => weekdayFormatter.format(ms);

export function greetingFor(ms: number): string {
  const h = Number(hourFormatter.format(ms));
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** 1520 -> "25m 20s", 4000 -> "1h 06m" */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

/** Compact total like "4h 20m" for course totals */
export function formatHoursMinutes(totalSec: number): string {
  const mins = Math.round(totalSec / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** 754 -> "12:34", 3754 -> "1:02:34" */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Always HH:MM:SS for the exam timer */
export function formatTimer(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

export function daysUntil(target: number, now: number): number {
  // Small tolerance because rendered `now` is floored to the minute
  return Math.max(0, Math.ceil((target - now) / DAY - 0.002));
}

export function relativeTime(ms: number, now: number): string {
  const diff = now - ms;
  const abs = Math.abs(diff);
  const future = diff < 0;
  const fmt = (n: number, unit: string) =>
    future ? `in ${n} ${unit}${n === 1 ? "" : "s"}` : `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  if (abs < MINUTE) return future ? "in a moment" : "just now";
  if (abs < HOUR) return fmt(Math.round(abs / MINUTE), "min");
  if (abs < DAY) return fmt(Math.round(abs / HOUR), "hour");
  if (abs < 30 * DAY) return fmt(Math.round(abs / DAY), "day");
  return formatDate(ms);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Random id — only call from event handlers / effects, never during render */
export function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function isValidIndianPhone(phone: string): boolean {
  return /^(\+91[\s-]?)?[6-9]\d{9}$/.test(phone.replace(/\s+/g, ""));
}

/** Map with an index, moving item at `from` to `to` (immutable) */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const copy = list.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}
