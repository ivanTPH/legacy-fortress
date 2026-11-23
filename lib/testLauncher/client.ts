import { sharedRead } from "../sharedRead.ts";
export async function hasFounderTestLauncherAccess(
  token: string | null | undefined,
  request: typeof fetch = fetch,
) {
  if (!token) return false;
  // Shared for a few seconds: several parts of the shell asked on every page load (speed, 23 Nov 2026).
  if (request === fetch) return sharedRead(`founder-launcher:${token.slice(-16)}`, () => checkFounderAccess(token, request));
  return checkFounderAccess(token, request);
}

async function checkFounderAccess(token: string, request: typeof fetch) {
  try {
    const response = await request("/api/internal/test/environments", {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return response.ok && (await response.json()).available === true;
  } catch {
    return false;
  }
}

export function shouldOfferFounderSignInChoice({
  nextPath,
  pendingDestination,
  onboardingComplete,
  verifiedFounder,
}: {
  nextPath?: string | null;
  pendingDestination?: string | null;
  onboardingComplete: boolean;
  verifiedFounder: boolean;
}) {
  return !nextPath && !pendingDestination && onboardingComplete && verifiedFounder;
}
