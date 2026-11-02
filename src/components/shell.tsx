"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { sampleState } from "@/lib/sample";
import { replaceAll, runningEntry, updateSettings, useStore } from "@/lib/store";
import { Icons, Popover } from "./ui";

function SettingsMenu() {
  const state = useStore();
  const [confirming, setConfirming] = useState<"sample" | "clear" | null>(null);
  const hasData = state.entries.length > 0;

  const field = (label: string, value: string, key: "member" | "workspace") => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">{label}</span>
      <input
        defaultValue={value}
        key={value}
        onBlur={(e) => e.target.value.trim() && updateSettings({ [key]: e.target.value.trim() })}
        className="rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-ink"
      />
    </label>
  );

  return (
    <Popover
      align="right"
      width={280}
      trigger={(open, toggle) => (
        <button
          type="button"
          aria-label="Settings"
          title="Settings"
          onClick={() => {
            setConfirming(null);
            toggle();
          }}
          className={`grid size-9 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink ${open ? "bg-sunken text-ink" : ""}`}
        >
          {Icons.gear}
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-3 p-2">
          {field("Your name", state.settings.member, "member")}
          {field("Workspace", state.settings.workspace, "workspace")}
          <div className="border-t border-rule pt-3">
            {confirming ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-ink-2">
                  {confirming === "sample"
                    ? "Replace all your entries with the Oct 16–31 Toggl sample?"
                    : "Delete every entry, project and tag? This can't be undone."}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      replaceAll(confirming === "sample" ? sampleState() : { entries: [], projects: [], tags: [], settings: state.settings });
                      setConfirming(null);
                      close();
                    }}
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink"
                  >
                    {confirming === "sample" ? "Replace" : "Delete all"}
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className="rounded-lg px-3 py-1.5 text-sm hover:bg-sunken">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => (hasData ? setConfirming("sample") : (replaceAll(sampleState()), close()))}
                  className="rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-sunken"
                >
                  Load Toggl sample (Oct 16–31)
                </button>
                <button type="button" disabled={!hasData} onClick={() => setConfirming("clear")} className="rounded-lg px-2.5 py-1.5 text-left text-sm text-accent hover:bg-sunken disabled:opacity-40">
                  Delete all data
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}

const NAV = [
  { href: "/", label: "Timer" },
  { href: "/reports", label: "Reports" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const state = useStore();
  const running = runningEntry(state);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.03em]">
            <span aria-hidden className={`size-2.5 rounded-[3px] ${running ? "pulse-dot bg-accent" : "bg-ink"}`} />
            clockme
          </Link>
          <nav className="flex gap-1">
            {NAV.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${active ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunken"}`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{state.ready ? state.settings.workspace : ""}</span>
            <SettingsMenu />
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </>
  );
}
