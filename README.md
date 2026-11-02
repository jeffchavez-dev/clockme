# clockme

Time tracking and reports, modelled on Toggl Track's timer and Detailed report. Sign in on desktop and phone with the same email and a running timer shows on both, live.

```bash
npm run dev
```

- **Timer** (`/`): start/stop (or press `S`), manual entries, inline editing of description, project, tags, billable, times and duration; continue and delete with undo.
- **Detailed report** (`/reports`): date presets or custom range, project/tag/billable/description filters, summary (total, billable, average daily hours = total ÷ days with time), sortable entry table. Filters live in the URL.
- **PDF export** (`/reports/print`): print layout with repeating table header and `Workspace · Page x/y` footer; opens the browser's Save as PDF.
- **Installable**: on iPhone, Safari → Share → Add to Home Screen; on Android, Chrome → Install app.

## Sync (Supabase)

Without env vars the app runs local-only (`localStorage`). With them, it requires sign-in and syncs every change through Supabase, with realtime updates between devices and an offline outbox (`src/lib/store.ts`, `src/lib/cloud.ts`).

1. Create a Supabase project. In **SQL Editor**, run `supabase/migrations/0001_init.sql`.
2. **Authentication → URL Configuration**: set Site URL to the deployed URL, and add it plus `http://localhost:3000` to Redirect URLs.
3. **Authentication → Email Templates → Magic Link**: add `{{ .Token }}` to the body so the email also carries a code. Typing the code is the reliable path on phones, where the link can open in a different browser than the installed app.
4. Copy `.env.example` to `.env.local` and fill in the URL and publishable (anon) key from **Project Settings → API**.

## Deploy (Vercel)

Import the GitHub repo in Vercel, add the two `NEXT_PUBLIC_SUPABASE_*` env vars, and deploy. Then add the Vercel URL to Supabase's Redirect URLs (step 2).

Settings → "Load Toggl sample" loads the Oct 16–31, 2026 entries, which reproduce Toggl's totals (50:09:26, 3.58 h/day).
