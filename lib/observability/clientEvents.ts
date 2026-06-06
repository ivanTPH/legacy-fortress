type EventPayload = Record<string, string | number | boolean | null | undefined>;

export function trackClientEvent(eventName: string, payload: EventPayload = {}) {
  const safePayload = { ...payload };
  if (process.env.NODE_ENV === "development") {
    console.info(`[lf:event] ${eventName}`, safePayload);
  }

  if (typeof window === "undefined") return;
  if (!shouldSendClientEvent(eventName)) return;

  const body = JSON.stringify({
    eventName,
    payload: safePayload,
    pathname: window.location.pathname,
    timestamp: new Date().toISOString(),
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/observability/client-events", new Blob([body], { type: "application/json" }));
    return;
  }

  fetch("/api/observability/client-events", {
    method: "POST",
    body,
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
    },
  }).catch(() => {
    // Observability must never interrupt the user journey.
  });
}

function shouldSendClientEvent(eventName: string) {
  return (
    eventName.startsWith("auth.callback.") ||
    eventName.startsWith("profile.avatar.") ||
    eventName.startsWith("shell.navigation.")
  );
}
