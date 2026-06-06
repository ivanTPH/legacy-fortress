import Link from "next/link";
import AdminPrototypeShell from "@/components/admin/prototype/AdminPrototypeShell";
import AdminStatusBadge from "@/components/admin/prototype/AdminStatusBadge";
import RoleAssignmentConsole from "@/components/admin/prototype/RoleAssignmentConsole";
import { getRoleManagementData } from "@/components/admin/prototype/roleManagementService";
import {
  PlatformChip,
  PlatformInfoTile,
  PlatformNotice,
  PlatformTableScroll,
  platformChipRowStyle,
  platformCtaStyle,
  platformInfoGridStyle,
} from "@/components/ui/PlatformPrimitives";
import {
  getAccountRoleLabel,
  getPlatformRoleLabel,
} from "@/lib/governance/rolePermissions";
import { buildPrototypePreviewHref } from "@/lib/testPersonas";
import type { CSSProperties, ReactNode } from "react";

type AdminUsersPageProps = {
  searchParams?: Promise<{ role?: string }>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const currentRole = params?.role ?? "super_admin";
  const data = getRoleManagementData();
  const enterpriseHref = buildPrototypePreviewHref("/internal/admin/prototype/enterprise", currentRole);

  return (
    <AdminPrototypeShell
      title="Users & Permissions"
      description="Registered individuals directory for user accounts, platform roles, account-level roles, sub-admin access, permission toggles, and audit-ready role workflows."
    >
      <PlatformNotice icon="shield" tone="default">
        This is the registered individuals directory. Platform roles and account-level roles are managed here; Super Admins can grant or revoke admin rights, while account owners can manage sub-users only within their own account.
      </PlatformNotice>

      <section style={returnNavStyle} aria-label="Users and permissions navigation">
        <Link href={enterpriseHref} style={platformCtaStyle}>Back to Enterprise Dashboard</Link>
        <Link href={buildPrototypePreviewHref("/internal/test-login", currentRole)} style={secondaryLinkStyle}>Switch workspace</Link>
      </section>

      <section style={platformInfoGridStyle}>
        <PlatformInfoTile label="Registered individuals" value={String(data.summary.total)} />
        <PlatformInfoTile label="Account owners" value={String(data.summary.accountOwners)} />
        <PlatformInfoTile label="Account sub-admins" value={String(data.summary.accountSubAdmins)} />
        <PlatformInfoTile label="Platform admins" value={String(data.summary.platformAdmins)} />
        <PlatformInfoTile label="Suspended / restricted" value={String(data.summary.suspendedOrRestricted)} tone="warning" />
      </section>

      <RoleAssignmentConsole people={data.registeredIndividuals} actor={data.currentActor} />

      <section style={toolbarStyle}>
        <input aria-label="Search registered individuals" placeholder="Search name, email, vault, role, or user ID" style={inputStyle} />
        <select aria-label="Role layer" style={selectStyle} defaultValue="all">
          <option value="all">All role layers</option>
          <option>Account-level roles</option>
          <option>Platform-level roles</option>
          <option>Sub-admins</option>
        </select>
        <select aria-label="Access status" style={selectStyle} defaultValue="all">
          <option value="all">All access states</option>
          <option>Active</option>
          <option>Pending</option>
          <option>Restricted</option>
          <option>Suspended</option>
        </select>
      </section>

      <section style={panelStyle}>
        <PlatformTableScroll label="Registered individuals and role management table">
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>Individual</Th>
                <Th>Owner</Th>
                <Th>Linked account / vault</Th>
                <Th>Platform role</Th>
                <Th>Account role</Th>
                <Th>Child / sub-users</Th>
                <Th>Verification</Th>
                <Th>Access</Th>
                <Th>Workflow</Th>
                <Th>Last permission update</Th>
                <Th>Last audit event</Th>
                <Th>Last activity</Th>
                <Th>Governance flags</Th>
              </tr>
            </thead>
            <tbody>
              {data.registeredIndividuals.map((item) => (
                <tr key={item.id}>
                  <Td>
                    <Link href={buildPrototypePreviewHref(`/internal/admin/prototype/users/${item.id}`, currentRole)} style={userLinkStyle}>
                      {item.full_name}
                      <span style={mutedBlockStyle}>{item.email}</span>
                      <span style={mutedBlockStyle}>{item.id}</span>
                    </Link>
                  </Td>
                  <Td>{item.accountOwnerStatus}</Td>
                  <Td>
                    {item.linkedAccountVault.label}
                    <span style={mutedBlockStyle}>{item.linkedAccountVault.id}</span>
                  </Td>
                  <Td>{getPlatformRoleLabel(item.platformRole)}</Td>
                  <Td>{getAccountRoleLabel(item.accountRole)}</Td>
                  <Td>{item.childSubUsers.length ? `${item.childSubUsers.length} linked` : "None"}</Td>
                  <Td><AdminStatusBadge status={badgeForVerification(item.verificationStatus)} /></Td>
                  <Td><AdminStatusBadge status={badgeForAccess(item.accessStatus)} /></Td>
                  <Td><AdminStatusBadge status={badgeForWorkflow(item.workflowStatus)} /></Td>
                  <Td>{item.lastPermissionUpdate}</Td>
                  <Td>{item.lastAuditEvent}</Td>
                  <Td>{item.lastActivity}</Td>
                  <Td>
                    <span style={platformChipRowStyle}>
                      {item.governance_flags.accountOwnerManaged ? <PlatformChip>Owner managed</PlatformChip> : null}
                      {item.governance_flags.platformRoleRestricted ? <PlatformChip tone="warning">Platform restricted</PlatformChip> : null}
                      {item.governance_flags.deleteDisabled ? <PlatformChip tone="warning">Soft-delete only</PlatformChip> : null}
                      {item.governance_flags.requiresVerification ? <PlatformChip tone="warning">Verification needed</PlatformChip> : null}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </PlatformTableScroll>
      </section>

      <section style={safetyPanelStyle}>
        <h2 style={h2Style}>Role safety rules</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {data.safetyRules.map((rule) => (
            <div key={rule} style={ruleRowStyle}>
              <AdminStatusBadge status="Restricted" />
              <span>{rule}</span>
            </div>
          ))}
        </div>
      </section>
    </AdminPrototypeShell>
  );
}

function badgeForVerification(status: "Verified" | "Pending" | "Restricted" | "Not verified") {
  if (status === "Verified") return "Success";
  if (status === "Restricted") return "Restricted";
  return "Pending";
}

function badgeForAccess(status: "Active" | "Pending" | "Suspended" | "Restricted") {
  if (status === "Suspended") return "Suspended";
  if (status === "Restricted") return "Restricted";
  return status;
}

function badgeForWorkflow(status: string) {
  if (status === "approved_applied") return "Success";
  if (status === "blocked" || status === "failed") return "Blocked";
  if (status === "reverted") return "Rejected";
  return "Pending";
}

function Th({ children }: { children: ReactNode }) {
  return <th style={thStyle}>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td style={tdStyle}>{children}</td>;
}

const toolbarStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 12,
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
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

const inputStyle: CSSProperties = {
  minWidth: 260,
  flex: 1,
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: "9px 11px",
};

const selectStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: "9px 11px",
  background: "#fff",
};

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  overflow: "hidden",
};

const safetyPanelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  padding: 16,
  display: "grid",
  gap: 12,
};

const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: 1420,
  borderCollapse: "collapse",
  fontSize: 14,
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "11px 12px",
  borderBottom: "1px solid var(--lf-border)",
  color: "var(--lf-text-soft)",
  fontSize: 12,
  textTransform: "uppercase",
};

const tdStyle: CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #f1ece8",
  verticalAlign: "top",
};

const userLinkStyle: CSSProperties = {
  color: "var(--lf-text)",
  fontWeight: 800,
  textDecoration: "none",
};

const mutedBlockStyle: CSSProperties = {
  display: "block",
  color: "var(--lf-text-soft)",
  fontSize: 12,
  fontWeight: 500,
  marginTop: 2,
};

const h2Style: CSSProperties = {
  margin: 0,
  fontSize: 17,
};

const ruleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  color: "var(--lf-text-soft)",
  fontSize: 13,
};
