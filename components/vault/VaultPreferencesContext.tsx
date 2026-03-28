"use client";

import { createContext, useContext } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { getDefaultVaultPreferences, type VaultPreferences } from "../../lib/vaultPreferences";

type VaultPreferencesContextValue = {
  preferences: VaultPreferences;
  setPreferences: Dispatch<SetStateAction<VaultPreferences>>;
};

const VaultPreferencesContext = createContext<VaultPreferencesContextValue>({
  preferences: getDefaultVaultPreferences(),
  setPreferences: () => undefined,
});

export function VaultPreferencesProvider({
  value,
  children,
}: {
  value: VaultPreferencesContextValue;
  children: ReactNode;
}) {
  return <VaultPreferencesContext.Provider value={value}>{children}</VaultPreferencesContext.Provider>;
}

export function useVaultPreferences() {
  return useContext(VaultPreferencesContext);
}
