export type FounderLauncherStatus = "pending" | "allowed" | "denied";

// One Auth session may emit INITIAL_SESSION and SIGNED_IN while getSession is
// resolving. Verify each token once during that hydration window so a later
// duplicate request cannot replace a confirmed result with a transient error.
export function createFounderLauncherAvailability({
  verify,
  onStatus,
  now = Date.now,
}: {
  verify: (token: string) => Promise<boolean>;
  onStatus: (status: FounderLauncherStatus) => void;
  now?: () => number;
}) {
  let status: FounderLauncherStatus = "pending";
  let token: string | null = null;
  let pendingToken: string | null = null;
  let lastVerifiedAt = 0;
  let requestId = 0;
  let observedAuthEvent = false;
  let disposed = false;

  function update(next: FounderLauncherStatus) {
    status = next;
    if (!disposed) onStatus(next);
  }

  function check(nextToken: string | null | undefined) {
    if (disposed) return;
    if (!nextToken) {
      token = null;
      pendingToken = null;
      requestId += 1;
      update("denied");
      return;
    }
    if (nextToken === pendingToken) return;
    if (nextToken === token && status === "allowed" && now() - lastVerifiedAt < 30_000) return;

    token = nextToken;
    pendingToken = nextToken;
    const currentRequest = ++requestId;
    update("pending");
    void verify(nextToken).then((allowed) => {
      if (disposed || currentRequest !== requestId || token !== nextToken) return;
      pendingToken = null;
      lastVerifiedAt = now();
      update(allowed ? "allowed" : "denied");
    }).catch(() => {
      if (disposed || currentRequest !== requestId || token !== nextToken) return;
      pendingToken = null;
      update("denied");
    });
  }

  return {
    initialSession(nextToken: string | null | undefined) {
      if (!observedAuthEvent) check(nextToken);
    },
    initialError() {
      if (!observedAuthEvent) check(null);
    },
    authEvent(event: string, nextToken: string | null | undefined) {
      // A stale empty INITIAL_SESSION must not revoke an already verified
      // SIGNED_IN session. The initial getSession call settles the empty case.
      if (event === "INITIAL_SESSION" && !nextToken) return;
      observedAuthEvent = true;
      check(event === "SIGNED_OUT" ? null : nextToken);
    },
    dispose() {
      disposed = true;
      requestId += 1;
    },
  };
}
