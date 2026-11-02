"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

/**
 * Re-renders every `ms` while `active`; returns the current epoch ms, floored
 * to `ms` so the snapshot is stable within a tick. The server snapshot is 0 so
 * prerendering never bakes in a build-time clock.
 */
export function useNow(active: boolean, ms = 1000): number {
  const subscribe = useCallback(
    (tick: () => void) => {
      if (!active) return () => {};
      const id = setInterval(tick, ms);
      return () => clearInterval(id);
    },
    [active, ms],
  );
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / ms) * ms,
    () => 0,
  );
}

/**
 * Minimal anchored popover. Closes on outside click and Escape.
 * `trigger` receives the open state so it can style itself.
 */
export function Popover({
  trigger,
  children,
  align = "left",
  width = 260,
}: {
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div
          style={{ width }}
          className={`absolute top-full z-30 mt-2 rounded-xl border border-rule-strong bg-surface p-1.5 shadow-[0_12px_32px_-12px_rgb(23_20_15/0.35)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function ColorDot({ color, className = "" }: { color: string; className?: string }) {
  return <span aria-hidden className={`inline-block size-2 shrink-0 rounded-full ${className}`} style={{ background: color }} />;
}

export function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="inline-grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-semibold uppercase text-paper"
    >
      {name.trim().slice(0, 1) || "?"}
    </span>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  active = false,
  className = "",
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-lg transition-colors hover:bg-sunken ${
        active ? "text-accent" : "text-muted hover:text-ink"
      } ${className}`}
    >
      {children}
    </button>
  );
}

// Hand-drawn 16px icons, stroke-based so they inherit currentColor.
const icon = (d: ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

export const Icons = {
  play: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3.5 2.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L4.4 1.7a.6.6 0 0 0-.9.5Z" />
    </svg>
  ),
  stop: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="2.5" y="2.5" width="9" height="9" rx="1.5" />
    </svg>
  ),
  dollar: icon(<path d="M8 2v12M11 4.5H6.75a2 2 0 0 0 0 4h2.5a2 2 0 0 1 0 4H5" />),
  tag: icon(
    <>
      <path d="M2.5 2.5h5l6 6-5 5-6-6v-5Z" />
      <circle cx="5.5" cy="5.5" r="0.75" fill="currentColor" />
    </>,
  ),
  folder: icon(<path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-7.5Z" />),
  trash: icon(<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />),
  check: icon(<path d="m3 8.5 3 3 7-7" />),
  plus: icon(<path d="M8 3v10M3 8h10" />),
  clock: icon(
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.5" />
    </>,
  ),
  list: icon(<path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" />),
  download: icon(<path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />),
  gear: icon(
    <>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
    </>,
  ),
  chevron: icon(<path d="m4.5 6.5 3.5 3.5 3.5-3.5" />),
};
