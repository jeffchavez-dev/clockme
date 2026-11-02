"use client";

// Paper version of the Detailed report. The browser's "Save as PDF" renders
// this page, so the PDF uses the same filters and math as the on-screen report.
// Running headers and footers use @page margin boxes (Chrome 131+).

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { filterChips, filterEntries, queryFromParams, summarize } from "@/lib/report";
import { durationOf, useStore } from "@/lib/store";
import { formatClock, formatDate, formatDuration } from "@/lib/time";
import { EntryMeta, rangeLabel, SummaryStats } from "./report";
import { Avatar, Icons } from "./ui";

/** Escape a string for use inside a CSS `content: "…"` value. */
const cssString = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;

export function PrintReport() {
  const state = useStore();
  const params = useSearchParams();
  const query = useMemo(() => queryFromParams(new URLSearchParams(params.toString())), [params]);
  const entries = useMemo(() => filterEntries(state, query), [state, query]);
  const summary = useMemo(() => summarize(entries), [entries]);
  const autoPrint = params.get("print") !== "0";

  // Paper is always light, whatever the viewer's OS theme.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = "light";
    return () => void delete root.dataset.theme;
  }, []);

  useEffect(() => {
    document.title = `clockme Detailed report ${query.from} to ${query.to}`;
    if (!state.ready || !autoPrint || !entries.length) return;
    // Let fonts settle so the first print pass doesn't use fallbacks.
    let cancelled = false;
    document.fonts.ready.then(() => !cancelled && window.print());
    return () => {
      cancelled = true;
    };
  }, [state.ready, autoPrint, entries.length, query]);

  if (!state.ready) return null;

  return (
    <>
      <style>{`
        @page {
          size: letter;
          margin: 0.55in 0.5in 0.65in;
          @bottom-left { content: ${cssString(state.settings.workspace)}; font: 8.5pt var(--font-plex-sans), sans-serif; color: #857c6d; }
          @bottom-right { content: "Page " counter(page) "/" counter(pages); font: 8.5pt var(--font-plex-sans), sans-serif; color: #857c6d; }
        }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; border: 0 !important; }
        }
        .sheet { --surface: #fff; --paper: #fff; }
        .sheet tr { break-inside: avoid; }
        .sheet thead { display: table-header-group; }
      `}</style>

      <div className="no-print sticky top-0 z-10 border-b border-rule bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[8.5in] items-center justify-between px-4">
          <Link href={`/reports?${params.toString().replace(/&?print=0/, "")}`} className="text-sm text-ink-2 hover:text-ink">
            ← Back to report
          </Link>
          <button type="button" onClick={() => window.print()} className="flex h-9 items-center gap-2 rounded-lg bg-ink px-3.5 text-sm font-medium text-paper hover:bg-accent">
            {Icons.download}
            Save as PDF
          </button>
        </div>
      </div>

      <article className="sheet mx-auto my-8 w-full max-w-[8.5in] bg-white px-[0.5in] py-[0.55in] text-[#17140f] shadow-[0_1px_0_#ddd5c4,0_20px_50px_-20px_rgb(23_20_15/0.35)]">
        <header className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[20px] leading-tight font-semibold tracking-[-0.015em]">Detailed report</h1>
            <p className="num mt-1 text-[12px] text-ink-2">{rangeLabel(query)}</p>
          </div>
          <div className="flex items-center gap-1.5 pt-1 text-[12px] font-semibold tracking-[-0.03em] text-muted">
            <span aria-hidden className="size-2 rounded-[2px] bg-[#d4441c]" />
            clockme
          </div>
        </header>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {filterChips(state, query).map((c) => (
            <span key={c} className="rounded-md border border-rule-strong px-2 py-0.5 text-[11px] text-ink-2">
              {c}
            </span>
          ))}
        </div>

        <section className="mt-6 rounded-xl border border-rule px-5 py-4">
          <h2 className="mb-3 text-[12px] font-semibold">Summary</h2>
          <SummaryStats summary={summary} size="sm" />
        </section>

        <section className="mt-7">
          <h2 className="mb-2 text-[12px] font-semibold">
            Time entries <span className="num font-normal text-muted">{rangeLabel(query)}</span>
          </h2>
          {entries.length === 0 ? (
            <p className="border-t border-rule py-10 text-center text-[12px] text-muted">No time entries match this range and these filters.</p>
          ) : (
            <table className="w-full text-left text-[11.5px]">
              <thead className="text-[9px] tracking-[0.08em] text-muted uppercase">
                <tr className="border-y border-rule">
                  <th className="py-2 font-medium">Description</th>
                  <th className="w-[0.9in] py-2 text-right font-medium">Duration</th>
                  <th className="w-[1.1in] py-2 pl-6 font-medium">Member</th>
                  <th className="w-[1.35in] py-2 font-medium">Time · Date</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const start = new Date(e.start);
                  return (
                    <tr key={e.id} className="border-b border-rule align-top">
                      <td className="py-2.5 pr-4">
                        {e.description || <span className="text-muted">(no description)</span>}
                        <EntryMeta entry={e} state={state} />
                      </td>
                      <td className="num py-2.5 text-right font-medium">{formatDuration(durationOf(e))}</td>
                      <td className="py-2.5 pl-6">
                        <span className="flex items-center gap-1.5">
                          <span className="scale-[0.8]">
                            <Avatar name={state.settings.member} />
                          </span>
                          {state.settings.member}
                        </span>
                      </td>
                      <td className="num py-2.5 text-[10.5px] leading-snug">
                        {formatClock(start)} – {formatClock(new Date(e.end!))}
                        <br />
                        <span className="text-muted">{formatDate(start)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </article>
    </>
  );
}
