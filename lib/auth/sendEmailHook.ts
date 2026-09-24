import { createHmac, timingSafeEqual } from "node:crypto";

export const STAGING_APP_ORIGIN = "https://test.mylegacyfortress.com";
export const STAGING_SUPABASE_ORIGIN = "https://supabase-test.mylegacyfortress.com";
export const SEND_EMAIL_ACTIONS = new Set(["signup", "recovery", "invite", "magiclink"]);

const ALLOWED_REDIRECT_PATHS = new Set(["/auth/callback", "/reset-password"]);
const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 300;

type HookHeaders = { get(name: string): string | null };

export type SendEmailHookPayload = {
  user?: { id?: unknown; email?: unknown };
  email_data?: {
    token?: unknown;
    token_hash?: unknown;
    redirect_to?: unknown;
    site_url?: unknown;
    email_action_type?: unknown;
  };
};

export type VerifiedEmailEvent = {
  eventId: string;
  actionType: "signup" | "recovery" | "invite" | "magiclink";
  recipient: string;
  tokenHash: string;
  redirectTo: string;
  verificationUrl: string;
};

export type ResendConfig = {
  apiKey: string;
  from: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type DeliveryResult = { providerId: string | null };

export type RedirectDiagnostic = {
  parseable: boolean;
  protocol: "https" | "http" | "other" | "none";
  origin: "staging" | "production" | "other" | "none";
  path: "reset-password" | "auth-callback" | "root" | "other" | "none";
  trailingSlash: boolean;
  hasQuery: boolean;
  hasHash: boolean;
};

const seenWebhookIds = new Map<string, number>();

function headerValue(headers: HookHeaders, name: string) {
  return headers.get(name) ?? headers.get(name.toLowerCase()) ?? "";
}

function decodeSecret(secret: string) {
  const value = secret.trim();
  const encoded = value.startsWith("v1,whsec_") ? value.slice("v1,whsec_".length) : "";
  if (!encoded) throw new Error("invalid_hook_secret");
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.length < 16) throw new Error("invalid_hook_secret");
  return decoded;
}

function safeEqual(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function classifyStagingRedirect(value: string): RedirectDiagnostic {
  try {
    const redirect = new URL(value);
    const normalizedPath = redirect.pathname.replace(/\/+$/, "") || "/";
    return {
      parseable: true,
      protocol: redirect.protocol === "https:" ? "https" : redirect.protocol === "http:" ? "http" : "other",
      origin: redirect.origin === STAGING_APP_ORIGIN
        ? "staging"
        : redirect.origin === "https://legacy-fortress.vercel.app" ? "production" : "other",
      path: normalizedPath === "/reset-password" ? "reset-password"
        : normalizedPath === "/auth/callback" ? "auth-callback"
          : normalizedPath === "/" ? "root" : "other",
      trailingSlash: redirect.pathname.length > 1 && redirect.pathname.endsWith("/"),
      hasQuery: Boolean(redirect.search),
      hasHash: Boolean(redirect.hash),
    };
  } catch {
    return {
      parseable: false,
      protocol: "none",
      origin: "none",
      path: "none",
      trailingSlash: false,
      hasQuery: false,
      hasHash: false,
    };
  }
}

function verifySignature(body: string, headers: HookHeaders, secret: string, nowSeconds: number) {
  const eventId = headerValue(headers, "webhook-id");
  const timestamp = headerValue(headers, "webhook-timestamp");
  const signatures = headerValue(headers, "webhook-signature").split(" ").filter(Boolean);
  const timestampSeconds = Number(timestamp);

  if (!eventId || !timestamp || !Number.isInteger(timestampSeconds)) throw new Error("invalid_hook_headers");
  if (Math.abs(nowSeconds - timestampSeconds) > DEFAULT_SIGNATURE_TOLERANCE_SECONDS) throw new Error("stale_hook");
  if (seenWebhookIds.has(eventId)) throw new Error("replayed_hook");

  const signedContent = `${eventId}.${timestamp}.${body}`;
  const valid = secret.split("|").some((candidate) => signatures.some((signature) => {
    const [version, encoded] = signature.split(",", 2);
    if (version !== "v1" || !encoded) return false;
    return safeEqual(
      createHmac("sha256", decodeSecret(candidate)).update(signedContent).digest(),
      Buffer.from(encoded, "base64"),
    );
  }));
  if (!valid) throw new Error("invalid_hook_signature");

  seenWebhookIds.set(eventId, nowSeconds + DEFAULT_SIGNATURE_TOLERANCE_SECONDS);
  for (const [id, expiry] of seenWebhookIds) {
    if (expiry < nowSeconds) seenWebhookIds.delete(id);
  }
  return eventId;
}

function requireStagingEnvironment(env: NodeJS.ProcessEnv) {
  const appEnv = String(env.APP_ENV ?? env.LEGACY_FORTRESS_ENV ?? env.VERCEL_ENV ?? "").trim().toLowerCase();
  if (appEnv !== "staging") throw new Error("staging_only");
  if (String(env.NODE_ENV ?? "").trim().toLowerCase() === "production" && appEnv !== "staging") {
    throw new Error("production_refused");
  }
}

export function buildVerificationUrl(supabaseOrigin: string, tokenHash: string, actionType: string, redirectTo: string) {
  const origin = new URL(supabaseOrigin);
  if (origin.protocol !== "https:") throw new Error("invalid_auth_origin");
  const url = new URL("/auth/v1/verify", origin);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", actionType);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

export function validateStagingRedirect(value: string) {
  const redirect = new URL(value);
  const normalizedPath = redirect.pathname.replace(/\/+$/, "") || "/";
  if (redirect.origin !== STAGING_APP_ORIGIN || !ALLOWED_REDIRECT_PATHS.has(normalizedPath)) {
    throw new Error("invalid_staging_redirect");
  }
  return redirect.toString();
}

export function parseAndVerifyHook(
  body: string,
  headers: HookHeaders,
  env: NodeJS.ProcessEnv,
  options: { nowSeconds?: number } = {},
): VerifiedEmailEvent {
  requireStagingEnvironment(env);
  const secret = String(env.SEND_EMAIL_HOOK_SECRET ?? "").trim();
  if (!secret) throw new Error("hook_secret_missing");

  const eventId = verifySignature(body, headers, secret, options.nowSeconds ?? Math.floor(Date.now() / 1000));
  let payload: SendEmailHookPayload;
  try {
    payload = JSON.parse(body) as SendEmailHookPayload;
  } catch {
    throw new Error("invalid_hook_json");
  }

  const recipient = typeof payload.user?.email === "string" ? payload.user.email.trim() : "";
  const tokenHash = typeof payload.email_data?.token_hash === "string" ? payload.email_data.token_hash.trim() : "";
  const redirectTo = typeof payload.email_data?.redirect_to === "string" ? payload.email_data.redirect_to.trim() : "";
  const actionType = typeof payload.email_data?.email_action_type === "string" ? payload.email_data.email_action_type.trim() : "";
  if (!recipient || !tokenHash || !redirectTo || !SEND_EMAIL_ACTIONS.has(actionType)) throw new Error("invalid_email_event");

  let verifiedRedirect: string;
  try {
    verifiedRedirect = validateStagingRedirect(redirectTo);
  } catch {
    const error = new Error("invalid_staging_redirect") as Error & { redirectDiagnostic?: RedirectDiagnostic };
    error.redirectDiagnostic = classifyStagingRedirect(redirectTo);
    throw error;
  }
  return {
    eventId,
    actionType: actionType as VerifiedEmailEvent["actionType"],
    recipient,
    tokenHash,
    redirectTo: verifiedRedirect,
    verificationUrl: buildVerificationUrl(STAGING_SUPABASE_ORIGIN, tokenHash, actionType, verifiedRedirect),
  };
}

export function renderAuthEmail(event: VerifiedEmailEvent, senderName = "Legacy Fortress Staging") {
  const subjects: Record<VerifiedEmailEvent["actionType"], string> = {
    recovery: "Reset your Legacy Fortress password",
    signup: "Confirm your Legacy Fortress account",
    invite: "You have been invited to Legacy Fortress",
    magiclink: "Sign in to Legacy Fortress",
  };
  const actionText: Record<VerifiedEmailEvent["actionType"], string> = {
    recovery: "Use the secure link below to reset your password.",
    signup: "Use the secure link below to confirm your account.",
    invite: "Use the secure link below to accept your invitation.",
    magiclink: "Use the secure link below to sign in.",
  };
  const escapedUrl = event.verificationUrl.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  return {
    subject: subjects[event.actionType],
    text: `${actionText[event.actionType]}\n\n${event.verificationUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>${actionText[event.actionType]}</p><p><a href="${escapedUrl}">Continue to Legacy Fortress</a></p><p>If you did not request this, you can ignore this email.</p><p>${senderName}</p>`,
  };
}

export function validateStagingSender(from: string) {
  const normalized = from.trim().toLowerCase();
  const address = normalized.match(/<([^<>]+)>$/)?.[1] ?? normalized;
  const at = address.lastIndexOf("@");
  if (!address || at <= 0 || address.slice(at + 1) !== "mail.mylegacyfortress.com" || address.includes(",")) {
    throw new Error("invalid_staging_sender");
  }
  return from.trim();
}

export async function deliverWithResend(event: VerifiedEmailEvent, config: ResendConfig): Promise<DeliveryResult> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 8000);
  try {
    const message = renderAuthEmail(event);
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `legacy-fortress-auth-hook/${event.eventId}`,
      },
      body: JSON.stringify({ from: config.from, to: [event.recipient], subject: message.subject, text: message.text, html: message.html }),
    });
    if (!response.ok) throw new Error(`resend_http_${response.status}`);
    let providerId: string | null = null;
    try {
      const responseBody = (await response.json()) as { id?: unknown };
      providerId = typeof responseBody.id === "string" ? responseBody.id : null;
    } catch {
      providerId = null;
    }
    return { providerId };
  } finally {
    clearTimeout(timeout);
  }
}
