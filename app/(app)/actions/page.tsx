"use client";

import { useViewerAccess } from "../../../components/access/ViewerAccessContext";
import { RestrictedState } from "../../../components/ui/V3Primitives";
import DashboardWorkspace from "../dashboard/DashboardWorkspace";

export default function ActionsPage() {
  const { viewer } = useViewerAccess();
  if (viewer.mode === "linked") return <RestrictedState reason="Your own account actions are available in your personal vault." />;
  return <DashboardWorkspace screen="actions" />;
}
