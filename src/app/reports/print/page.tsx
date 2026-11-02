import { Suspense } from "react";
import { PrintReport } from "@/components/print-report";

export default function PrintPage() {
  return (
    <Suspense>
      <PrintReport />
    </Suspense>
  );
}
