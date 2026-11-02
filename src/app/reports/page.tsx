import { Suspense } from "react";
import { DetailedReport } from "@/components/report";
import { AppShell } from "@/components/shell";

export default function ReportsPage() {
  return (
    <AppShell>
      {/* The report reads its filters from the URL, so it renders on the client. */}
      <Suspense>
        <DetailedReport />
      </Suspense>
    </AppShell>
  );
}
