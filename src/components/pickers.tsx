"use client";

import { useState } from "react";
import { addProject, addTag, useStore } from "@/lib/store";
import { ColorDot, Icons, Popover } from "./ui";

function SearchField({ value, onChange, placeholder, onEnter }: { value: string; onChange: (v: string) => void; placeholder: string; onEnter: () => void }) {
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onEnter()}
      placeholder={placeholder}
      className="mb-1 w-full rounded-lg bg-sunken px-2.5 py-1.5 text-sm outline-none placeholder:text-muted"
    />
  );
}

const rowClass = "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-sunken";

export function ProjectPicker({
  value,
  onChange,
  compact = false,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  compact?: boolean;
}) {
  const { projects } = useStore();
  const [q, setQ] = useState("");
  const current = projects.find((p) => p.id === value);
  const matches = projects.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const exact = projects.some((p) => p.name.toLowerCase() === q.trim().toLowerCase());

  return (
    <Popover
      trigger={(open, toggle) => (
        <button
          type="button"
          onClick={() => {
            setQ("");
            toggle();
          }}
          className={`flex max-w-48 items-center gap-1.5 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-sunken ${open ? "bg-sunken" : ""}`}
        >
          {current ? (
            <>
              <ColorDot color={current.color} />
              <span className="truncate font-medium" style={{ color: current.color }}>
                {current.name}
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1.5 text-muted">
              {Icons.folder}
              {!compact && "Project"}
            </span>
          )}
        </button>
      )}
    >
      {(close) => {
        const create = () => {
          if (!q.trim() || exact) return;
          onChange(addProject(q).id);
          close();
        };
        // Enter picks the first match, or creates the project when nothing matches.
        const submit = () => {
          if (matches[0] && q.trim()) {
            onChange(matches[0].id);
            close();
          } else create();
        };
        return (
          <>
            <SearchField value={q} onChange={setQ} placeholder="Find or create project" onEnter={submit} />
            <div className="max-h-64 overflow-y-auto">
              <button type="button" className={`${rowClass} text-muted`} onClick={() => (onChange(null), close())}>
                No project
                {value === null && <span className="ml-auto text-ink">{Icons.check}</span>}
              </button>
              {matches.map((p) => (
                <button key={p.id} type="button" className={rowClass} onClick={() => (onChange(p.id), close())}>
                  <ColorDot color={p.color} />
                  <span className="truncate">{p.name}</span>
                  {value === p.id && <span className="ml-auto">{Icons.check}</span>}
                </button>
              ))}
              {q.trim() && !exact && (
                <button type="button" className={`${rowClass} text-accent`} onClick={create}>
                  {Icons.plus}
                  Create “{q.trim()}”
                </button>
              )}
            </div>
          </>
        );
      }}
    </Popover>
  );
}

export function TagPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { tags } = useStore();
  const [q, setQ] = useState("");
  const selected = tags.filter((t) => value.includes(t.id));
  const matches = tags.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()));
  const exact = tags.some((t) => t.name.toLowerCase() === q.trim().toLowerCase());
  const toggleTag = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <Popover
      trigger={(open, toggle) => (
        <button
          type="button"
          aria-label="Tags"
          title="Tags"
          onClick={() => {
            setQ("");
            toggle();
          }}
          className={`flex max-w-52 items-center gap-1 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-sunken ${
            open ? "bg-sunken" : ""
          } ${selected.length ? "text-ink-2" : "text-muted"}`}
        >
          {Icons.tag}
          {selected.length > 0 && <span className="truncate">{selected.map((t) => t.name).join(", ")}</span>}
        </button>
      )}
    >
      {() => {
        const create = () => {
          if (!q.trim() || exact) return;
          onChange([...value, addTag(q).id]);
          setQ("");
        };
        return (
          <>
            <SearchField value={q} onChange={setQ} placeholder="Find or create tag" onEnter={create} />
            <div className="max-h-64 overflow-y-auto">
              {matches.map((t) => (
                <button key={t.id} type="button" className={rowClass} onClick={() => toggleTag(t.id)}>
                  <span
                    className={`grid size-4 place-items-center rounded border ${
                      value.includes(t.id) ? "border-ink bg-ink text-paper" : "border-rule-strong"
                    }`}
                  >
                    {value.includes(t.id) && <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m3 8.5 3 3 7-7" /></svg>}
                  </span>
                  {t.name}
                </button>
              ))}
              {!tags.length && !q && <p className="px-2.5 py-1.5 text-sm text-muted">No tags yet. Type to create one.</p>}
              {q.trim() && !exact && (
                <button type="button" className={`${rowClass} text-accent`} onClick={create}>
                  {Icons.plus}
                  Create “{q.trim()}”
                </button>
              )}
            </div>
          </>
        );
      }}
    </Popover>
  );
}
