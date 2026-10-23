export async function hasFounderTestLauncherAccess(
  token: string | null | undefined,
  request: typeof fetch = fetch,
) {
  if (!token) return false;
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
