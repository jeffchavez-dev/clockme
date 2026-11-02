"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  filterChips,
  filterEntries,
  paramsFromQuery,
  PRESETS,
  presetRange,
  queryFromParams,
  summarize,
  type BillableFilter,
  type ReportQuery,
  type Summary,
} from "@/lib/report";
import { durationOf, useStore, type Entry, type State } from "@/lib/store";
import { formatClock, formatDate, formatDuration, fromDayKey } from "@/lib/time";
import { Avatar, ColorDot, Icons, Popover } from "./ui";

// ─── Shared pieces (also used by the print layout) ──────────────────────────

export function rangeLabel(q: ReportQuery) {
  return `${formatDate(fromDayKey(q.from))} – ${formatDate(fromDayKey(q.to))}`;
}

export function SummaryStats({ summary, size = "lg" }: { summary: Summary; size?: "lg" | "sm" }) {
  const stats: [string, ReactNode][] = [
    ["Total hours", formatDuration(summary.totalMs)],
    ["Billable hours", summary.billableMs ? formatDuration(summary.billableMs) : "–"],
    [
      "Average daily hours",
      <>
        {summary.avgDailyHours.toFixed(2)}
        <span className="ml-1.5 font-sans text-[0.55em] font-normal text-muted">hours</span>
      </>,
    ],
  ];
  return (
    <dl className="grid grid-cols-1 divide-y divide-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {stats.map(([label, value], i) => (
        <div key={label} className={`py-3 sm:py-0 ${i ? "sm:pl-6" : ""} ${i < 2 ? "sm:pr-6" : ""}`}>
          <dt className="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">{label}</dt>
          <dd className={`num mt-1.5 font-medium tracking-[-0.02em] ${size === "lg" ? "text-[34px] leading-none" : "text-[22px] leading-none"}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EntryMeta({ entry, state }: { entry: Entry; state: State }) {
  const project = state.projects.find((p) => p.id === entry.projectId);
  const tags = state.tags.filter((t) => entry.tagIds.includes(t.id));
  if (!project && !tags.length && !entry.billable) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {project && (
        <span className="flex items-center gap-1.5 font-medium" style={{ color: project.color }}>
          <ColorDot color={project.color} />
          {project.name}
        </span>
      )}
      {tags.map((t) => (
        <span key={t.id} className="rounded border border-rule px-1.5 py-px text-ink-2">
          {t.name}
        </span>
      ))}
      {entry.billable && <span className="text-ink-2">$ Billable</span>}
    </div>
  );
}

// ─── Filter controls ───────────────────────────────────────────────────────

const chipClass = (active: boolean, open: boolean) =>
  `flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors ${
    active ? "border-ink bg-surface text-ink" : "border-rule-strong text-ink-2 hover:bg-surface"
  } ${open ? "bg-surface" : ""}`;

function DateRangeFilter({ query, set }: { query: ReportQuery; set: (p: Partial<ReportQuery>) => void }) {
  const active = PRESETS.find((p) => {
    const r = presetRange(p.id);
    return r && r[0] === query.from && r[1] === query.to;
  });
  return (
    <Popover
      width={320}
      trigger={(open, toggle) => (
        <button type="button" onClick={toggle} className={chipClass(true, open)}>
          <span className="font-medium">{active?.label ?? "Custom"}</span>
          <span className="num text-[13px] text-muted">{rangeLabel(query)}</span>
          <span className="text-muted">{Icons.chevron}</span>
        </button>
      )}
    >
      {(close) => (
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <ul className="border-r border-rule pr-1.5">
            {PRESETS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    const [from, to] = presetRange(p.id)!;
                    set({ from, to });
                    close();
                  }}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-sunken ${active?.id === p.id ? "bg-sunken font-medium" : ""}`}
                >
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 p-1">
            {(["from", "to"] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1">
                <span className="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">{k}</span>
                <input
                  type="date"
                  value={query[k]}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    // Keep from ≤ to by dragging the other end along.
                    if (k === "from") set({ from: v, to: v > query.to ? v : query.to });
                    else set({ to: v, from: v < query.from ? v : query.from });
                  }}
                  className="num rounded-lg border border-rule bg-paper px-2 py-1.5 text-sm outline-none focus:border-ink"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}

function MultiFilter({
  label,
  options,
  value,
  onChange,
  empty,
}: {
  label: string;
  options: { id: string; name: string; color?: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  empty: string;
}) {
  const names = options.filter((o) => value.includes(o.id)).map((o) => o.name);
  return (
    <Popover
      width={240}
      trigger={(open, toggle) => (
        <button type="button" onClick={toggle} className={chipClass(value.length > 0, open)}>
          {label}
          {names.length > 0 && <span className="max-w-32 truncate text-muted">{names.join(", ")}</span>}
          <span className="text-muted">{Icons.chevron}</span>
        </button>
      )}
    >
      {() => (
        <div className="max-h-72 overflow-y-auto">
          {options.length === 0 && <p className="px-2.5 py-1.5 text-sm text-muted">{empty}</p>}
          {options.map((o) => {
            const on = value.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-sunken"
              >
                <span className={`grid size-4 shrink-0 place-items-center rounded border ${on ? "border-ink bg-ink text-paper" : "border-rule-strong"}`}>
                  {on && <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m3 8.5 3 3 7-7" /></svg>}
                </span>
                {o.color && <ColorDot color={o.color} />}
                <span className="truncate">{o.name}</span>
              </button>
            );
          })}
          {value.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded-lg border-t border-rule px-2.5 pt-2 pb-1.5 text-left text-sm text-muted hover:text-ink">
              Clear
            </button>
          )}
        </div>
      )}
    </Popover>
  );
}

function BillableFilterControl({ value, onChange }: { value: BillableFilter; onChange: (v: BillableFilter) => void }) {
  const opts: [BillableFilter, string][] = [
    ["all", "All"],
    ["yes", "Billable"],
    ["no", "Non-billable"],
  ];
  return (
    <div role="radiogroup" aria-label="Billable" className="flex h-9 items-center rounded-lg border border-rule-strong p-0.5">
      {opts.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`h-full rounded-md px-2.5 text-sm ${value === v ? "bg-ink text-paper" : "text-ink-2 hover:bg-surface"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Detailed report ───────────────────────────────────────────────────────

type SortKey = "date" | "duration";

export function DetailedReport() {
  const state = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = useMemo(() => queryFromParams(new URLSearchParams(params.toString())), [params]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });

  const set = (patch: Partial<ReportQuery>) => router.replace(`${pathname}?${paramsFromQuery({ ...query, ...patch })}`, { scroll: false });

  const entries = useMemo(() => filterEntries(state, query), [state, query]);
  const summary = useMemo(() => summarize(entries), [entries]);
  const sorted = useMemo(() => {
    const val = (e: Entry) => (sort.key === "date" ? Date.parse(e.start) : durationOf(e));
    return [...entries].sort((a, b) => (val(a) - val(b)) * sort.dir);
  }, [entries, sort]);

  const printHref = `/reports/print?${paramsFromQuery(query)}`;
  const chips = filterChips(state, query);

  const sortButton = (key: SortKey, label: string, className = "") => (
    <button
      type="button"
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }))}
      className={`inline-flex items-center gap-1 uppercase hover:text-ink ${sort.key === key ? "text-ink" : ""} ${className}`}
    >
      {label}
      <span aria-hidden className={`transition-transform ${sort.key === key ? "" : "opacity-0"} ${sort.dir === 1 ? "rotate-180" : ""}`}>
        ↓
      </span>
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-24 sm:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">Reports</p>
          <h1 className="mt-1 text-[28px] leading-none font-semibold tracking-[-0.02em]">Detailed</h1>
        </div>
        <Link
          href={printHref}
          target="_blank"
          className={`flex h-9 items-center gap-2 rounded-lg bg-ink px-3.5 text-sm font-medium text-paper hover:bg-accent hover:text-accent-ink ${
            entries.length ? "" : "pointer-events-none opacity-40"
          }`}
        >
          {Icons.download}
          Export PDF
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <DateRangeFilter query={query} set={set} />
        <MultiFilter
          label="Project"
          options={[{ id: "none", name: "No project" }, ...state.projects]}
          value={query.projectIds}
          onChange={(projectIds) => set({ projectIds })}
          empty="No projects yet"
        />
        <MultiFilter label="Tag" options={state.tags} value={query.tagIds} onChange={(tagIds) => set({ tagIds })} empty="No tags yet" />
        <BillableFilterControl value={query.billable} onChange={(billable) => set({ billable })} />
        <input
          type="search"
          defaultValue={query.q}
          key={query.q}
          placeholder="Search descriptions"
          onKeyDown={(e) => e.key === "Enter" && set({ q: (e.target as HTMLInputElement).value })}
          onBlur={(e) => e.target.value !== query.q && set({ q: e.target.value })}
          className="h-9 min-w-44 flex-1 rounded-lg border border-rule-strong bg-transparent px-3 text-sm outline-none placeholder:text-muted focus:border-ink"
        />
      </div>

      <section className="rounded-2xl border border-rule bg-surface px-5 py-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Summary</h2>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c} className="rounded-md bg-sunken px-2 py-0.5 text-xs text-ink-2">
                {c}
              </span>
            ))}
          </div>
        </div>
        <SummaryStats summary={summary} />
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-rule bg-surface">
        <header className="flex items-baseline justify-between gap-4 border-b border-rule px-5 py-4 sm:px-6">
          <h2 className="text-sm font-semibold">
            Time entries <span className="num hidden font-normal text-muted sm:inline">{rangeLabel(query)}</span>
          </h2>
          <span className="text-sm text-muted">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </header>

        {!state.ready ? null : entries.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-muted">No time entries match this range and these filters.</p>
        ) : (
          <table className="w-full text-left">
            <thead className="hidden text-[11px] font-medium tracking-[0.08em] text-muted sm:table-header-group">
              <tr className="border-b border-rule">
                <th className="py-2.5 pl-6 font-medium uppercase">Description</th>
                <th className="w-28 py-2.5 text-right font-medium">{sortButton("duration", "Duration", "justify-end")}</th>
                <th className="w-36 py-2.5 pl-8 font-medium uppercase">Member</th>
                <th className="w-44 py-2.5 pr-6 font-medium">{sortButton("date", "Time · Date")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => {
                const start = new Date(e.start);
                const end = new Date(e.end!);
                return (
                  <tr key={e.id} className="grid grid-cols-[1fr_auto] border-b border-rule px-5 py-3 last:border-b-0 sm:table-row sm:px-0 sm:py-0">
                    <td className="min-w-0 sm:py-3.5 sm:pl-6">
                      <span className={e.description ? "" : "text-muted"}>{e.description || "(no description)"}</span>
                      <EntryMeta entry={e} state={state} />
                    </td>
                    <td className="num text-right font-medium sm:py-3.5">{formatDuration(durationOf(e))}</td>
                    <td className="hidden sm:table-cell sm:py-3.5 sm:pl-8">
                      <span className="flex items-center gap-2 text-sm">
                        <Avatar name={state.settings.member} />
                        {state.settings.member}
                      </span>
                    </td>
                    <td className="col-span-2 sm:py-3.5 sm:pr-6">
                      <span className="num block text-[13px] text-ink-2">
                        {formatClock(start)} – {formatClock(end)}
                        <span className="text-muted sm:hidden"> · {formatDate(start)}</span>
                      </span>
                      <span className="num hidden text-[13px] text-muted sm:block">{formatDate(start)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
