"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import AdminStatusBadge from "./AdminStatusBadge";
import {
  ACCOUNT_ROLE_LABELS,
  PLATFORM_ROLE_LABELS,
  evaluatePermissionChange,
  getPermissionLabel,
  getRoleTemplatePermissions,
  type AccountRole,
  type PermissionKey,
  type PlatformAdminRole,
} from "../../../lib/governance/rolePermissions";
import type { RegisteredIndividual } from "./roleManagementService";

type EditableRegistration = {
  id: string;
  selected: boolean;
  accountRole: AccountRole | null;
  platformRole: PlatformAdminRole | null;
  permissions: PermissionKey[];
};

const permissionGroups: Array<{ title: string; permissions: PermissionKey[] }> = [
  {
    title: "Owner-controlled vault delegation",
    permissions: ["view_account", "edit_account_details", "add_contacts", "delete_contacts", "assign_account_roles"],
  },
  {
    title: "Probate unlock after death-certificate validation",
    permissions: ["upload_documents", "download_documents", "approve_executor_access"],
  },
  {
    title: "Enterprise, licensor, and reporting administration",
    permissions: ["run_reports", "export_data", "edit_billing_licensing", "manage_organisations"],
  },
  {
    title: "Platform administration",
    permissions: ["view_audit_logs", "manage_platform_admins", "suspend_users", "delete_users"],
  },
];

export default function RoleAssignmentConsole({
  people,
  actor,
}: {
  people: RegisteredIndividual[];
  actor: RegisteredIndividual;
}) {
  const actorPermissions = useMemo(
    () => [...actor.accountPermissions, ...actor.platformPermissions],
    [actor.accountPermissions, actor.platformPermissions],
  );
  const [drafts, setDrafts] = useState<Record<string, EditableRegistration>>(() => {
    const initial: Record<string, EditableRegistration> = {};
    for (const person of people) {
      initial[person.id] = {
        id: person.id,
        selected: false,
        accountRole: person.accountRole,
        platformRole: person.platformRole,
        permissions: [...new Set([...person.accountPermissions, ...person.platformPermissions])],
      };
    }
    return initial;
  });
  const [activeId, setActiveId] = useState(people[0]?.id ?? "");
  const [saveStatus, setSaveStatus] = useState("No permission changes queued.");
  const activePerson = people.find((person) => person.id === activeId) ?? people[0];
  const activeDraft = activePerson ? drafts[activePerson.id] : null;
  const selectedDrafts = Object.values(drafts).filter((draft) => draft.selected);
  const platformDecision = activeDraft
    ? evaluatePermissionChange({
        actorAccountRole: actor.accountRole,
        actorPlatformRole: actor.platformRole,
        actorPermissions,
        targetLayer: activeDraft.platformRole ? "platform" : "account",
        requestedPermissions: activeDraft.permissions,
        requestedPlatformRole: activeDraft.platformRole,
      })
    : null;

  function updateDraft(id: string, patch: Partial<EditableRegistration>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }

  function applyTemplate(id: string, role: AccountRole | PlatformAdminRole | null, layer: "account" | "platform") {
    const template = getRoleTemplatePermissions(role);
    if (layer === "account") {
      updateDraft(id, {
        accountRole: role as AccountRole | null,
        permissions: [...new Set([...drafts[id].permissions, ...template])],
      });
      return;
    }

    updateDraft(id, {
      platformRole: role as PlatformAdminRole | null,
      permissions: [...new Set([...drafts[id].permissions, ...template])],
    });
  }

  function togglePermission(id: string, permission: PermissionKey) {
    const draft = drafts[id];
    updateDraft(id, {
      permissions: draft.permissions.includes(permission)
        ? draft.permissions.filter((item) => item !== permission)
        : [...draft.permissions, permission],
    });
  }

  function queueSelectedChanges() {
    const total = selectedDrafts.length || (activeDraft ? 1 : 0);
    setSaveStatus(`${total} registration${total === 1 ? "" : "s"} queued for owner approval and audit review.`);
  }

  return (
    <section className="lf-role-console" style={consoleStyle} aria-label="Role assignment and permission management console">
      <div className="lf-role-console-header" style={consoleHeaderStyle}>
        <div>
          <span style={eyebrowStyle}>Admin workflow</span>
          <h2 style={h2Style}>Registered account access console</h2>
          <p style={mutedStyle}>
            Select a registered person, inspect their account-vault delegation, and assign application or enterprise administrator rights only where the governance layer allows it.
          </p>
        </div>
        <div style={summaryPillsStyle}>
          <span style={summaryPillStyle}>{people.filter((person) => person.accountOwnerStatus === "Owner").length} account holders</span>
          <span style={summaryPillStyle}>{selectedDrafts.length} selected</span>
          <span style={summaryPillStyle}>Audit preview only</span>
        </div>
      </div>

      <section style={boundaryNoticeStyle}>
        <strong>Permission boundary</strong>
        <span>
          Personal vault roles are normally invited and assigned by the vault owner. Platform and enterprise admins manage application, licensor, reporting, audit, and death-certificate access workflows; they do not directly edit a person&apos;s vault content.
        </span>
      </section>

      <div className="lf-role-console-grid" style={consoleGridStyle}>
        <section className="lf-role-console-list" style={registrationListStyle} aria-label="Registered account holders and users">
          <div style={panelHeaderStyle}>
            <strong>Registered people</strong>
            <span>{people.length} records</span>
          </div>
          <div style={peopleListStyle}>
            {people.map((person) => {
              const draft = drafts[person.id];
              return (
                <div
                  className="lf-role-console-person-row"
                  key={person.id}
                  style={personRowStyle(activePerson?.id === person.id)}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveId(person.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActiveId(person.id);
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draft.selected}
                    onChange={(event) => {
                      event.stopPropagation();
                      updateDraft(person.id, { selected: event.target.checked });
                    }}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${person.full_name}`}
                  />
                  <span style={{ minWidth: 0 }}>
                    <strong>{person.full_name}</strong>
                    <small>{person.email}</small>
                    <small>{person.accountOwnerStatus} · {person.linkedAccountVault.label}</small>
                  </span>
                  <span style={rowActionsStyle}>
                    <AdminStatusBadge status={person.accessStatus === "Active" ? "Success" : person.accessStatus} />
                    <Link
                      href={`/internal/admin/prototype/users/${person.id}?role=super_admin&admin=true&prototype=true`}
                      style={openPersonStyle}
                      onClick={(event) => event.stopPropagation()}
                    >
                      Open
                    </Link>
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {activePerson && activeDraft ? (
          <section className="lf-role-console-editor" style={editorPanelStyle} aria-label="Role and permissions editor">
            <div style={panelHeaderStyle}>
              <span>
                <strong>{activePerson.full_name}</strong>
                <small>{activePerson.id} · {activePerson.linkedAccountVault.id}</small>
              </span>
              <AdminStatusBadge status={platformDecision?.allowed ? "Success" : "Restricted"} />
            </div>

            <div className="lf-role-console-role-grid" style={roleGridStyle}>
              <label style={fieldStyle}>
                <span>Account role</span>
                <select
                  value={activeDraft.accountRole ?? ""}
                  onChange={(event) => applyTemplate(activePerson.id, event.target.value ? event.target.value as AccountRole : null, "account")}
                  style={selectStyle}
                >
                  <option value="">No account role</option>
                  {Object.entries(ACCOUNT_ROLE_LABELS).map(([role, label]) => (
                    <option key={role} value={role}>{label}</option>
                  ))}
                </select>
              </label>
              <label style={fieldStyle}>
                <span>Administrator role</span>
                <select
                  value={activeDraft.platformRole ?? ""}
                  onChange={(event) => applyTemplate(activePerson.id, event.target.value ? event.target.value as PlatformAdminRole : null, "platform")}
                  style={selectStyle}
                >
                  <option value="">No platform admin role</option>
                  {Object.entries(PLATFORM_ROLE_LABELS).map(([role, label]) => (
                    <option key={role} value={role}>{label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="lf-role-console-permissions" style={permissionMatrixStyle}>
              {permissionGroups.map((group) => (
                <section key={group.title} style={permissionGroupStyle}>
                  <h3 style={h3Style}>{group.title}</h3>
                  {group.permissions.map((permission) => (
                    <label key={permission} style={toggleRowStyle}>
                      <input
                        type="checkbox"
                        checked={activeDraft.permissions.includes(permission)}
                        onChange={() => togglePermission(activePerson.id, permission)}
                      />
                      <span>{getPermissionLabel(permission)}</span>
                    </label>
                  ))}
                </section>
              ))}
            </div>

            <section style={decisionStyle(platformDecision?.allowed ?? false)}>
              <strong>{platformDecision?.allowed ? "Ready for approval workflow" : "Restricted by governance"}</strong>
              <span>{platformDecision?.reason ?? "Select a registered person to preview permission governance."}</span>
            </section>

            <div style={actionBarStyle}>
              <button type="button" style={primaryButtonStyle} onClick={queueSelectedChanges}>
                Apply selected mock changes
              </button>
              <span style={saveStatusStyle}>{saveStatus}</span>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

const consoleStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "#fff",
  padding: 16,
  display: "grid",
  gap: 14,
};

const consoleHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "start",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  color: "var(--lf-text-soft)",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
};

const h2Style: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 19,
};

const h3Style: CSSProperties = {
  margin: 0,
  fontSize: 13,
};

const mutedStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "var(--lf-text-soft)",
  fontSize: 13,
  lineHeight: 1.45,
};

const summaryPillsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "flex-end",
};

const summaryPillStyle: CSSProperties = {
  border: "1px solid #e7ddd4",
  borderRadius: 999,
  background: "#fbf7f2",
  color: "#6b5a4c",
  padding: "6px 9px",
  fontSize: 12,
  fontWeight: 850,
};

const boundaryNoticeStyle: CSSProperties = {
  border: "1px solid #e7ddd4",
  borderRadius: 8,
  background: "#fffefd",
  color: "var(--lf-text)",
  padding: "10px 12px",
  display: "grid",
  gap: 4,
  fontSize: 13,
  lineHeight: 1.45,
};

const consoleGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 0.8fr) minmax(0, 1.4fr)",
  gap: 14,
  alignItems: "start",
};

const registrationListStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  padding: 10,
  display: "grid",
  gap: 10,
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: 10,
  color: "var(--lf-text)",
};

const peopleListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  maxHeight: 440,
  overflow: "auto",
};

const rowActionsStyle: CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: 6,
};

const openPersonStyle: CSSProperties = {
  color: "var(--lf-bronze)",
  fontSize: 12,
  fontWeight: 850,
  textDecoration: "none",
};

function personRowStyle(active: boolean): CSSProperties {
  return {
    border: active ? "1px solid var(--lf-bronze-strong)" : "1px solid var(--lf-border)",
    borderRadius: 8,
    background: active ? "#fbf7f2" : "#fff",
    color: "var(--lf-text)",
    padding: 10,
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    gap: 9,
    textAlign: "left",
    alignItems: "start",
    cursor: "pointer",
  };
}

const editorPanelStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "#fff",
  padding: 12,
  display: "grid",
  gap: 12,
};

const roleGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  color: "var(--lf-text-soft)",
  fontSize: 12,
  fontWeight: 850,
};

const selectStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "#fff",
  color: "var(--lf-text)",
  padding: "9px 10px",
};

const permissionMatrixStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 10,
};

const permissionGroupStyle: CSSProperties = {
  border: "1px solid var(--lf-border)",
  borderRadius: 8,
  background: "var(--lf-surface-muted)",
  padding: 10,
  display: "grid",
  gap: 8,
};

const toggleRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  alignItems: "center",
  gap: 8,
  color: "var(--lf-text)",
  fontSize: 13,
};

const actionBarStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 10,
};

const primaryButtonStyle: CSSProperties = {
  border: "1px solid var(--lf-bronze-strong)",
  borderRadius: 8,
  background: "var(--lf-bronze-strong)",
  color: "#fff",
  padding: "9px 12px",
  fontWeight: 850,
  cursor: "pointer",
};

const saveStatusStyle: CSSProperties = {
  color: "var(--lf-text-soft)",
  fontSize: 13,
};

function decisionStyle(allowed: boolean): CSSProperties {
  return {
    border: allowed ? "1px solid #bbf7d0" : "1px solid #fed7aa",
    borderRadius: 8,
    background: allowed ? "#f0fdf4" : "#fff7ed",
    color: "var(--lf-text)",
    padding: 11,
    display: "grid",
    gap: 4,
    fontSize: 13,
  };
}
