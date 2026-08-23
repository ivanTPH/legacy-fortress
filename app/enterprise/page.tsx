import { Suspense } from "react";
import EnterpriseOperationsWorkspace from "@/components/enterprise/EnterpriseOperationsWorkspace";

/** Canonical enterprise entry point. Nested legacy links remain supported by the existing workspace. */
export default function EnterprisePage() {
  return (
    <Suspense fallback={<main style={{ padding: "2rem" }}>Loading Enterprise Operations...</main>}>
      <EnterpriseOperationsWorkspace />
    </Suspense>
  );
}
