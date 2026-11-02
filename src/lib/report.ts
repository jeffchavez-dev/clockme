// Report filtering and summary math, shared by the on-screen report and the
// print layout so the PDF can never disagree with what's on screen.

import { durationOf, type Entry, type State } from "./store";
import { addDays, dayKey, fromDayKey, HOUR, startOfDay, startOfWeek } from "./time";

export type BillableFilter = "all" | "yes" | "no";

export type ReportQuery = {
  from: string; // dayKey, inclusive
  to: string; // dayKey, inclusive
  projectIds: string[]; // "none" matches entries without a project
  tagIds: string[];
  billable: BillableFilter;
  q: string;
};

export type Summary = {
  totalMs: number;
  billableMs: number;
  /** Total hours ÷ days that have time logged — Toggl's definition. */
  avgDailyHours: number;
  activeDays: number;
};

export function filterEntries(state: State, query: ReportQuery): Entry[] {
  const from = fromDayKey(query.from).getTime();
  const to = addDays(fromDayKey(query.to), 1).getTime();
  const needle = query.q.trim().toLowerCase();
  return state.entries
    .filter((e) => {
      if (e.end === null) return false; // running entries aren't reported yet
      const t = Date.parse(e.start);
      if (t < from || t >= to) return false;
      if (query.projectIds.length && !query.projectIds.includes(e.projectId ?? "none")) return false;
      if (query.tagIds.length && !e.tagIds.some((t) => query.tagIds.includes(t))) return false;
      if (query.billable === "yes" && !e.billable) return false;
      if (query.billable === "no" && e.billable) return false;
      if (needle && !e.description.toLowerCase().includes(needle)) return false;
      return true;
    })
    .sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
}

export function summarize(entries: Entry[]): Summary {
  let totalMs = 0;
  let billableMs = 0;
  const days = new Set<string>();
  for (const e of entries) {
    const ms = durationOf(e);
    totalMs += ms;
    if (e.billable) billableMs += ms;
    days.add(dayKey(new Date(e.start)));
  }
  return {
    totalMs,
    billableMs,
    activeDays: days.size,
    avgDailyHours: days.size ? totalMs / HOUR / days.size : 0,
  };
}

// ─── Date range presets ─────────────────────────────────────────────────────

export type Preset = { id: string; label: string; range: (today: Date) => [Date, Date] };

export const PRESETS: Preset[] = [
  { id: "today", label: "Today", range: (t) => [t, t] },
  { id: "yesterday", label: "Yesterday", range: (t) => [addDays(t, -1), addDays(t, -1)] },
  { id: "this-week", label: "This week", range: (t) => [startOfWeek(t), addDays(startOfWeek(t), 6)] },
  { id: "last-week", label: "Last week", range: (t) => [addDays(startOfWeek(t), -7), addDays(startOfWeek(t), -1)] },
  {
    id: "this-month",
    label: "This month",
    range: (t) => [new Date(t.getFullYear(), t.getMonth(), 1), new Date(t.getFullYear(), t.getMonth() + 1, 0)],
  },
  {
    id: "last-month",
    label: "Last month",
    range: (t) => [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)],
  },
];

export function presetRange(id: string, today = startOfDay(new Date())): [string, string] | null {
  const p = PRESETS.find((p) => p.id === id);
  if (!p) return null;
  const [a, b] = p.range(today);
  return [dayKey(a), dayKey(b)];
}

// ─── URL <-> query ──────────────────────────────────────────────────────────

const isDayKey = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function queryFromParams(params: URLSearchParams): ReportQuery {
  const [weekFrom, weekTo] = presetRange("this-week")!;
  const from = params.get("from");
  const to = params.get("to");
  const billable = params.get("billable");
  return {
    from: isDayKey(from) ? from : weekFrom,
    to: isDayKey(to) ? to : weekTo,
    projectIds: params.getAll("project"),
    tagIds: params.getAll("tag"),
    billable: billable === "yes" || billable === "no" ? billable : "all",
    q: params.get("q") ?? "",
  };
}

export function paramsFromQuery(query: ReportQuery): URLSearchParams {
  const p = new URLSearchParams({ from: query.from, to: query.to });
  query.projectIds.forEach((id) => p.append("project", id));
  query.tagIds.forEach((id) => p.append("tag", id));
  if (query.billable !== "all") p.set("billable", query.billable);
  if (query.q.trim()) p.set("q", query.q.trim());
  return p;
}

/** Human-readable chips describing active filters, e.g. "Member is Jeff". */
export function filterChips(state: State, query: ReportQuery): string[] {
  const chips = [`Member is ${state.settings.member}`];
  if (query.projectIds.length) {
    const names = query.projectIds.map((id) =>
      id === "none" ? "No project" : (state.projects.find((p) => p.id === id)?.name ?? "Unknown"),
    );
    chips.push(`Project is ${names.join(", ")}`);
  }
  if (query.tagIds.length) {
    chips.push(`Tag is ${query.tagIds.map((id) => state.tags.find((t) => t.id === id)?.name ?? "Unknown").join(", ")}`);
  }
  if (query.billable !== "all") chips.push(query.billable === "yes" ? "Billable" : "Non-billable");
  if (query.q.trim()) chips.push(`Description contains “${query.q.trim()}”`);
  return chips;
}
