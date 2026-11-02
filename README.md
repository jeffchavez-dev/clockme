# clockme

Time tracking and reports, modelled on Toggl Track's timer and Detailed report.

```bash
npm run dev
```

- **Timer** (`/`): start/stop (or press `S`), manual entries, inline editing of description, project, tags, billable, times and duration; continue and delete with undo.
- **Detailed report** (`/reports`): date presets or custom range, project/tag/billable/description filters, summary (total, billable, average daily hours = total ÷ days with time), sortable entry table. Filters live in the URL.
- **PDF export** (`/reports/print`): print layout with repeating table header and `Workspace · Page x/y` footer; opens the browser's Save as PDF.

Data is stored in `localStorage` (`src/lib/store.ts`). Settings → "Load Toggl sample" loads the Oct 16–31, 2026 entries, which reproduce Toggl's totals (50:09:26, 3.58 h/day).
