/**
 * Onboard a partner (owner decision 23 Nov 2026): the five things Legacy Fortress staff do to get a partner live,
 * worked out from the organisation's own records so the list always matches reality.
 *  1. Details  2. Licence (members and length)  3. Invoice paid  4. Licence switched on  5. Lead person invited
 * (and joined). Each partner shows its ticks and the one next step.
 */
export type OnboardingStepKey = "details" | "licence" | "invoice" | "active" | "lead";
export type OnboardingStep = { key: OnboardingStepKey; label: string; done: boolean; detail: string };

type Org = { status: string; primaryContactEmail?: string | null };
type Lic = { status: string; billingStatus: string; purchasedSeats: number; renewalDate?: string | null; billingReference?: string | null };
type Inv = { roleTemplate?: string; type?: string; status: string; email?: string };
type Mem = { organisationRole: string; status: string };

const PAID = new Set(["active", "current", "trial"]);

export function partnerOnboarding(input: { organisation: Org; licences: Lic[]; invitations: Inv[]; memberships?: Mem[] }) {
  const licence = input.licences.find((item) => item.status === "active") ?? input.licences[0] ?? null;
  const leadInvites = input.invitations.filter((item) => (item.roleTemplate ?? item.type) === "organisation_admin" && !["revoked", "expired", "failed"].includes(item.status));
  const leadJoined = leadInvites.some((item) => item.status === "accepted") || (input.memberships ?? []).some((item) => item.organisationRole === "organisation_admin" && item.status === "active");
  const steps: OnboardingStep[] = [
    { key: "details", label: "Organisation details", done: true, detail: input.organisation.primaryContactEmail ? `Contact ${input.organisation.primaryContactEmail}` : "Added" },
    { key: "licence", label: "Licence set up", done: Boolean(licence), detail: licence ? `${licence.purchasedSeats.toLocaleString("en-GB")} members${licence.renewalDate ? `, renews ${formatDay(licence.renewalDate)}` : ""}` : "How many members, and for how long" },
    { key: "invoice", label: "Invoice paid", done: Boolean(licence && PAID.has(licence.billingStatus)), detail: licence ? (PAID.has(licence.billingStatus) ? `Paid${licence.billingReference ? ` · ${licence.billingReference}` : ""}` : "Record the invoice number and tick when paid") : "After the licence" },
    { key: "active", label: "Licence switched on", done: licence?.status === "active", detail: licence?.status === "active" ? "Sign-up link works" : "Switch on once the invoice is paid" },
    { key: "lead", label: "Lead person invited", done: leadJoined, detail: leadJoined ? "Joined the Partner Portal" : leadInvites.length ? `Invited ${leadInvites[0].email ?? ""}, not joined yet`.trim() : "Invite who will run it at the partner" },
  ];
  const next = steps.find((step) => !step.done) ?? null;
  const done = steps.filter((step) => step.done).length;
  return { steps, next, done, total: steps.length, complete: !next, leadInvited: leadInvites.length > 0 };
}

/** Licence length dropdown → renewal date. */
export function renewalFromLength(startDate: string, months: number) {
  const date = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCMonth(date.getUTCMonth() + months);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function formatDay(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
