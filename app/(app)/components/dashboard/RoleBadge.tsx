import { resolveRoleRule, type CollaboratorRole } from "../../../../lib/access-control/roles";

export default function RoleBadge({ role }: { role: CollaboratorRole }) {
  const label = resolveRoleRule(role).label;
  return (
    <span
      style={{
        border: "1px solid #d1d5db",
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
        color: "#374151",
        background: "#f9fafb",
      }}
    >
      {label}
    </span>
  );
}
