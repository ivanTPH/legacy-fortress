"use client";

import AccessRequestsWorkspace from "../../../components/access-requests/AccessRequestsWorkspace";
import { LFPageHeader } from "../../../components/ui/LFDesignSystem";

export default function AccessRequestsPage() {
  return <section className="lf-page-stack"><LFPageHeader title="Access Requests" description="Review requests from people connected to your Fortress." /><AccessRequestsWorkspace /></section>;
}
