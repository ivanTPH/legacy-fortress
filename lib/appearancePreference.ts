export type AppearancePreference = "automatic" | "light" | "dark";

const KEY = "lf:v52-appearance";

export function normalizeAppearancePreference(value: unknown): AppearancePreference {
  return value === "light" || value === "dark" ? value : "automatic";
}

export function readAppearancePreference(): AppearancePreference {
  if (typeof window === "undefined") return "automatic";
  try { return normalizeAppearancePreference(window.localStorage.getItem(KEY)); }
  catch { return "automatic"; }
}

export function applyAppearancePreference(value: AppearancePreference) {
  if (typeof document === "undefined") return;
  if (value === "automatic") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = value;
}

export function saveAppearancePreference(value: AppearancePreference) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, value); } catch { /* Browser storage may be unavailable. */ }
  applyAppearancePreference(value);
}
