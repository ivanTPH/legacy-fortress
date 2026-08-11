import { requireAdminAccess, requireAdminCapability } from "@/lib/admin/access";
import { recordAdminAuditEvent } from "@/lib/admin/audit";
import { noStoreJson } from "@/lib/admin/lifecycleSecurity";

type HealthStatus = "ok" | "warning" | "unavailable";

type HealthCheck = {
  key: string;
  label: string;
  status: HealthStatus;
  detail: string;
  count?: number | null;
};

const REQUIRED_ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const EMAIL_ENV_KEYS = ["SMTP_HOST", "SMTP_USER", "SMTP_FROM", "RESEND_API_KEY", "SENDGRID_API_KEY"] as const;

export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin.ok) {
    return noStoreJson({ ok: false, message: admin.message, issue: admin.issue ?? null }, { status: admin.status });
  }

  const denied = requireAdminCapability(admin.access, "admin.dashboard.read");
  if (denied) {
    return noStoreJson({ ok: false, message: denied.message, capability: denied.capability }, { status: denied.status });
  }

  const checks = await Promise.all([
    countTable(admin.adminClient, "audit_events", "Audit event store", "Append-only admin and product audit records."),
    countTable(admin.adminClient, "admin_users", "Platform admin role store", "Canonical platform administrator records."),
    countTable(admin.adminClient, "contact_invitations", "Contact invitation store", "Customer contact invitations and delivery lifecycle records."),
    countTable(admin.adminClient, "verification_requests", "Verification queue", "Executor/contact verification review requests."),
    countTable(admin.adminClient, "probate_cases", "Probate case store", "Probate review case records."),
    countTable(admin.adminClient, "probate_case_evidence", "Probate evidence metadata", "Evidence metadata records; private document contents are not read."),
    checkRequiredEnvironment(),
    checkEmailConfiguration(),
  ]);

  const overallStatus = checks.some((check) => check.status === "unavailable")
    ? "unavailable"
    : checks.some((check) => check.status === "warning")
      ? "warning"
      : "ok";

  const deployment = {
    commitSha: getRuntimeCommitSha(),
    buildId: getRuntimeBuildId(),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
  };

  await recordAdminAuditEvent(admin.adminClient, admin.access, {
    category: "admin_review",
    action: "Admin system health opened",
    result: "success",
    resourceType: "access_policy",
    resourceLabel: "System health",
    route: "/api/internal/admin/system-health",
    metadata: {
      check_count: checks.length,
      warning_count: checks.filter((check) => check.status === "warning").length,
      unavailable_count: checks.filter((check) => check.status === "unavailable").length,
      build_id: deployment.buildId,
    },
  }).catch(() => null);

  return noStoreJson({
    ok: overallStatus !== "unavailable",
    status: overallStatus,
    generatedAt: new Date().toISOString(),
    deployment,
    checks,
  });
}

async function countTable(client: Parameters<typeof recordAdminAuditEvent>[0], table: string, label: string, detail: string): Promise<HealthCheck> {
  const result = await client.from(table).select("id", { count: "exact", head: true });
  if (result.error) {
    return {
      key: table,
      label,
      status: "unavailable",
      detail: getSafeDetail(result.error),
      count: null,
    };
  }
  return {
    key: table,
    label,
    status: "ok",
    detail,
    count: result.count ?? null,
  };
}

function checkRequiredEnvironment(): HealthCheck {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !String(process.env[key] ?? "").trim());
  return {
    key: "required_environment",
    label: "Required runtime configuration",
    status: missing.length ? "unavailable" : "ok",
    detail: missing.length ? `Missing required runtime keys: ${missing.join(", ")}` : "Required runtime keys are present. Values are intentionally hidden.",
  };
}

function checkEmailConfiguration(): HealthCheck {
  const present = EMAIL_ENV_KEYS.filter((key) => String(process.env[key] ?? "").trim());
  return {
    key: "email_configuration",
    label: "Email delivery configuration",
    status: present.length ? "ok" : "warning",
    detail: present.length
      ? "At least one recognised email provider configuration key is present. Delivery must still be proven with a staging mailbox."
      : "No recognised email provider configuration key is present in runtime environment.",
  };
}

function getSafeDetail(error: { status?: number; code?: string; message?: string }) {
  const status = Number(error.status ?? 0);
  const code = String(error.code ?? "").trim().toUpperCase();
  const message = String(error.message ?? "").toLowerCase();
  if (status === 401 || status === 403 || message.includes("jwt") || message.includes("signature")) return "authentication_failed";
  if (status >= 500 || message.includes("fetch failed") || message.includes("connection")) return "database_unreachable";
  if (code.startsWith("42") || message.includes("schema cache") || message.includes("does not exist")) return "migration_mismatch";
  return "query_failed";
}

function getRuntimeBuildId() {
  return getRuntimeCommitSha()?.slice(0, 12) || process.env.LF_BUILD_ID || "unknown";
}

function getRuntimeCommitSha() {
  const fromEnv =
    process.env.LF_BUILD_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.SOURCE_COMMIT ||
    process.env.COOLIFY_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    "";
  if (/^[0-9a-f]{7,40}$/i.test(fromEnv)) return fromEnv;
  return null;
}
