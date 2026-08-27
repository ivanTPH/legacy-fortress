"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import AdminWorkspaceShell from "@/components/admin/AdminWorkspaceShell";
import { ENTERPRISE_ADMIN_NAVIGATION, filterAdminNavigation } from "@/components/admin/adminNavigation";
import { waitForActiveUser } from "@/lib/auth/session";
import { supabase } from "@/lib/supabaseClient";

type Organisation = {
  id: string;
  name: string;
  legalName: string;
  tradingName: string | null;
  type: string;
  typeOther: string | null;
  registrationNumber: string | null;
  country: string;
  registeredAddress: Record<string, unknown>;
  operatingAddress: Record<string, unknown>;
  sameOperatingAddress: boolean;
  status: string;
  risk: string;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactTelephone: string | null;
  website: string | null;
  accountOwner: string | null;
  contractReference: string | null;
  customerReference: string | null;
  onboardingStatus: string;
  onboardingNotes: string | null;
  nominatedAdminName: string | null;
  nominatedAdminEmail: string | null;
  nominatedAdminRequireMfa: boolean;
  nominatedAdminExpiryDays: number;
  archivedAt: string | null;
  updatedAt: string;
};

type Licence = {
  id: string;
  plan: string;
  customPlanName: string | null;
  status: string;
  billingStatus: string;
  purchasedSeats: number;
  activeSeats: number;
  invitedSeats: number;
  suspendedSeats: number;
  availableSeats: number;
  renewalDate: string;
  contractReference: string | null;
  accountOwner: string | null;
};

type Detail = {
  organisation: Organisation;
  licences: Licence[];
  invitations: Array<{ id: string; email: string; invitationType: string; roleTemplate: string; status: string; seatId: string | null; expiresAt: string; resendCount: number }>;
  memberships: Array<{ id: string; email: string; fullName: string | null; organisationRole: string; status: string; onboardingStatus: string; consentStatus: string; seatId: string | null }>;
  enrolmentLinks: Array<{ id: string; displayName: string; status: string; maxClaims: number; claimsUsed: number; allowedEmailDomain: string | null }>;
  consentAcceptances: Array<{ id: string; organisationTermsAccepted: boolean; reportingConsent: boolean; adviserInsightConsent: boolean; marketingConsent: boolean; acceptedAt: string }>;
  auditEvents: Array<{ id: string; action: string; result: string; actor_email_normalized: string | null; actor_role: string | null; created_at: string; policy_decision: string; metadata: Record<string, unknown> }>;
};

type FormState = {
  legalName: string;
  tradingName: string;
  organisationType: string;
  organisationTypeOther: string;
  registrationNumber: string;
  country: string;
  website: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactTelephone: string;
  internalAccountOwner: string;
  contractReference: string;
  customerReference: string;
  onboardingStatus: string;
  onboardingNotes: string;
  riskStatus: string;
  nominatedAdminName: string;
  nominatedAdminEmail: string;
  nominatedAdminRequireMfa: boolean;
  nominatedAdminExpiryDays: number;
  expectedUpdatedAt: string;
};

export default function EnterpriseOrganisationDetailWorkspace({ organisationId }: { organisationId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready" | "denied" | "error">("checking");
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [navigationCapabilities, setNavigationCapabilities] = useState<string[]>([]);
  const [identity, setIdentity] = useState({ label: "Enterprise user", detail: "" });
  const [tab, setTab] = useState<"overview" | "licence" | "users" | "invitations" | "adoption" | "consent" | "reports" | "audit" | "settings">("overview");
  const [form, setForm] = useState<FormState | null>(null);
  const [reason, setReason] = useState("");
  const [inviteFormOpen, setInviteFormOpen] = useState(false);
  const [licenceForm, setLicenceForm] = useState({
    licencePlan: "starter",
    customPlanName: "",
    contractReference: "",
    billingReference: "",
    startDate: todayInput(),
    renewalDate: nextYearInput(),
    renewalNoticeDays: 90,
    purchasedSeats: 25,
    allocatedSeats: 0,
    billingStatus: "not_configured",
    licenceStatus: "active",
    accountOwner: "",
    renewalNotes: "",
  });
  const [inviteForm, setInviteForm] = useState({
    licenceId: "",
    email: "",
    fullName: "",
    invitationType: "enterprise_user",
    roleTemplate: "organisation_member",
    expiryDays: 14,
    requireMfa: false,
    internalReference: "",
    department: "",
  });
  const [enrolmentForm, setEnrolmentForm] = useState({
    licenceId: "",
    displayName: "",
    expiryDays: 14,
    maxClaims: 1,
    allowedEmailDomain: "",
    defaultRole: "organisation_member",
  });

  const authFetch = useCallback(async (input: string, init?: RequestInit) => {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token ?? "";
    const headers = new Headers(init?.headers ?? {});
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (!headers.has("content-type") && init?.body) headers.set("content-type", "application/json");
    return fetch(input, { ...init, headers });
  }, []);

  const load = useCallback(async () => {
    const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 120 });
    if (!user) {
      router.replace(`/sign-in?next=${encodeURIComponent(`/enterprise/organisations/${organisationId}`)}`);
      return;
    }
    const res = await authFetch(`/api/internal/admin/enterprise?organisationId=${encodeURIComponent(organisationId)}`);
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: Detail; message?: string };
    if (!res.ok || !json.ok || !json.detail) {
      setMessage(json.message || "This organisation is unavailable.");
      setState(res.status === 403 ? "denied" : "error");
      return;
    }
    const sessionRes = await authFetch("/api/internal/admin/session");
    const sessionJson = await sessionRes.json().catch(() => ({})) as { admin?: { displayName?: string; email?: string; role?: string; capabilities?: string[] } };
    setNavigationCapabilities(sessionRes.ok && sessionJson.admin?.capabilities?.length ? sessionJson.admin.capabilities : ["enterprise.workspace.access", "organisation:view", "licence:view"]);
    setIdentity({
      label: sessionJson.admin?.displayName || sessionJson.admin?.email || user.email || "Enterprise user",
      detail: sessionJson.admin?.role ? `${sessionJson.admin.role.replace(/_/g, " ")} · ${sessionJson.admin.email ?? user.email ?? ""}` : user.email ?? "",
    });
    setDetail(json.detail);
    setForm(toForm(json.detail.organisation));
    setState("ready");
  }, [authFetch, organisationId, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function runAction(action: string, payload: Record<string, unknown>) {
    setMessage("");
    const res = await authFetch("/api/internal/admin/enterprise", {
      method: "POST",
      body: JSON.stringify({ action, organisationId, ...payload }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; code?: string; mode?: "deleted" | "archived" };
    if (!res.ok || !json.ok) {
      setMessage(json.message || json.code || "The organisation action was blocked.");
      return;
    }
    setMessage(action === "delete_or_archive_organisation" ? "Organisation archived or deleted." : action.includes("licence") ? "Licence action completed." : "Organisation updated.");
    if (action === "delete_or_archive_organisation" && json.mode === "deleted") {
      router.replace("/enterprise");
      return;
    }
    await load();
  }

  async function signOut() {
    setDetail(null);
    setMessage("");
    await supabase.auth.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  if (state === "checking") return <main style={pageStyle}><section style={panelStyle}><h1>Checking organisation access</h1><p>Confirming your signed-in session and role permissions.</p></section></main>;
  if (state !== "ready" || !detail || !form) return <main style={pageStyle}><section style={panelStyle}><h1>{state === "denied" ? "Access denied" : "Organisation unavailable"}</h1><p>{message}</p><Link href="/enterprise">Back to Enterprise Operations</Link></section></main>;

  const org = detail.organisation;
  const navigation = filterAdminNavigation(ENTERPRISE_ADMIN_NAVIGATION, navigationCapabilities);
  return (
    <AdminWorkspaceShell
      workspaceLabel="Enterprise Operations"
      eyebrow="Legacy Fortress Enterprise"
      title={org.name}
      description={`${labelise(org.status)} · ${labelise(org.risk)} · ${org.accountOwner || "No account owner"}`}
      currentPathname={`/enterprise/organisations/${organisationId}`}
      navigation={navigation}
      onSignOut={signOut}
      identityLabel={identity.label}
      identityDetail={identity.detail}
      breadcrumbs={[{ label: "Enterprise Operations", href: "/enterprise" }, { label: "Organisations", href: "/enterprise?tab=organisations" }, { label: org.name }]}
      stagingLabel="STAGING - synthetic test data may be present"
    >
      {message ? <section style={alertStyle}>{message}</section> : null}
      <nav style={tabListStyle} aria-label="Organisation detail navigation">
        {["overview", "licence", "users", "invitations", "adoption", "consent", "reports", "audit", "settings"].map((item) => (
          <button key={item} type="button" style={tab === item ? activeTabStyle : tabStyle} onClick={() => setTab(item as typeof tab)}>{labelise(item === "users" ? "users_and_seats" : item)}</button>
        ))}
      </nav>
      {tab === "overview" ? (
        <section style={panelStyle}>
          <div style={rowStyle}>
            <button type="button" style={primaryButtonStyle} onClick={() => setTab("licence")}>{detail.licences.length ? "View licence" : "Configure licence"}</button>
            {detail.licences[0] ? <Link style={secondaryLinkStyle} href={`/enterprise/licences/${detail.licences[0].id}`}>Manage seats</Link> : null}
          </div>
          <h2>Overview</h2>
          <dl style={detailsGridStyle}>
            <Info label="Legal name" value={org.legalName} />
            <Info label="Trading name" value={org.tradingName || "Not set"} />
            <Info label="Type" value={org.type === "other" ? `Other: ${org.typeOther}` : labelise(org.type)} />
            <Info label="Registration" value={org.registrationNumber || "Not set"} />
            <Info label="Primary contact" value={`${org.primaryContactName || "Not set"} · ${org.primaryContactEmail || "No email"}`} />
            <Info label="Telephone" value={org.primaryContactTelephone || "Not set"} />
            <Info label="Nominated administrator" value={org.nominatedAdminEmail || "No organisation administrator has accepted access."} />
            <Info label="Account owner" value={org.accountOwner || "Unassigned"} />
            <Info label="Onboarding" value={labelise(org.onboardingStatus)} />
            <Info label="Licence state" value={detail.licences.length ? `${detail.licences.length} configured` : "No licence has been configured for this organisation."} />
            <Info label="Seats state" value={detail.licences.length ? `${detail.licences.reduce((sum, licence) => sum + licence.activeSeats, 0)} active seats` : "No licence configured"} />
            <Info label="Recent activity" value={detail.auditEvents[0]?.action || "No activity yet"} />
          </dl>
          <p style={privacyStyle}>Private customer vault records, uploaded documents, legal contents and individual financial values are not queried by this workspace.</p>
        </section>
      ) : null}
      {tab === "licence" ? (
        <section style={panelStyle}>
          <h2>Licence</h2>
          {detail.licences.length ? (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead><tr><th>Plan</th><th>Status</th><th>Billing</th><th>Seats</th><th>Renewal</th><th>Actions</th></tr></thead>
                <tbody>
                  {detail.licences.map((licence) => (
                    <tr key={licence.id}>
                      <td>{licence.plan === "custom" ? licence.customPlanName || "Custom" : labelise(licence.plan)}<small>{licence.contractReference ?? "No contract reference"}</small></td>
                      <td>{labelise(licence.status)}</td>
                      <td>{labelise(licence.billingStatus)}</td>
                      <td>{licence.activeSeats + licence.invitedSeats + licence.suspendedSeats}/{licence.purchasedSeats}<small>{licence.availableSeats} available</small></td>
                      <td>{formatDate(licence.renewalDate)}</td>
                      <td><Link href={`/enterprise/licences/${licence.id}`}>View licence</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={stackStyle}>
              <p style={mutedStyle}>No licence has been configured for this organisation.</p>
              <h3>1. Plan</h3>
              <label style={labelStyle}>Licence plan<select value={licenceForm.licencePlan} onChange={(event) => setLicenceForm({ ...licenceForm, licencePlan: event.target.value })}><option value="starter">Starter</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option><option value="custom">Custom</option></select></label>
              {licenceForm.licencePlan === "custom" ? <FormInput label="Custom plan name" required value={licenceForm.customPlanName} onChange={(customPlanName) => setLicenceForm({ ...licenceForm, customPlanName })} /> : null}
              <FormInput label="Contract reference" value={licenceForm.contractReference} onChange={(contractReference) => setLicenceForm({ ...licenceForm, contractReference })} />
              <FormInput label="Billing reference" value={licenceForm.billingReference} onChange={(billingReference) => setLicenceForm({ ...licenceForm, billingReference })} />
              <h3>2. Entitlement</h3>
              <FormInput label="Purchased seats" type="number" required value={String(licenceForm.purchasedSeats)} onChange={(value) => setLicenceForm({ ...licenceForm, purchasedSeats: Number(value) })} />
              <p style={privacyStyle}>Committed seats: {licenceForm.allocatedSeats}. Available seats after save: {Math.max(licenceForm.purchasedSeats - licenceForm.allocatedSeats, 0)}.</p>
              <h3>3. Renewal and status</h3>
              <FormInput label="Start date" type="date" required value={licenceForm.startDate} onChange={(startDate) => setLicenceForm({ ...licenceForm, startDate })} />
              <FormInput label="Renewal date" type="date" required value={licenceForm.renewalDate} onChange={(renewalDate) => setLicenceForm({ ...licenceForm, renewalDate })} />
              <FormInput label="Renewal notice days" type="number" value={String(licenceForm.renewalNoticeDays)} onChange={(value) => setLicenceForm({ ...licenceForm, renewalNoticeDays: Number(value) })} />
              <label style={labelStyle}>Initial status<select value={licenceForm.licenceStatus} onChange={(event) => setLicenceForm({ ...licenceForm, licenceStatus: event.target.value })}><option value="draft">Draft</option><option value="pending_approval">Pending approval</option><option value="active">Active</option></select></label>
              <label style={labelStyle}>Billing status<select value={licenceForm.billingStatus} onChange={(event) => setLicenceForm({ ...licenceForm, billingStatus: event.target.value })}><option value="not_configured">Not configured</option><option value="trial">Trial</option><option value="active">Active</option><option value="past_due">Past due</option></select></label>
              <FormInput label="Account owner" value={licenceForm.accountOwner} onChange={(accountOwner) => setLicenceForm({ ...licenceForm, accountOwner })} />
              <label style={labelStyle}>Renewal notes<textarea value={licenceForm.renewalNotes} onChange={(event) => setLicenceForm({ ...licenceForm, renewalNotes: event.target.value })} /></label>
              <h3>4. Review</h3>
              <p style={privacyStyle}>This will create a {labelise(licenceForm.licencePlan)} licence with {licenceForm.purchasedSeats} purchased seats. No customer vault data is used.</p>
              <button type="button" style={primaryButtonStyle} onClick={() => runAction("create_licence", { ...licenceForm, organisationId })}>Create licence</button>
            </div>
          )}
        </section>
      ) : null}
      {tab === "audit" ? (
        <section style={panelStyle}>
          <h2>Audit</h2>
          <table style={tableStyle}><thead><tr><th>When</th><th>Action</th><th>Result</th><th>Actor role</th></tr></thead><tbody>
            {detail.auditEvents.map((event) => <tr key={event.id}><td>{formatDate(event.created_at)}</td><td>{event.action}</td><td>{event.result}</td><td>{event.actor_role || "Unknown"}</td></tr>)}
            {detail.auditEvents.length === 0 ? <tr><td colSpan={4}>No audit events for this organisation yet.</td></tr> : null}
          </tbody></table>
        </section>
      ) : null}
      {tab === "users" ? (
        <section style={panelStyle}>
          <h2>Users and seats</h2>
          <dl style={detailsGridStyle}>
            <Info label="Active members" value={String(detail.memberships.filter((item) => item.status === "active").length)} />
            <Info label="Invited seats" value={String(detail.licences.reduce((sum, licence) => sum + licence.invitedSeats, 0))} />
            <Info label="Available seats" value={String(detail.licences.reduce((sum, licence) => sum + licence.availableSeats, 0))} />
            <Info label="Consent accepted" value={String(detail.consentAcceptances.length)} />
          </dl>
          <table style={tableStyle}><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Seat</th><th>Consent</th><th>Actions</th></tr></thead><tbody>
            {detail.memberships.map((member) => (
              <tr key={member.id}>
                <td>{member.fullName || member.email}<small>{member.email}</small></td>
                <td>{labelise(member.organisationRole)}</td>
                <td>{labelise(member.status)}</td>
                <td>{member.seatId ? "Assigned" : "No seat"}</td>
                <td>{labelise(member.consentStatus)}</td>
                <td style={rowStyle}>
                  <button type="button" style={secondaryButtonStyle} onClick={() => runAction("transition_membership", { membershipId: member.id, status: member.status === "suspended" ? "active" : "suspended", reason })}>{member.status === "suspended" ? "Reactivate" : "Suspend"}</button>
                  <button type="button" style={secondaryButtonStyle} onClick={() => runAction("transition_membership", { membershipId: member.id, status: "removed", reason })}>Remove</button>
                </td>
              </tr>
            ))}
            {detail.memberships.length === 0 ? <tr><td colSpan={6}>No organisation users have accepted access yet.</td></tr> : null}
          </tbody></table>
          <p style={privacyStyle}>Organisation membership is separate from the user’s personal vault. Suspending or removing access does not delete their personal account.</p>
        </section>
      ) : null}
      {tab === "invitations" ? (
        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2>Invitations</h2>
              <p style={mutedStyle}>Current invitations are shown before contextual administrator and user invite controls.</p>
            </div>
            <button type="button" style={primaryButtonStyle} onClick={() => setInviteFormOpen(true)}>Invite administrator</button>
          </div>
          {inviteFormOpen ? (
            <section style={contextPanelStyle} aria-label="Invite administrator or user form">
              <h3>Invite administrator or user</h3>
              <label style={labelStyle}>Licence<select value={inviteForm.licenceId} onChange={(event) => setInviteForm({ ...inviteForm, licenceId: event.target.value })}><option value="">No seat allocation</option>{detail.licences.map((licence) => <option key={licence.id} value={licence.id}>{licence.plan} · {licence.availableSeats} available</option>)}</select></label>
              <label style={labelStyle}>Invitation type<select value={inviteForm.invitationType} onChange={(event) => setInviteForm({ ...inviteForm, invitationType: event.target.value })}><option value="enterprise_user">Enterprise user</option><option value="organisation_admin">Organisation administrator</option></select></label>
              <label style={labelStyle}>Role<select value={inviteForm.roleTemplate} onChange={(event) => setInviteForm({ ...inviteForm, roleTemplate: event.target.value })}><option value="organisation_member">Organisation member</option><option value="organisation_admin">Organisation administrator</option><option value="organisation_licence_manager">Licence manager</option><option value="organisation_user_manager">User manager</option><option value="organisation_reporting_viewer">Reporting viewer</option><option value="organisation_auditor">Auditor/read-only</option></select></label>
              <FormInput label="Email" required value={inviteForm.email} onChange={(email) => setInviteForm({ ...inviteForm, email })} />
              <FormInput label="Full name" value={inviteForm.fullName} onChange={(fullName) => setInviteForm({ ...inviteForm, fullName })} />
              <FormInput label="Department" value={inviteForm.department} onChange={(department) => setInviteForm({ ...inviteForm, department })} />
              <FormInput label="Expiry days" type="number" value={String(inviteForm.expiryDays)} onChange={(value) => setInviteForm({ ...inviteForm, expiryDays: Number(value) })} />
              <label style={checkboxStyle}><input type="checkbox" checked={inviteForm.requireMfa} onChange={(event) => setInviteForm({ ...inviteForm, requireMfa: event.target.checked })} /> Require MFA</label>
              <div style={rowStyle}>
                <button type="button" style={primaryButtonStyle} onClick={() => runAction(inviteForm.invitationType === "organisation_admin" ? "invite_organisation_admin" : "invite_enterprise_user", inviteForm).then(() => setInviteFormOpen(false))}>Send invitation</button>
                <button type="button" style={secondaryButtonStyle} onClick={() => setInviteFormOpen(false)}>Cancel</button>
              </div>
            </section>
          ) : null}
          <h2>Enrolment link</h2>
          <label style={labelStyle}>Licence<select value={enrolmentForm.licenceId} onChange={(event) => setEnrolmentForm({ ...enrolmentForm, licenceId: event.target.value })}><option value="">Select licence</option>{detail.licences.map((licence) => <option key={licence.id} value={licence.id}>{licence.plan} · {licence.availableSeats} available</option>)}</select></label>
          <FormInput label="Display name" required value={enrolmentForm.displayName} onChange={(displayName) => setEnrolmentForm({ ...enrolmentForm, displayName })} />
          <FormInput label="Claim limit" type="number" value={String(enrolmentForm.maxClaims)} onChange={(value) => setEnrolmentForm({ ...enrolmentForm, maxClaims: Number(value) })} />
          <FormInput label="Allowed email domain" value={enrolmentForm.allowedEmailDomain} onChange={(allowedEmailDomain) => setEnrolmentForm({ ...enrolmentForm, allowedEmailDomain })} />
          <button type="button" style={primaryButtonStyle} onClick={() => runAction("create_enrolment_link", enrolmentForm)}>Create enrolment link</button>
          <h2>Invitation history</h2>
          <table style={tableStyle}><thead><tr><th>Recipient</th><th>Role</th><th>Status</th><th>Seat</th><th>Actions</th></tr></thead><tbody>
            {detail.invitations.map((item) => <tr key={item.id}><td>{item.email}</td><td>{labelise(item.roleTemplate)}</td><td>{labelise(item.status)}</td><td>{item.seatId ? "Reserved" : "Not reserved"}</td><td style={rowStyle}><button type="button" style={secondaryButtonStyle} onClick={() => runAction("update_invitation", { invitationId: item.id, status: "sent" })}>Resend</button><button type="button" style={secondaryButtonStyle} onClick={() => runAction("update_invitation", { invitationId: item.id, status: "revoked" })}>Revoke</button></td></tr>)}
            {detail.invitations.length === 0 ? <tr><td colSpan={5}>No invitations have been sent for this organisation.</td></tr> : null}
          </tbody></table>
          <h2>Enrolment links</h2>
          <table style={tableStyle}><thead><tr><th>Name</th><th>Status</th><th>Claims</th><th>Domain</th></tr></thead><tbody>
            {detail.enrolmentLinks.map((link) => <tr key={link.id}><td>{link.displayName}</td><td>{labelise(link.status)}</td><td>{link.claimsUsed}/{link.maxClaims}</td><td>{link.allowedEmailDomain || "Any"}</td></tr>)}
            {detail.enrolmentLinks.length === 0 ? <tr><td colSpan={4}>No enrolment links have been created.</td></tr> : null}
          </tbody></table>
        </section>
      ) : null}
      {tab === "settings" ? (
        <section style={panelStyle}>
          <h2>Edit organisation</h2>
          <FormInput label="Legal name" required value={form.legalName} onChange={(legalName) => setForm({ ...form, legalName })} />
          <FormInput label="Trading name" value={form.tradingName} onChange={(tradingName) => setForm({ ...form, tradingName })} />
          <FormInput label="Registration number" value={form.registrationNumber} onChange={(registrationNumber) => setForm({ ...form, registrationNumber })} />
          <label style={labelStyle}>Organisation type<select value={form.organisationType} onChange={(event) => setForm({ ...form, organisationType: event.target.value })}>
            <option value="employer">Employer</option><option value="law_firm">Law firm</option><option value="wealth_manager">Wealth manager</option><option value="insurer">Insurer</option><option value="funeral_provider">Funeral provider</option><option value="employee_benefit_provider">Employee-benefit provider</option><option value="enterprise_reseller">Enterprise reseller</option><option value="other">Other</option>
          </select></label>
          {form.organisationType === "other" ? <FormInput label="Other organisation type" required value={form.organisationTypeOther} onChange={(organisationTypeOther) => setForm({ ...form, organisationTypeOther })} /> : null}
          <FormInput label="Primary contact email" required value={form.primaryContactEmail} onChange={(primaryContactEmail) => setForm({ ...form, primaryContactEmail })} />
          <FormInput label="Internal account owner" required value={form.internalAccountOwner} onChange={(internalAccountOwner) => setForm({ ...form, internalAccountOwner })} />
          <FormInput label="Nominated administrator email" value={form.nominatedAdminEmail} onChange={(nominatedAdminEmail) => setForm({ ...form, nominatedAdminEmail })} />
          <label style={labelStyle}>Risk<select value={form.riskStatus} onChange={(event) => setForm({ ...form, riskStatus: event.target.value })}><option value="normal">Normal</option><option value="watch">Watch</option><option value="at_risk">At risk</option><option value="critical">Critical</option></select></label>
          <label style={labelStyle}>Onboarding<select value={form.onboardingStatus} onChange={(event) => setForm({ ...form, onboardingStatus: event.target.value })}><option value="not_started">Not started</option><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="complete">Complete</option></select></label>
          <button type="button" style={primaryButtonStyle} onClick={() => runAction("update_organisation", form)}>Save organisation</button>
          <h2>Lifecycle</h2>
          <FormInput label="Reason" value={reason} onChange={setReason} />
          <div style={rowStyle}>
            <button type="button" style={secondaryButtonStyle} onClick={() => runAction("transition_organisation", { status: org.status === "suspended" ? "active" : "suspended", reason })}>{org.status === "suspended" ? "Reactivate" : "Suspend"}</button>
            <button type="button" style={secondaryButtonStyle} onClick={() => runAction("transition_organisation", { status: "expiring", reason })}>Mark expiring</button>
            <button type="button" style={secondaryButtonStyle} onClick={() => runAction("delete_or_archive_organisation", { reason })}>Archive or delete</button>
          </div>
        </section>
      ) : null}
      {!["overview", "licence", "users", "invitations", "audit", "settings"].includes(tab) ? <section style={panelStyle}><h2>{labelise(tab)}</h2><p style={mutedStyle}>This section is staged for a later Enterprise Operations phase. No fabricated operational data is shown.</p></section> : null}
    </AdminWorkspaceShell>
  );
}

function toForm(org: Organisation): FormState {
  return {
    legalName: org.legalName,
    tradingName: org.tradingName || "",
    organisationType: org.type,
    organisationTypeOther: org.typeOther || "",
    registrationNumber: org.registrationNumber || "",
    country: org.country,
    website: org.website || "",
    primaryContactName: org.primaryContactName || "",
    primaryContactEmail: org.primaryContactEmail || "",
    primaryContactTelephone: org.primaryContactTelephone || "",
    internalAccountOwner: org.accountOwner || "",
    contractReference: org.contractReference || "",
    customerReference: org.customerReference || "",
    onboardingStatus: org.onboardingStatus || "not_started",
    onboardingNotes: org.onboardingNotes || "",
    riskStatus: org.risk,
    nominatedAdminName: org.nominatedAdminName || "",
    nominatedAdminEmail: org.nominatedAdminEmail || "",
    nominatedAdminRequireMfa: org.nominatedAdminRequireMfa,
    nominatedAdminExpiryDays: org.nominatedAdminExpiryDays || 14,
    expectedUpdatedAt: org.updatedAt,
  };
}

function FormInput({ label, value, onChange, required = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return <label style={labelStyle}>{label}{required ? " *" : ""}<input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function labelise(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function nextYearInput() {
  const next = new Date();
  next.setFullYear(next.getFullYear() + 1);
  return next.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const pageStyle: CSSProperties = { minHeight: "100vh", padding: 24, background: "#f8fafc", color: "#111827" };
const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #dbe3ef", borderRadius: 8, padding: 18, boxShadow: "0 12px 30px rgba(15,23,42,.05)", display: "grid", gap: 12 };
const mutedStyle: CSSProperties = { color: "#64748b", margin: "6px 0 0", lineHeight: 1.5 };
const privacyStyle: CSSProperties = { color: "#334155", background: "#f1f5f9", border: "1px solid #dbe3ef", borderRadius: 6, padding: 10, margin: "12px 0 0" };
const secondaryLinkStyle: CSSProperties = { color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 6, padding: "9px 12px", textDecoration: "none", background: "#fff", fontWeight: 700 };
const secondaryButtonStyle: CSSProperties = { color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 6, padding: "9px 12px", background: "#fff", fontWeight: 700 };
const primaryButtonStyle: CSSProperties = { border: 0, borderRadius: 6, padding: "10px 14px", background: "#111827", color: "#fff", fontWeight: 800 };
const alertStyle: CSSProperties = { background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 12, marginBottom: 16 };
const tabListStyle: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 };
const tabStyle: CSSProperties = { border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, padding: "9px 12px", fontWeight: 700 };
const activeTabStyle: CSSProperties = { ...tabStyle, background: "#111827", color: "#fff", borderColor: "#111827" };
const labelStyle: CSSProperties = { display: "grid", gap: 5, fontWeight: 700, color: "#334155", fontSize: 13 };
const checkboxStyle: CSSProperties = { display: "flex", gap: 8, alignItems: "flex-start", color: "#334155", fontSize: 13, lineHeight: 1.45 };
const rowStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 };
const sectionHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" };
const contextPanelStyle: CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 8, padding: 14, display: "grid", gap: 12, background: "#f8fafc" };
const stackStyle: CSSProperties = { display: "grid", gap: 12 };
const tableWrapStyle: CSSProperties = { overflowX: "auto" };
const detailsGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
