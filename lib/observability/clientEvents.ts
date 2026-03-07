type EventPayload = Record<string, string | number | boolean | null | undefined>;

export function trackClientEvent(eventName: string, payload: EventPayload = {}) {
  if (process.env.NODE_ENV !== "development") return;
  const safePayload = { ...payload };
  console.info(`[lf:event] ${eventName}`, safePayload);
}
