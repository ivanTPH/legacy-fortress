import { publicEnv } from "../env.ts";

export const SUPPORTED_AUTH_PROVIDERS = ["google", "apple"] as const;
export type AuthProvider = (typeof SUPPORTED_AUTH_PROVIDERS)[number];

export function getConfiguredAuthProviders(value = publicEnv.NEXT_PUBLIC_AUTH_PROVIDERS): AuthProvider[] {
  const configured = new Set(value.split(",").map((item) => item.trim().toLowerCase()));
  return SUPPORTED_AUTH_PROVIDERS.filter((provider) => configured.has(provider));
}
