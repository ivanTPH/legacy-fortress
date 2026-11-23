/**
 * Speed (23 Nov 2026): one signed-in page used to ask for the same small facts many times over (onboarding state
 * ten times, terms eight, preferences and access checks several each) because separate parts of the screen load
 * them independently. Reads wrapped here are shared while in flight and reused for a few seconds. Any save to the
 * same facts calls clearSharedReads(), so a change is never hidden.
 */
const DEFAULT_TTL_MS = 10_000;
const inFlight = new Map<string, Promise<unknown>>();
const settled = new Map<string, { at: number; value: unknown }>();

export function sharedRead<T>(key: string, load: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  // Browser only: on the server every request starts fresh.
  if (typeof window === "undefined") return load();
  const cached = settled.get(key);
  if (cached && Date.now() - cached.at < ttlMs) return Promise.resolve(cached.value as T);
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;
  const promise = load().then(
    (value) => { settled.set(key, { at: Date.now(), value }); return value; },
  ).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

/** Forget shared reads (all, or those whose key starts with a prefix), e.g. after a save. */
export function clearSharedReads(prefix = "") {
  for (const key of [...settled.keys()]) if (key.startsWith(prefix)) settled.delete(key);
}
