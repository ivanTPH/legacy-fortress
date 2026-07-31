import { Suspense } from "react";
import EnterpriseOperationsWorkspace from "@/components/enterprise/EnterpriseOperationsWorkspace";

export default function ApplicationEnterpriseEntryPage() {
  return (
    <Suspense fallback={<main style={{ padding: "2rem" }}>Loading Enterprise Operations...</main>}>
      <EnterpriseOperationsWorkspace />
    </Suspense>
  );
}
