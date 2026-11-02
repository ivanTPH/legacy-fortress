/**
 * Notifications the person has cleared (owner request 2 Nov 2026: swipe or tap to clear).
 * Kept on this device; person notifications are also marked read on the server.
 */
const KEY = "lf:notifications:cleared";

export function loadClearedNotificationIds(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function saveClearedNotificationIds(ids: string[]) {
  const unique = Array.from(new Set(ids)).slice(-500);
  try { window.localStorage.setItem(KEY, JSON.stringify(unique)); } catch { /* optional on this device */ }
  return unique;
}
