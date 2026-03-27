"use client";

import { createContext, useContext } from "react";
import type { ViewerAccessState } from "../../lib/access-control/viewerAccess";

export type ViewerAccessContextValue = {
  viewer: ViewerAccessState;
  setLinkedGrant: (grantId: string) => void;
  clearLinkedGrant: () => void;
};

const ViewerAccessContext = createContext<ViewerAccessContextValue | null>(null);

export function ViewerAccessProvider({
  value,
  children,
}: {
  value: ViewerAccessContextValue;
  children: React.ReactNode;
}) {
  return <ViewerAccessContext.Provider value={value}>{children}</ViewerAccessContext.Provider>;
}

export function useViewerAccess() {
  const value = useContext(ViewerAccessContext);
  if (!value) {
    throw new Error("ViewerAccessContext is not available.");
  }
  return value;
}
