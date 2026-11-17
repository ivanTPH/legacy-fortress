"use client";

import HelpWorkspace from "../../../components/support/HelpWorkspace";
import { LFPageHeader } from "../../../components/ui/LFDesignSystem";

/** Help (UX review Stage 4). The route stays /support so existing links keep working; /help points here too. */
export default function SupportPage() {
  return <section className="lf-page-stack"><LFPageHeader title="Help" description="Quick answers, a guided set-up, and a way to reach us." /><HelpWorkspace /></section>;
}
