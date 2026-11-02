"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addEntry,
  deleteEntry,
  durationOf,
  restoreEntry,
  runningEntry,
  startTimer,
  stopTimer,
  updateEntry,
  useStore,
  type Draft,
  type Entry,
} from "@/lib/store";
import {
  atClock,
  dayKey,
  DAY,
  formatClock,
  formatDayHeading,
  formatDuration,
  fromDayKey,
  parseClock,
  parseDuration,
  startOfDay,
  startOfWeek,
} from "@/lib/time";
import { ProjectPicker, TagPicker } from "./pickers";
import { ColorDot, IconButton, Icons, Popover, useNow } from "./ui";

const EMPTY_DRAFT: Draft = { description: "", projectId: null, tagIds: [], billable: false };

// ─── Description input with suggestions ────────────────────────────────────

function DescriptionInput({
  value,
  onChange,
  onPick,
  onSubmit,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (d: Draft) => void;
  onSubmit: () => void;
  placeholder: string;
}) {
  const { entries, projects } = useStore();
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(-1);

  // Most recent use of each distinct description + project pair.
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: Draft[] = [];
    const needle = value.trim().toLowerCase();
    for (const e of [...entries].sort((a, b) => Date.parse(b.start) - Date.parse(a.start))) {
      const key = `${e.description}\u0000${e.projectId}`;
      if (!e.description || seen.has(key)) continue;
      seen.add(key);
      if (needle && !e.description.toLowerCase().includes(needle)) continue;
      if (e.description === value) continue;
      out.push({ description: e.description, projectId: e.projectId, tagIds: e.tagIds, billable: e.billable });
      if (out.length === 6) break;
    }
    return out;
  }, [entries, value]);

  const open = focused && suggestions.length > 0;

  return (
    <div className="relative min-w-0 flex-1">
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setCursor(-1);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && open) {
            e.preventDefault();
            setCursor((c) => Math.min(c + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp" && open) {
            e.preventDefault();
            setCursor((c) => Math.max(c - 1, -1));
          } else if (e.key === "Enter") {
            if (open && cursor >= 0) onPick(suggestions[cursor]);
            else onSubmit();
            setCursor(-1);
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-full bg-transparent py-2 text-[17px] outline-none placeholder:text-muted"
      />
      {open && (
        <ul className="absolute top-full left-0 z-30 mt-2 w-full max-w-lg rounded-xl border border-rule-strong bg-surface p-1.5 shadow-[0_12px_32px_-12px_rgb(23_20_15/0.35)]">
          <li className="px-2.5 pt-1 pb-1.5 text-[11px] font-medium tracking-[0.08em] text-muted uppercase">Recent</li>
          {suggestions.map((s, i) => {
            const project = projects.find((p) => p.id === s.projectId);
            return (
              <li key={`${s.description}-${s.projectId}`}>
                <button
                  type="button"
                  // mousedown so it lands before the input's blur closes the list
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPick(s);
                    setFocused(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${i === cursor ? "bg-sunken" : "hover:bg-sunken"}`}
                >
                  <span className="truncate">{s.description}</span>
                  {project && (
                    <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs" style={{ color: project.color }}>
                      <ColorDot color={project.color} />
                      {project.name}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Clock / time inputs ───────────────────────────────────────────────────

/** Text input for a wall-clock time that commits on blur/Enter and reverts if unparseable. */
function ClockInput({ value, onCommit, label }: { value: Date; onCommit: (d: Date) => void; label: string }) {
  const [text, setText] = useState(formatClock(value));
  const shown = formatClock(value);
  const [lastShown, setLastShown] = useState(shown);
  if (shown !== lastShown) {
    setLastShown(shown);
    setText(shown);
  }
  const commit = () => {
    const c = parseClock(text);
    if (c) onCommit(atClock(value, c));
    else setText(shown);
  };
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">{label}</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="num w-full rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-ink"
      />
    </label>
  );
}

function DateInput({ value, onCommit, label }: { value: Date; onCommit: (day: Date) => void; label: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">{label}</span>
      <input
        type="date"
        value={dayKey(value)}
        onChange={(e) => e.target.value && onCommit(fromDayKey(e.target.value))}
        className="num w-full rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-ink"
      />
    </label>
  );
}

/** Keep the duration, move the entry to another day. */
function moveToDay(start: Date, end: Date, day: Date): [Date, Date] {
  const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), start.getHours(), start.getMinutes(), start.getSeconds());
  return [s, new Date(s.getTime() + (end.getTime() - start.getTime()))];
}

/** An end that reads earlier than the start means the entry crossed midnight. */
function normalizeEnd(start: Date, end: Date): Date {
  return end.getTime() <= start.getTime() ? new Date(end.getTime() + DAY) : end;
}

// ─── Timer bar ─────────────────────────────────────────────────────────────

function TimerBar() {
  const state = useStore();
  const running = runningEntry(state);
  const now = useNow(!!running);
  const [mode, setMode] = useState<"timer" | "manual">("timer");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  // Manual range is seeded when manual mode opens (never during render, so
  // prerendering doesn't capture a stale clock): the last hour, minute-aligned.
  const [manualStart, setManualStart] = useState(new Date(0));
  const [manualEnd, setManualEnd] = useState(new Date(0));
  const switchMode = (m: "timer" | "manual") => {
    if (m === "manual" && mode !== "manual") {
      const end = new Date();
      end.setSeconds(0, 0);
      setManualEnd(end);
      setManualStart(new Date(end.getTime() - 3_600_000));
    }
    setMode(m);
  };

  // While running, the bar edits the running entry directly.
  const fields: Draft = running ?? draft;
  const patch = (p: Partial<Draft>) => (running ? updateEntry(running.id, p) : setDraft((d) => ({ ...d, ...p })));

  const toggle = () => {
    if (running) {
      stopTimer();
      setDraft(EMPTY_DRAFT);
    } else {
      startTimer(draft);
      setDraft(EMPTY_DRAFT);
    }
  };

  const addManual = () => {
    addEntry({ ...draft, start: manualStart.toISOString(), end: manualEnd.toISOString() });
    setDraft(EMPTY_DRAFT);
  };

  const elapsed = running ? formatDuration(durationOf(running, now)) : "0:00:00";

  useEffect(() => {
    document.title = running ? `${elapsed} · ${running.description || "(no description)"}` : "clockme";
  }, [running, elapsed]);

  // "s" toggles the timer from anywhere that isn't a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "s" || e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, [contenteditable]")) return;
      if (mode === "timer") toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <section className={`rounded-2xl border bg-surface transition-colors ${running ? "border-accent" : "border-rule"}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 sm:flex-nowrap sm:pl-5">
        <DescriptionInput
          value={fields.description}
          onChange={(description) => patch({ description })}
          onPick={(d) => patch(d)}
          onSubmit={() => mode === "timer" && !running && toggle()}
          placeholder={running ? "Add a description" : "What are you working on?"}
        />
        <div className="flex items-center gap-0.5">
          <ProjectPicker value={fields.projectId} onChange={(projectId) => patch({ projectId })} />
          <TagPicker value={fields.tagIds} onChange={(tagIds) => patch({ tagIds })} />
          <IconButton label={fields.billable ? "Billable" : "Non-billable"} active={fields.billable} onClick={() => patch({ billable: !fields.billable })}>
            {Icons.dollar}
          </IconButton>
        </div>

        {mode === "timer" ? (
          <div className="ml-auto flex items-center gap-3">
            {running ? (
              <Popover
                align="right"
                width={200}
                trigger={(_, toggleOpen) => (
                  <button type="button" onClick={toggleOpen} title="Edit start time" className="num rounded-lg px-2 py-1 text-[22px] font-medium tabular-nums hover:bg-sunken">
                    {elapsed}
                  </button>
                )}
              >
                {() => (
                  <div className="p-1.5">
                    <ClockInput
                      label="Started at"
                      value={new Date(running.start)}
                      onCommit={(d) => {
                        // A start "in the future" means yesterday, e.g. 11:50 PM entered at 12:10 AM.
                        const start = d.getTime() > Date.now() ? new Date(d.getTime() - DAY) : d;
                        updateEntry(running.id, { start: start.toISOString() });
                      }}
                    />
                  </div>
                )}
              </Popover>
            ) : (
              <span className="num px-2 text-[22px] font-medium text-muted">{elapsed}</span>
            )}
            <button
              type="button"
              onClick={toggle}
              aria-label={running ? "Stop timer" : "Start timer"}
              title={running ? "Stop (S)" : "Start (S)"}
              className={`grid size-11 place-items-center rounded-full transition-transform active:scale-95 ${
                running ? "bg-accent text-accent-ink" : "bg-ink text-paper hover:bg-accent hover:text-accent-ink"
              }`}
            >
              {running ? Icons.stop : <span className="translate-x-px">{Icons.play}</span>}
            </button>
          </div>
        ) : (
          <div className="ml-auto flex items-end gap-2">
            <div className="w-24">
              <ClockInput label="Start" value={manualStart} onCommit={(d) => {
                setManualStart(d);
                setManualEnd((e) => normalizeEnd(d, atClock(d, { h: e.getHours(), m: e.getMinutes() })));
              }} />
            </div>
            <div className="w-24">
              <ClockInput label="End" value={manualEnd} onCommit={(d) => setManualEnd(normalizeEnd(manualStart, atClock(manualStart, { h: d.getHours(), m: d.getMinutes() })))} />
            </div>
            <div className="w-36">
              <DateInput label="Date" value={manualStart} onCommit={(day) => {
                const [s, e] = moveToDay(manualStart, manualEnd, day);
                setManualStart(s);
                setManualEnd(e);
              }} />
            </div>
            <span className="num w-16 pb-1.5 text-right text-sm text-ink-2">{formatDuration(manualEnd.getTime() - manualStart.getTime())}</span>
            <button type="button" onClick={addManual} className="h-[34px] rounded-lg bg-ink px-3.5 text-sm font-medium text-paper hover:bg-accent hover:text-accent-ink">
              Add
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 border-t border-rule px-3 py-1.5 sm:px-4">
        {(["timer", "manual"] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={!!running && m === "manual"}
            onClick={() => switchMode(m)}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium disabled:opacity-40 ${
              mode === m ? "bg-sunken text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {m === "timer" ? Icons.clock : Icons.list}
            {m === "timer" ? "Timer" : "Manual entry"}
          </button>
        ))}
        {running && (
          <span className="ml-auto flex items-center gap-2 text-xs text-muted">
            <span className="pulse-dot size-1.5 rounded-full bg-accent" />
            Running since <span className="num">{formatClock(new Date(running.start))}</span>
          </span>
        )}
      </div>
    </section>
  );
}

// ─── Entry rows ────────────────────────────────────────────────────────────

function EntryRow({ entry, onDelete }: { entry: Entry; onDelete: (e: Entry) => void }) {
  const start = new Date(entry.start);
  const end = new Date(entry.end!);
  const [desc, setDesc] = useState(entry.description);
  const [dur, setDur] = useState(formatDuration(durationOf(entry)));
  const [synced, setSynced] = useState({ d: entry.description, u: durationOf(entry) });
  if (synced.d !== entry.description || synced.u !== durationOf(entry)) {
    setSynced({ d: entry.description, u: durationOf(entry) });
    setDesc(entry.description);
    setDur(formatDuration(durationOf(entry)));
  }

  const setRange = (s: Date, e: Date) => updateEntry(entry.id, { start: s.toISOString(), end: e.toISOString() });

  return (
    <li className="group grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-rule px-4 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:pl-5">
      <div className="flex min-w-0 items-center gap-1">
        <input
          value={desc}
          placeholder="Add description"
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => desc !== entry.description && updateEntry(entry.id, { description: desc })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="ghost-input min-w-0 flex-1 truncate text-[15px] outline-none placeholder:text-muted"
        />
      </div>
      <div className="col-span-2 row-start-2 flex items-center gap-0.5 sm:col-span-1 sm:row-start-auto">
        <ProjectPicker compact value={entry.projectId} onChange={(projectId) => updateEntry(entry.id, { projectId })} />
        <TagPicker value={entry.tagIds} onChange={(tagIds) => updateEntry(entry.id, { tagIds })} />
        <IconButton label={entry.billable ? "Billable" : "Non-billable"} active={entry.billable} onClick={() => updateEntry(entry.id, { billable: !entry.billable })}>
          {Icons.dollar}
        </IconButton>
      </div>
      <Popover
        align="right"
        width={300}
        trigger={(open, toggle) => (
          <button
            type="button"
            onClick={toggle}
            className={`num hidden rounded-lg px-2 py-1 text-[13px] text-ink-2 hover:bg-sunken sm:block ${open ? "bg-sunken" : ""}`}
          >
            {formatClock(start)} – {formatClock(end)}
          </button>
        )}
      >
        {() => (
          <div className="grid grid-cols-2 gap-2 p-1.5">
            <ClockInput label="Start" value={start} onCommit={(s) => setRange(s, new Date(s.getTime() + (end.getTime() - start.getTime())))} />
            <ClockInput label="End" value={end} onCommit={(e) => setRange(start, normalizeEnd(start, atClock(start, { h: e.getHours(), m: e.getMinutes() })))} />
            <div className="col-span-2">
              <DateInput label="Date" value={start} onCommit={(day) => setRange(...moveToDay(start, end, day))} />
            </div>
          </div>
        )}
      </Popover>
      <div className="col-start-2 row-start-1 flex items-center gap-0.5 sm:col-start-auto sm:row-start-auto">
        <input
          value={dur}
          aria-label="Duration"
          onChange={(e) => setDur(e.target.value)}
          onBlur={() => {
            const ms = parseDuration(dur);
            if (ms && ms > 0) setRange(start, new Date(start.getTime() + ms));
            else setDur(formatDuration(durationOf(entry)));
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="ghost-input num w-[5.5rem] text-right text-[15px] font-medium outline-none"
        />
        <IconButton
          label="Continue this entry"
          onClick={() => startTimer({ description: entry.description, projectId: entry.projectId, tagIds: entry.tagIds, billable: entry.billable })}
          className="ml-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
        >
          {Icons.play}
        </IconButton>
        <IconButton label="Delete entry" onClick={() => onDelete(entry)} className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">
          {Icons.trash}
        </IconButton>
      </div>
    </li>
  );
}

const DAYS_PER_PAGE = 14;

function EntryList() {
  const state = useStore();
  const [days, setDays] = useState(DAYS_PER_PAGE);
  const [undo, setUndo] = useState<Entry | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of [...state.entries].filter((e) => e.end).sort((a, b) => Date.parse(b.start) - Date.parse(a.start))) {
      const k = dayKey(new Date(e.start));
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return [...map.entries()];
  }, [state.entries]);

  const remove = (e: Entry) => {
    deleteEntry(e.id);
    setUndo(e);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  };

  if (!state.ready) return null;

  if (!groups.length) {
    return (
      <div className="rounded-2xl border border-dashed border-rule-strong px-6 py-14 text-center">
        <p className="text-[15px] text-ink-2">No time tracked yet.</p>
        <p className="mt-1 text-sm text-muted">
          Start the timer above, or press <kbd className="num rounded border border-rule-strong px-1.5 py-0.5 text-xs">S</kbd>.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {groups.slice(0, days).map(([key, entries]) => {
          const total = entries.reduce((sum, e) => sum + durationOf(e), 0);
          return (
            <section key={key}>
              <header className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold">{formatDayHeading(fromDayKey(key))}</h2>
                <span className="num text-sm text-muted">{formatDuration(total)}</span>
              </header>
              <ul className="rounded-2xl border border-rule bg-surface">
                {entries.map((e) => (
                  <EntryRow key={e.id} entry={e} onDelete={remove} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {groups.length > days && (
        <button type="button" onClick={() => setDays((d) => d + DAYS_PER_PAGE)} className="mx-auto mt-8 block rounded-lg border border-rule-strong px-4 py-2 text-sm hover:bg-surface">
          Show older days
        </button>
      )}
      {undo && (
        <div role="status" className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-ink py-2.5 pr-2.5 pl-4 text-sm text-paper shadow-lg">
          Entry deleted
          <button
            type="button"
            onClick={() => {
              restoreEntry(undo);
              setUndo(null);
            }}
            className="rounded-lg px-2.5 py-1 font-medium text-accent hover:bg-white/10"
          >
            Undo
          </button>
        </div>
      )}
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

function WeekTotal() {
  const state = useStore();
  const running = runningEntry(state);
  const now = useNow(!!running);
  const [weekStart, today] = useMemo(() => [startOfWeek(new Date(now)).getTime(), startOfDay(new Date(now)).getTime()], [now]);
  let week = 0;
  let day = 0;
  for (const e of now ? state.entries : []) {
    const t = Date.parse(e.start);
    const ms = durationOf(e, now);
    if (t >= weekStart) week += ms;
    if (t >= today) day += ms;
  }
  return (
    <dl className="flex gap-6 text-right">
      <div>
        <dt className="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">Today</dt>
        <dd className="num text-lg font-medium">{formatDuration(day)}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">This week</dt>
        <dd className="num text-lg font-medium">{formatDuration(week)}</dd>
      </div>
    </dl>
  );
}

export function TimerView() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-24 sm:px-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h1 className="text-[28px] leading-none font-semibold tracking-[-0.02em]">Timer</h1>
        <WeekTotal />
      </div>
      <TimerBar />
      <div className="mt-10">
        <EntryList />
      </div>
    </div>
  );
}
