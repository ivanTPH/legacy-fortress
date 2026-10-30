import { resolveRoleRule, type CollaboratorRole } from "../../../../lib/access-control/roles";

export default function RoleBadge({ role }: { role: CollaboratorRole }) {
  const label = resolveRoleRule(role).label;
  return (
    <span
      style={{
        border: "1px solid var(--lf-border-input)",
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
        color: "var(--lf-text)",
        background: "var(--lf-surface-page)",
      }}
    >
      {label}
    </span>
  );
}
