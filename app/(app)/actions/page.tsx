"use client";

import Link from "next/link";
import { useViewerAccess } from "../../../components/access/ViewerAccessContext";
import { Card, PageHeader, RestrictedState, Row } from "../../../components/ui/V3Primitives";

export default function ActionsPage() {
  const { viewer } = useViewerAccess();
  if (viewer.mode === "linked") return <RestrictedState reason="Your own account actions are available in your personal vault." />;
  return <div className="lf-v3-destination"><PageHeader title="Action Centre" description="Review the current action queue on your dashboard. A dedicated action list is planned for the next screen phase." /><Card><Row icon="task_alt" title="Your current actions" description="Open the existing action queue and follow its secure action links." href="/dashboard" /><Row icon="group" title="People and invitations" description="Review trusted contacts and invitation status." href="/contacts" /><Row icon="key" title="Access requests" description="Review requests waiting for your decision." href="/access-requests" /></Card><Link className="lf-v3-destination-link" href="/dashboard">View current action queue</Link></div>;
}
