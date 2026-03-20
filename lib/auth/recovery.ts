export type RecoveryParams = {
  code: string | null;
  tokenHash: string | null;
  type: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  hasPkceCode: boolean;
};

export function parseRecoveryParams(urlString: string): RecoveryParams {
  const url = new URL(urlString);
  const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);

  return {
    code: url.searchParams.get("code"),
    tokenHash: url.searchParams.get("token_hash"),
    type: url.searchParams.get("type"),
    accessToken: hash.get("access_token"),
    refreshToken: hash.get("refresh_token"),
    hasPkceCode: Boolean(url.searchParams.get("code")),
  };
}

export function getRecoveryValidationMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (!message) return "This recovery link is invalid. Please request a new password reset email.";

  if (message.includes("otp") || message.includes("token") || message.includes("expired")) {
    return "This recovery link is invalid or expired. Please request a new password reset email.";
  }

  if (message.includes("pkce code verifier not found")) {
    return "This recovery link is invalid or expired. Please request a new password reset email.";
  }

  return "Could not validate this recovery link. Please request a new password reset email.";
}
