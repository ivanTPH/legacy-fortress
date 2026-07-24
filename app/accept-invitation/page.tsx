import { Suspense } from "react";
import EnterpriseInvitationAcceptPageClient from "./EnterpriseInvitationAcceptPageClient";

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={null}>
      <EnterpriseInvitationAcceptPageClient />
    </Suspense>
  );
}
