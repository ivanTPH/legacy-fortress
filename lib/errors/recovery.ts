/**
 * When TEST or live moves to a new version while a page is open, the page can ask for files from the old version
 * that no longer exist ("ChunkLoadError"). Reloading once fetches the new version and fixes it. We reload at most
 * once a minute per page, so a real fault can never cause a reload loop; anything else shows the error screen.
 */
const KEY = "lf:error-reload-at";

export function isNewVersionError(error: unknown) {
  const text = `${(error as { name?: string })?.name ?? ""} ${(error as { message?: string })?.message ?? ""}`;
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(text);
}

export function reloadOnceForNewVersion(error: unknown): boolean {
  if (typeof window === "undefined" || !isNewVersionError(error)) return false;
  try {
    const last = Number(window.sessionStorage.getItem(KEY) ?? "0");
    if (Date.now() - last < 60_000) return false;
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* storage unavailable: still reload once */ }
  window.location.reload();
  return true;
}
