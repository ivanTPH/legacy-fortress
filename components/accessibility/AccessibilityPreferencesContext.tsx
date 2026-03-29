"use client";

import { createContext, useContext } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  getDefaultAccessibilityPreferences,
  type AccessibilityPreferences,
} from "../../lib/accessibilityPreferences";

type AccessibilityPreferencesContextValue = {
  preferences: AccessibilityPreferences;
  setPreferences: Dispatch<SetStateAction<AccessibilityPreferences>>;
};

const AccessibilityPreferencesContext = createContext<AccessibilityPreferencesContextValue>({
  preferences: getDefaultAccessibilityPreferences(),
  setPreferences: () => undefined,
});

export function AccessibilityPreferencesProvider({
  value,
  children,
}: {
  value: AccessibilityPreferencesContextValue;
  children: ReactNode;
}) {
  return (
    <AccessibilityPreferencesContext.Provider value={value}>
      {children}
    </AccessibilityPreferencesContext.Provider>
  );
}

export function useAccessibilityPreferences() {
  return useContext(AccessibilityPreferencesContext);
}
