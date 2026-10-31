import { Suspense } from "react";
import EstateDeathReportPageClient from "./EstateDeathReportPageClient";

export default function EstateDeathReportPage() {
  return <Suspense fallback={null}><EstateDeathReportPageClient /></Suspense>;
}
