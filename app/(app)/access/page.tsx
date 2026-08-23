"use client";

import AccessRequestsWorkspace from "../../../components/access-requests/AccessRequestsWorkspace";

/** Canonical estate/access entry point; legacy /access-requests remains a compatibility alias. */
export default function AccessPage() {
  return <AccessRequestsWorkspace />;
}
