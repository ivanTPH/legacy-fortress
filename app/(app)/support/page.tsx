"use client";

import SupportWorkspace from "../../../components/support/SupportWorkspace";
import { LFPageHeader } from "../../../components/ui/LFDesignSystem";

export default function SupportPage() {
  return <section className="lf-page-stack"><LFPageHeader title="Support" description="Find a quick answer or contact the Legacy Fortress team." /><SupportWorkspace /></section>;
}
