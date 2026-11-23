import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveAdminRole, hasAdminCapability, type AdminCapability } from "./capabilities.ts";
import { isDeliverableAddress } from "../email/deliverable.ts";
import { validateStagingSender } from "../auth/sendEmailHook.ts";

/**
 * Staff alerts (owner decision 23 Nov 2026): when something needs a person, every active admin whose role can
 * deal with it gets a short email. It names no customer and no detail, only what kind of thing is waiting and a
 * link to Admin. At most one email per kind per hour (the audit log is the record), and the daily job sends a
 * reminder for anything still waiting, so nothing sits unseen.
 */
export const STAFF_ALERT_KINDS = {
  id_check: { capability: "verification:review", one: "ID check is waiting for review", many: "ID checks are waiting for review", href: "/admin/verification" },
  poa_check: { capability: "verification:review", one: "Power of Attorney is waiting for a check", many: "Powers of Attorney are waiting for a check", href: "/admin/authorities" },
  death_report: { capability: "estate_case_review", one: "death report or estate case is waiting for review", many: "death reports or estate cases are waiting for review", href: "/admin/probate" },
  help_message: { capability: "support:manage", one: "Help message is waiting for a reply", many: "Help messages are waiting for a reply", href: "/admin/inbox" },
  partner_enquiry: { capability: "admin.enterprise.summary.read", one: "partner enquiry is waiting", many: "partner enquiries are waiting", href: "/admin/inbox" },
} as const satisfies Record<string, { capability: AdminCapability; one: string; many: string; href: string }>;
export type StaffAlertKind = keyof typeof STAFF_ALERT_KINDS;

const AUDIT_ACTION = "Staff alert sent";
export const ALERT_GAP_MS = 60 * 60 * 1000;

export function renderStaffAlert(kind: StaffAlertKind, count: number, appUrl: string) {
  const copy = STAFF_ALERT_KINDS[kind];
  const link = `${appUrl.replace(/\/$/, "")}${copy.href}`;
  const line = `${count} ${count === 1 ? copy.one : copy.many}.`;
  return {
    subject: `Admin: ${count} ${count === 1 ? copy.one.split(" is ")[0] : copy.many.split(" are ")[0]} waiting`,
    text: `${line}\n\nOpen Admin to deal with it: ${link}\n\nThis email names no customer on purpose.`,
    html: `<p>${line}</p><p><a href="${link}">Open Admin</a> to deal with it.</p><p style="color:#6B625C">This email names no customer on purpose.</p>`,
  };
}

/** Who gets it: active admins whose role allows the work, with a real email address. */
export async function staffRecipients(client: SupabaseClient, capability: AdminCapability) {
  const { data, error } = await client.from("admin_users").select("user_id,email_normalized,status,role,is_master").eq("status", "active");
  if (error) return [];
  return [...new Set(((data ?? []) as Array<{ email_normalized: string | null; role: string | null; is_master: boolean | null }>)
    // Legacy Fortress staff only: partner organisation admins never get these.
    .filter((row) => deriveAdminRole({ isMaster: row.is_master, role: row.role }) !== "enterprise_admin")
    .filter((row) => hasAdminCapability(deriveAdminRole({ isMaster: row.is_master, role: row.role }), capability))
    .map((row) => String(row.email_normalized ?? "").trim().toLowerCase())
    .filter((email) => isDeliverableAddress(email)))];
}

/** How many of a kind are waiting now (counts only). */
export async function countWaiting(client: SupabaseClient, kind: StaffAlertKind) {
  const head = { count: "exact" as const, head: true };
  const n = async (query: PromiseLike<{ count: number | null; error: unknown }>) => { try { const r = await query; return r.error ? 0 : r.count ?? 0; } catch { return 0; } };
  if (kind === "id_check") return n(client.from("identity_verification_requests").select("id", head).eq("status", "review_required"));
  if (kind === "poa_check") return n(client.from("legal_authorities").select("id", head).in("status", ["pending_check", "needs_attention"]));
  if (kind === "death_report") {
    const [reports, cases] = await Promise.all([
      n(client.from("death_reports").select("id", head).eq("status", "submitted")),
      n(client.from("probate_cases").select("id", head).in("status", ["submitted", "needs_information", "under_review"])),
    ]);
    return reports + cases;
  }
  if (kind === "help_message") {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    try {
      const { data } = await client.from("section_entries").select("id,details").eq("section_key", "support").eq("category_key", "help_requests").gte("created_at", since).limit(500);
      return ((data ?? []) as Array<{ details: Record<string, unknown> | null }>).filter((row) => !Number(row.details?.reply_count ?? 0)).length;
    } catch { return 0; }
  }
  if (kind === "partner_enquiry") return n(client.from("partner_enquiries").select("id", head).eq("status", "new"));
  return 0;
}

export type StaffAlertResult = { kind: StaffAlertKind; sent: number; skipped?: "nothing_waiting" | "recently_sent" | "no_recipients" | "not_configured" };

/** Send the alert for one kind if anything is waiting and none went out in the last hour. Never throws. */
export async function alertStaff(client: SupabaseClient, kind: StaffAlertKind, options: { force?: boolean; source?: string } = {}): Promise<StaffAlertResult> {
  try {
    const waiting = await countWaiting(client, kind);
    if (!waiting) return { kind, sent: 0, skipped: "nothing_waiting" };
    if (!options.force) {
      const since = new Date(Date.now() - ALERT_GAP_MS).toISOString();
      const recent = await client.from("audit_events").select("id", { count: "exact", head: true })
        .eq("action", AUDIT_ACTION).eq("resource_id", kind).gte("created_at", since);
      if ((recent.count ?? 0) > 0) return { kind, sent: 0, skipped: "recently_sent" };
    }
    const recipients = await staffRecipients(client, STAFF_ALERT_KINDS[kind].capability);
    if (!recipients.length) return { kind, sent: 0, skipped: "no_recipients" };
    const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
    if (!apiKey) return { kind, sent: 0, skipped: "not_configured" };
    const from = validateStagingSender(String(process.env.RESEND_AUTH_FROM ?? ""));
    const appUrl = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://test.mylegacyfortress.com");
    const message = renderStaffAlert(kind, waiting, appUrl);
    const hour = new Date().toISOString().slice(0, 13);
    let sent = 0;
    for (const email of recipients) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `lf-staff-alert/${kind}/${hour}/${email}` },
        body: JSON.stringify({ from, to: [email], subject: message.subject, text: message.text, html: message.html }),
      }).catch(() => null);
      if (response?.ok) sent += 1;
    }
    await client.from("audit_events").insert({
      category: "admin_review", action: AUDIT_ACTION, result: sent ? "success" : "rejected", actor_user_id: null,
      actor_role: "system", resource_type: "case", resource_id: kind, resource_label: "Staff alert", route: options.source ?? "staff-alerts",
      policy_decision: "allowed", metadata: { waiting, recipients: recipients.length, sent }, created_at: new Date().toISOString(),
    });
    return { kind, sent };
  } catch {
    return { kind, sent: 0 };
  }
}

/** Daily job: remind for every kind that still has something waiting. */
export async function alertStaffForAllWaiting(client: SupabaseClient) {
  const results: StaffAlertResult[] = [];
  for (const kind of Object.keys(STAFF_ALERT_KINDS) as StaffAlertKind[]) results.push(await alertStaff(client, kind, { source: "daily-run" }));
  return results;
}
