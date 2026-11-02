// Time math and formatting. Everything works in the browser's local time zone,
// which matches how Toggl renders reports for the viewing member.

export const HOUR = 3_600_000;
export const MINUTE = 60_000;
export const DAY = 24 * HOUR;

/** 9086000 → "2:31:26" — Toggl's h:mm:ss, hours unpadded and unbounded. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** "6:53 AM" */
export function formatClock(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "10/31/2026" */
export function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

/** "Fri, Oct 31" */
export function formatDayHeading(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Local calendar day as "2026-10-31". Used for grouping and URL params. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-10-31" → local midnight of that day. */
export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Weeks start on Monday, as in Toggl's default workspace setting. */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  return addDays(day, -((day.getDay() + 6) % 7));
}

/**
 * Lenient clock input: "6:53 AM", "6:53a", "653pm", "18:30", "9", "9p".
 * Returns null when it can't make sense of it.
 */
export function parseClock(input: string): { h: number; m: number } | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, "");
  const match = s.match(/^(\d{1,2})(?::?(\d{2}))?(a|am|p|pm)?$/);
  if (!match) return null;
  let h = Number(match[1]);
  const m = match[2] ? Number(match[2]) : 0;
  const mer = match[3]?.[0];
  if (m > 59) return null;
  if (mer) {
    if (h < 1 || h > 12) return null;
    if (mer === "a" && h === 12) h = 0;
    if (mer === "p" && h !== 12) h += 12;
  } else if (h > 23) {
    return null;
  }
  return { h, m };
}

/**
 * Lenient duration input: "2:26:20", "2:26", "1h 30m", "90m", "45", "1.5h".
 * A bare number is minutes, like Toggl. Returns ms, or null.
 */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  const colon = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (colon) {
    const [, h, m, sec] = colon;
    return Number(h) * HOUR + Number(m) * MINUTE + Number(sec ?? 0) * 1000;
  }
  const units = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(h|m|s)/g)];
  if (units.length && units.map((u) => u[0]).join("").replace(/\s/g, "") === s.replace(/\s/g, "")) {
    return units.reduce((sum, [, n, u]) => sum + Number(n) * (u === "h" ? HOUR : u === "m" ? MINUTE : 1000), 0);
  }
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * MINUTE);
  return null;
}

/** Puts a clock time onto a given calendar day. */
export function atClock(day: Date, clock: { h: number; m: number }): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), clock.h, clock.m);
}
