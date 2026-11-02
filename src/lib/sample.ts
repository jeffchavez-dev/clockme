// The Oct 16–31, 2026 entries from Jeff's Toggl "Detailed report" export.
// The PDF shows start/end to the minute but durations to the second, so each
// start gets the seconds offset that makes start + duration land on the printed
// end minute. Totals must match Toggl: 50:09:26.

import type { State } from "./store";

const rows: [date: string, start: string, end: string, duration: string, description: string][] = [
  ["2026-10-31", "06:53", "09:20", "2:26:20", "Scheduling / Weekly Bio- Final"],
  ["2026-10-30", "20:55", "23:02", "2:06:42", "Weekly Bio Updates / Scheduling"],
  ["2026-10-30", "06:50", "09:19", "2:29:04", "NYC Hotels / Scheduling / Email Tracker"],
  ["2026-10-29", "20:52", "23:07", "2:14:57", "Weekly Event Preview / CRM Update / Email Tracker"],
  ["2026-10-29", "06:55", "09:01", "2:06:33", "Email Tracker updates / Scheduling"],
  ["2026-10-28", "20:50", "23:06", "2:15:47", "Scheduling / Email Tracker - CRM Updates"],
  ["2026-10-28", "06:57", "09:08", "2:11:31", "Email Tracker updates / Jay's Linkedin list update (October)"],
  ["2026-10-27", "20:57", "23:09", "2:12:49", "Guest List / Linkedin list for Jay"],
  ["2026-10-27", "06:55", "09:17", "2:21:21", "Linkedin Guest List / Rescheduling follow-up/ Email Tracker"],
  ["2026-10-26", "20:58", "23:25", "2:27:05", "Scheduling / CRM Updates"],
  ["2026-10-24", "06:53", "09:14", "2:20:37", "Scheduling / Weekly Bio / Guest List"],
  ["2026-10-23", "20:58", "23:02", "2:03:49", "Weekly Bio / Linkedin list/ Scheduling"],
  ["2026-10-23", "06:55", "09:05", "2:09:41", "Guest List - Linkedin / Weekly Event Preview / Scheduling"],
  ["2026-10-22", "20:55", "23:02", "2:06:20", "Weekly event preview / Scheduling"],
  ["2026-10-22", "06:51", "09:06", "2:14:42", "Scheduling/Email Tracker/CRM Updates"],
  ["2026-10-21", "21:00", "23:11", "2:11:21", "Scheduling/Email Tracker"],
  ["2026-10-21", "06:53", "09:06", "2:12:26", "Email Tracker/ Scheduling"],
  ["2026-10-20", "20:59", "23:03", "2:04:09", "CRM Meeting log updates/Scheduling/ Email Tracker"],
  ["2026-10-20", "06:56", "09:02", "2:05:22", "Scheduling/Email Tracker/CRM Updates"],
  ["2026-10-19", "20:57", "23:11", "2:13:56", "Email Tracker/Scheduling/CRM Updates"],
  ["2026-10-17", "06:54", "09:12", "2:17:37", "Weekly Bio Update/Scheduling/Followups"],
  ["2026-10-16", "21:00", "23:05", "2:05:00", "Weekly Bio Brief/ Research/ Scheduling / Email Tracker"],
  ["2026-10-16", "06:56", "08:09", "1:12:17", "Scheduling/Email Tracker Update/Weekly Event preview update"],
];

export function sampleState(): Omit<State, "ready"> {
  return {
    projects: [],
    tags: [],
    settings: { member: "Jeff", workspace: "Resilience Organization" },
    entries: rows.map(([date, start, end, duration, description], i) => {
      const [y, mo, d] = date.split("-").map(Number);
      const [h, m] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      const [dh, dm, ds] = duration.split(":").map(Number);
      const durSec = (dh * 60 + dm) * 60 + ds;
      const endMin = eh * 60 + em;
      let sec = 0;
      while (sec < 59 && Math.floor((h * 3600 + m * 60 + sec + durSec) / 60) < endMin) sec++;
      const startAt = new Date(y, mo - 1, d, h, m, sec);
      const endAt = new Date(startAt.getTime() + durSec * 1000);
      return {
        id: `sample-${i}`,
        description,
        start: startAt.toISOString(),
        end: endAt.toISOString(),
        projectId: null,
        tagIds: [],
        billable: false,
      };
    }),
  };
}
