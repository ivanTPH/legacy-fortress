export type AdminLifecycleErrorCode =
  | "ADMIN_AUTH_REQUIRED"
  | "ADMIN_PERMISSION_DENIED"
  | "ADMIN_INVALID_EMAIL"
  | "ADMIN_INVALID_ROLE"
  | "ADMIN_INVALID_STATUS"
  | "ADMIN_SELF_ACTION_BLOCKED"
  | "ADMIN_PROTECTED_ACCOUNT"
  | "ADMIN_LAST_SUPER_ADMIN"
  | "ADMIN_DUPLICATE_USER"
  | "ADMIN_AUDIT_FAILED"
  | "ADMIN_RATE_LIMITED"
  | "ADMIN_OPERATION_CONFLICT"
  | "ADMIN_INTERNAL_ERROR";

export type AdminLifecycleSafeError = {
  code: AdminLifecycleErrorCode;
  message: string;
  status: number;
  diagnostic?: string;
};

const SAFE_MESSAGES: Record<AdminLifecycleErrorCode, string> = {
  ADMIN_AUTH_REQUIRED: "You must be signed in to continue.",
  ADMIN_PERMISSION_DENIED: "You do not have permission to manage admin users.",
  ADMIN_INVALID_EMAIL: "Enter a valid admin email address.",
  ADMIN_INVALID_ROLE: "Choose a valid admin role.",
  ADMIN_INVALID_STATUS: "Choose a valid admin user action.",
  ADMIN_SELF_ACTION_BLOCKED: "You cannot remove your own active super-admin access.",
  ADMIN_PROTECTED_ACCOUNT: "The protected master admin account cannot be deactivated or demoted.",
  ADMIN_LAST_SUPER_ADMIN: "At least one active super admin must remain.",
  ADMIN_DUPLICATE_USER: "This admin user already exists.",
  ADMIN_AUDIT_FAILED: "Admin audit logging is unavailable, so the change was not applied.",
  ADMIN_RATE_LIMITED: "Too many admin changes were attempted. Wait and try again.",
  ADMIN_OPERATION_CONFLICT: "The admin user changed state. Reload and try again.",
  ADMIN_INTERNAL_ERROR: "Could not complete the admin change safely.",
};

const DEFAULT_STATUS: Record<AdminLifecycleErrorCode, number> = {
  ADMIN_AUTH_REQUIRED: 401,
  ADMIN_PERMISSION_DENIED: 403,
  ADMIN_INVALID_EMAIL: 400,
  ADMIN_INVALID_ROLE: 400,
  ADMIN_INVALID_STATUS: 400,
  ADMIN_SELF_ACTION_BLOCKED: 403,
  ADMIN_PROTECTED_ACCOUNT: 403,
  ADMIN_LAST_SUPER_ADMIN: 409,
  ADMIN_DUPLICATE_USER: 409,
  ADMIN_AUDIT_FAILED: 503,
  ADMIN_RATE_LIMITED: 429,
  ADMIN_OPERATION_CONFLICT: 409,
  ADMIN_INTERNAL_ERROR: 500,
};

export class AdminLifecycleError extends Error {
  code: AdminLifecycleErrorCode;
  status: number;
  diagnostic?: string;

  constructor(code: AdminLifecycleErrorCode, diagnostic?: string) {
    super(SAFE_MESSAGES[code]);
    this.name = "AdminLifecycleError";
    this.code = code;
    this.status = DEFAULT_STATUS[code];
    this.diagnostic = diagnostic;
  }
}

export function adminLifecycleError(code: AdminLifecycleErrorCode, diagnostic?: string) {
  return new AdminLifecycleError(code, diagnostic);
}

export function toAdminLifecycleSafeError(error: unknown, fallback: AdminLifecycleErrorCode = "ADMIN_INTERNAL_ERROR"): AdminLifecycleSafeError {
  if (error instanceof AdminLifecycleError) {
    return {
      code: error.code,
      message: SAFE_MESSAGES[error.code],
      status: error.status,
      diagnostic: error.diagnostic,
    };
  }
  return {
    code: fallback,
    message: SAFE_MESSAGES[fallback],
    status: DEFAULT_STATUS[fallback],
    diagnostic: error instanceof Error ? error.message : String(error ?? ""),
  };
}

export function noStoreJson(body: Record<string, unknown>, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store, private");
  return Response.json(body, {
    ...init,
    headers,
  });
}

export function safeAdminErrorResponse(error: unknown, fallback?: AdminLifecycleErrorCode) {
  const safe = toAdminLifecycleSafeError(error, fallback);
  if (safe.diagnostic) {
    console.error("[admin-lifecycle]", { code: safe.code, diagnostic: safe.diagnostic });
  }
  return noStoreJson(
    { ok: false, code: safe.code, message: safe.message },
    { status: safe.status },
  );
}

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitEntry>();

export type AdminRateLimitInput = {
  actorId: string;
  route: string;
  action: string;
  sourceIp?: string | null;
  now?: number;
  limit?: number;
  windowMs?: number;
};

export function checkAdminLifecycleRateLimit(input: AdminRateLimitInput) {
  const now = input.now ?? Date.now();
  const windowMs = input.windowMs ?? 60_000;
  const limit = input.limit ?? getAdminLifecycleRateLimit(input.action);
  const actor = input.actorId || "unknown_actor";
  const source = input.sourceIp || "unknown_ip";
  const key = `${actor}:${source}:${input.route}:${input.action}`;
  const current = rateLimitBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const, remaining: Math.max(limit - 1, 0), resetAt: now + windowMs };
  }
  if (current.count >= limit) {
    return { ok: false as const, remaining: 0, resetAt: current.resetAt };
  }
  current.count += 1;
  return { ok: true as const, remaining: Math.max(limit - current.count, 0), resetAt: current.resetAt };
}

export function getAdminLifecycleRateLimit(action: string) {
  if (action === "grant_admin") return 5;
  if (action === "change_role") return 8;
  if (action === "deactivate") return 5;
  if (action === "activate") return 8;
  return 10;
}

export function resetAdminLifecycleRateLimitForTests() {
  rateLimitBuckets.clear();
}

export function getRequestSourceIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || null;
}

export function isValidAdminEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
