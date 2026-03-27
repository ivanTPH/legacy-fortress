const PROFILE_AVATAR_TRACE_KEY = "lf:profile-avatar-trace";
const PROFILE_AVATAR_TRACE_EVENT = "lf-profile-avatar-trace-updated";

function canUseWindow() {
  return typeof window !== "undefined";
}

export function isProfileAvatarTraceEnabled() {
  if (!canUseWindow() || process.env.NODE_ENV !== "development") return false;
  return new URLSearchParams(window.location.search).get("lf_dev_profile_trace") === "1";
}

export function readProfileAvatarTrace() {
  if (!canUseWindow()) return [] as string[];
  try {
    const raw = window.sessionStorage.getItem(PROFILE_AVATAR_TRACE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export function clearProfileAvatarTrace() {
  if (!isProfileAvatarTraceEnabled()) return;
  window.sessionStorage.removeItem(PROFILE_AVATAR_TRACE_KEY);
  window.dispatchEvent(new CustomEvent(PROFILE_AVATAR_TRACE_EVENT));
}

export function appendProfileAvatarTrace(message: string) {
  if (!isProfileAvatarTraceEnabled()) return;
  const next = [...readProfileAvatarTrace(), `${new Date().toISOString()} ${message}`].slice(-40);
  window.sessionStorage.setItem(PROFILE_AVATAR_TRACE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(PROFILE_AVATAR_TRACE_EVENT));
}

export function profileAvatarTraceEventName() {
  return PROFILE_AVATAR_TRACE_EVENT;
}

export function maskAvatarStoragePath(path: string | null | undefined) {
  const safe = String(path ?? "").trim();
  if (!safe) return "<none>";
  const parts = safe.split("/").filter(Boolean);
  if (parts.length <= 2) return safe;
  return `${parts[0]}/.../${parts[parts.length - 1]}`;
}

export function maskAvatarUrl(url: string | null | undefined) {
  const safe = String(url ?? "").trim();
  if (!safe) return "<none>";
  try {
    const parsed = new URL(safe);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "[url]";
  }
}
