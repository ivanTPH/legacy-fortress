import Link from "next/link";
import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import RoleAssignmentConsole from "@/components/admin/prototype/RoleAssignmentConsole";
import { getRoleManagementDetail } from "@/components/admin/prototype/roleManagementService";
import {
  PlatformActionRow,
  PlatformChip,
  PlatformEmptyState,
  PlatformInfoTile,
  PlatformNotice,
  PlatformRestrictedState,
  platformChipRowStyle,
  platformCtaStyle,
  platformInfoGridStyle,
  platformPanelStyle,
  platformResponsiveGridStyle,
} from "@/components/ui/PlatformPrimitives";
import {
  getAccountRoleLabel,
  getPermissionLabel,
  getPlatformRoleLabel,
  type PermissionKey,
} from "@/lib/governance/rolePermissions";
import { buildPrototypePreviewHref } from "@/lib/testPersonas";
import type { CSSProperties, ReactNode } from "react";

type AdminUserDetailPageProps = {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<{ role?: string }>;
};

const permissionGroups: Array<{ title: string; permissions: PermissionKey[] }> = [
  {
    title: "Account access",
    permissions: ["view_account", "edit_account_details", "add_contacts", "delete_contacts", "assign_account_roles"],
  },
  {
    title: "Documents and executor workflows",
    permissions: ["upload_documents", "download_documents", "approve_executor_access"],
  },
  {
    title: "Reporting and enterprise",
    permissions: ["run_reports", "export_data", "edit_billing_licensing", "manage_organisations"],
  },
  {
    title: "Platform administration",
    permissions: ["view_audit_logs", "manage_platform_admins", "suspend_users", "delete_users"],
  },
];

export default async function AdminUserDetailPage({ params, searchParams }: AdminUserDetailPageProps) {
  const { userId } = await params;
  const query = await searchParams;
  const currentRole = query?.role ?? "super_admin";
  const usersHref = buildPrototypePreviewHref("/internal/admin/prototype/users", currentRole);
  const enterpriseHref = buildPrototypePreviewHref("/internal/admin/prototype/enterprise", currentRole);
  const data = getRoleManagementDetail(userId);
  const person = data.individual;

  if (!person) {
    return (
      <AdminPrototypeShell
        title="Individual not found"
        description="The requested registered individual does not exist in static prototype data."
      >
        <PlatformEmptyState
          title="No matching individual"
          detail="No role or permission data was exposed. Return to the registered individuals directory."
          icon="person_off"
          action={<Link href={usersHref} style={ctaStyle}>Back to Users & Permissions</Link>}
        />
      </AdminPrototypeShell>
    );
  }

  const allPermissions = [...person.accountPermissions, ...person.platformPermissions];

  return (
    <AdminPrototypeShell
      title={person.full_name}
      description={`${person.id} · ${person.email}`}
    >
      <PlatformNotice icon="shield" tone="default">
        Account-vault permissions belong to the account owner invitation flow. Platform and enterprise admins manage application roles, corporate/licensor rights, reporting, audit, and death-certificate unlock workflows only.
      </PlatformNotice>

      <section style={returnNavStyle} aria-label="User detail navigation">
        <Link href={enterpriseHref} style={platformCtaStyle}>Back to Enterprise Dashboard</Link>
        <Link href={usersHref} style={secondaryLinkStyle}>Back to Users & Permissions</Link>
        <Link href={buildPrototypePreviewHref("/internal/test-login", currentRole)} style={secondaryLinkStyle}>Switch workspace</Link>
      </section>

      <section style={platformInfoGridStyle}>
        <PlatformInfoTile label="Account owner status" value={person.accountOwnerStatus} />
        <PlatformInfoTile label="Account role" value={getAccountRoleLabel(person.accountRole)} />
        <PlatformInfoTile label="Platform role" value={getPlatformRoleLabel(person.platformRole)} />
        <PlatformInfoTile label="Access" value={person.accessStatus} tone={person.accessStatus === "Active" ? "success" : "warning"} />
      </section>

      <RoleAssignmentConsole people={[person]} actor={data.currentActor} />

      <section style={platformPanelStyle}>
        <h2 style={h2Style}>Role and permission actions</h2>
        <p style={mutedStyle}>Use these prototype controls to inspect the workflow state for application administration, enterprise/licensor permissions, account-owner delegation boundaries, suspension, and audit review.</p>
        <div style={{ display: "grid", gap: 8 }}>
          <PlatformActionRow
            title="Assign account role"
            detail={data.accountRoleDecision?.reason ?? "Requires assign account roles permission on the affected account."}
            status={<AdminStatusBadge status={data.accountRoleDecision?.allowed ? "Success" : "Restricted"} />}
            action={<button type="button" style={disabledButtonStyle} disabled>{data.accountRoleDecision?.allowed ? "Mock workflow" : "Requires permission"}</button>}
          />
          <PlatformActionRow
            title="Edit permission toggles"
            detail="Requires the actor to already hold the permission being granted or a Super Admin governance decision."
            status={<AdminStatusBadge status="Review" />}
            action={<button type="button" style={disabledButtonStyle} disabled>Prototype only</button>}
          />
          <PlatformActionRow
            title="Manage admin rights"
            detail={data.platformRoleDecision?.reason ?? "Requires Platform Owner or Super Admin permission."}
            status={<AdminStatusBadge status={data.platformRoleDecision?.allowed ? "Success" : "Restricted"} />}
            action={<button type="button" style={disabledButtonStyle} disabled>{data.platformRoleDecision?.allowed ? "Mock workflow" : "Requires super admin"}</button>}
          />
          <PlatformActionRow
            title="Suspend access"
            detail="Requires suspend users permission and confirmation. Prototype uses suspend/soft-delete only."
            status={<AdminStatusBadge status="Disabled" />}
            action={<button type="button" style={disabledButtonStyle} disabled>Confirmation required</button>}
          />
          <PlatformActionRow
            title="View audit trail"
            detail="Requires view audit logs permission. Successful and blocked role attempts appear in the timeline below."
            status={<AdminStatusBadge status="Success" />}
            action={<a href="#permission-audit-timeline" style={platformCtaStyle}>View audit trail</a>}
          />
        </div>
      </section>

      <section style={platformResponsiveGridStyle}>
        <section style={platformPanelStyle}>
          <h2 style={h2Style}>User summary</h2>
          <Info label="Linked account / vault" value={`${person.linkedAccountVault.label} · ${person.linkedAccountVault.id}`} />
          <Info label="Verification status" value={<AdminStatusBadge status={person.verificationStatus === "Verified" ? "Success" : person.verificationStatus === "Restricted" ? "Restricted" : "Pending"} />} />
          <Info label="Invite status" value={person.inviteStatus} />
          <Info label="Last activity" value={person.lastActivity} />
          <Info label="Source type" value={person.source_type.replace(/_/g, " ")} />
          <Info label="Workflow state" value={<AdminStatusBadge status={badgeForWorkflow(person.workflowStatus)} />} />
          <Info label="Last permission update" value={person.lastPermissionUpdate} />
          <Info label="Last audit event" value={person.lastAuditEvent} />
        </section>

        <section style={platformPanelStyle}>
          <h2 style={h2Style}>Governance visibility</h2>
          <span style={platformChipRowStyle}>
            {person.governance_flags.exportRestricted ? <PlatformChip tone="warning">Export restricted</PlatformChip> : null}
            {person.governance_flags.requiresConsentReview ? <PlatformChip tone="warning">Consent review</PlatformChip> : null}
            {person.governance_flags.requiresVerification ? <PlatformChip tone="warning">Verification required</PlatformChip> : null}
            {person.governance_flags.accountOwnerManaged ? <PlatformChip>Owner managed</PlatformChip> : null}
            {person.governance_flags.platformRoleRestricted ? <PlatformChip tone="warning">Platform role restricted</PlatformChip> : null}
            {person.governance_flags.deleteDisabled ? <PlatformChip tone="warning">Soft-delete only</PlatformChip> : null}
          </span>
          <PlatformRestrictedState
            title="Production safeguards"
            detail="Account owners cannot grant platform roles. Admins cannot grant permissions they do not hold. Delete remains disabled in prototype."
            meta="Suspend access is the prototype-safe removal path."
          />
        </section>
      </section>

      <section style={platformResponsiveGridStyle}>
        <section style={platformPanelStyle}>
          <h2 style={h2Style}>Role assignment panel</h2>
          <PlatformActionRow
            title="Account-level role"
            detail="Assigned by the account owner or an authorised platform admin."
            status={<AdminStatusBadge status={data.accountRoleDecision?.allowed ? "Success" : "Restricted"} />}
            action={<button type="button" style={disabledButtonStyle} disabled>Prototype only</button>}
          />
          <Info label="Current account role" value={getAccountRoleLabel(person.accountRole)} />
          <Info label="Decision" value={data.accountRoleDecision?.reason ?? "No account role decision available."} />
        </section>

        <section style={platformPanelStyle}>
          <h2 style={h2Style}>Admin permission management</h2>
          <PlatformActionRow
            title="Platform-level role"
            detail="Only Platform Owner or Super Admin can assign or revoke platform admin roles."
            status={<AdminStatusBadge status={data.platformRoleDecision?.allowed ? "Success" : "Restricted"} />}
            action={<button type="button" style={disabledButtonStyle} disabled>Prototype only</button>}
          />
          <Info label="Current platform role" value={getPlatformRoleLabel(person.platformRole)} />
          <Info label="Decision" value={data.platformRoleDecision?.reason ?? "No platform role decision available."} />
        </section>
      </section>

      <section style={platformPanelStyle}>
        <h2 style={h2Style}>Permission toggle matrix</h2>
        <p style={mutedStyle}>Read-only prototype toggles. These are the canonical permission keys future production role claims should resolve to.</p>
        <div style={permissionGridStyle}>
          {permissionGroups.map((group) => (
            <section key={group.title} style={permissionGroupStyle}>
              <h3 style={h3Style}>{group.title}</h3>
              {group.permissions.map((permission) => (
                <label key={permission} style={toggleRowStyle}>
                  <input
                    type="checkbox"
                    checked={allPermissions.includes(permission)}
                    disabled
                    readOnly
                    aria-label={`${getPermissionLabel(permission)} permission`}
                  />
                  <span>{getPermissionLabel(permission)}</span>
                </label>
              ))}
            </section>
          ))}
        </div>
      </section>

      <section style={platformPanelStyle}>
        <h2 style={h2Style}>Permission action states</h2>
        <p style={mutedStyle}>Actions are modelled as persistence-ready workflows. Every allowed, pending, or blocked attempt emits an audit-preview event.</p>
        <div style={{ display: "grid", gap: 8 }}>
          {data.actionStates.map((action) => (
            <PlatformActionRow
              key={action.id}
              title={action.label}
              detail={`${action.actionType.replace(/_/g, " ")} · requires ${getPermissionLabel(action.requiredPermission)} · ${action.decision.reason}`}
              status={<AdminStatusBadge status={badgeForWorkflow(action.workflowState)} />}
              action={<button type="button" style={disabledButtonStyle} disabled>{action.confirmationRequired ? "Confirmation required" : "Mock workflow"}</button>}
            />
          ))}
        </div>
      </section>

      <section style={platformResponsiveGridStyle}>
        <section style={platformPanelStyle}>
          <h2 style={h2Style}>Child / sub-user relationships</h2>
          {person.childSubUsers.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {person.childSubUsers.map((child) => (
                <PlatformActionRow
                  key={child.id}
                  title={child.name}
                  detail={`${child.id} · ${getAccountRoleLabel(child.role)} · owner-scoped access`}
                  status={<AdminStatusBadge status={child.status === "Active" ? "Success" : child.status === "Suspended" ? "Suspended" : "Pending"} />}
                  action={<button type="button" style={disabledButtonStyle} disabled>Suspend preview</button>}
                />
              ))}
            </div>
          ) : (
            <PlatformEmptyState
              title="No child or sub-user links"
              detail="This individual has no account-scoped sub-users in the prototype data."
              icon="group"
            />
          )}
        </section>

        <section style={platformPanelStyle}>
          <h2 style={h2Style}>Dangerous action controls</h2>
          <PlatformActionRow
            title="Suspend user access"
            detail="Prototype-safe soft-delete path. Requires suspend users permission and audit capture."
            status={<AdminStatusBadge status="Disabled" />}
            action={<button type="button" style={disabledButtonStyle} disabled>Confirmation required</button>}
          />
          <PlatformActionRow
            title="Delete user"
            detail={data.deleteDecision.reason}
            status={<AdminStatusBadge status="Restricted" />}
            action={<button type="button" style={disabledButtonStyle} disabled>Disabled</button>}
          />
        </section>
      </section>

      <section id="permission-audit-timeline" style={platformPanelStyle}>
        <h2 style={h2Style}>Permission change audit timeline</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {data.permissionAuditTimeline.map((event) => (
            <div key={event.id} style={auditRowStyle}>
              <span>
                <strong>{event.action}</strong>
                <span style={mutedBlockStyle}>
                  {event.actor.displayName} → {event.permissionChange.targetUser.displayName} · {event.timestamp}
                </span>
                <span style={mutedBlockStyle}>
                  Reason: {event.permissionChange.reason}
                </span>
                <span style={mutedBlockStyle}>
                  Previous: {event.permissionChange.previousRoles.join(", ") || "None"} · New: {event.permissionChange.newRoles.join(", ") || "None"}
                </span>
                <span style={mutedBlockStyle}>
                  Workflow: {event.workflow.workflow_state.replace(/_/g, " ")} · Action: {event.workflow.action_type.replace(/_/g, " ")}
                </span>
              </span>
              <AdminStatusBadge status={event.result === "blocked" ? "Blocked" : "Success"} />
            </div>
          ))}
        </div>
      </section>
    </AdminPrototypeShell>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={infoStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={{ color: "var(--lf-text)", fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function badgeForWorkflow(status: string) {
  if (status === "approved_applied") return "Success";
  if (status === "blocked" || status === "failed") return "Blocked";
  if (status === "pending_confirmation" || status === "submitted" || status === "draft_change") return "Pending";
  if (status === "reverted") return "Rejected";
  return "Review";
}

const h2Style: CSSProperties = {
  margin: 0,
  fontSize: 17,
};

const returnNavStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 10,
};

const secondaryLinkStyle: CSSProperties = {
  ...platformCtaStyle,
  background: "#fff",
};

const h3Style: CSSProperties = {
  margin: 0,
  fontSize: 14,
};

const infoStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  borderBottom: "1px solid #f1ece8",
  paddingBottom: 10,
};

const labelStyle: CSSProperties = {
  color: "var(--lf-text-soft)",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: "var(--lf-text-soft)",
  fontSize: 13,
};

const mutedBlockStyle: CSSProperties = {
  display: "block",
  color: "var(--lf-text-soft)",
  fontSize: 13,
  fontWeight: 500,
  marginTop: 3,
};

const permissionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
  gap: 12,
};

const permissionGroupStyle: CSSProperties = {
  border: "1px solid #f1ece8",
  borderRadius: 8,
  padding: 12,
  display: "grid",
  gap: 8,
};

const toggleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "var(--lf-text)",
  fontSize: 13,
};

const auditRowStyle: CSSProperties = {
  border: "1px solid #f1ece8",
  borderRadius: 8,
  padding: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const disabledButtonStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  color: "var(--lf-text-soft)",
  padding: "8px 10px",
  fontWeight: 800,
  cursor: "not-allowed",
};

const ctaStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "var(--lf-text)",
  color: "#fff",
  textDecoration: "none",
  padding: "9px 11px",
  fontSize: 13,
  fontWeight: 800,
};
