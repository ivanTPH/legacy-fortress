import type { CSSProperties } from "react";
import Icon from "../../ui/Icon";
import type { AdminCaseStatus } from "./mockData";

type AdminStatusBadgeProps = {
  status:
    | AdminCaseStatus
    | "Success"
    | "Pending"
    | "Rejected"
    | "High"
    | "Urgent"
    | "Normal"
    | "Review"
    | "Suspended"
    | "Restricted"
    | "Static mock data"
    | "Consent allowed"
    | "Consent required"
    | "Review due"
    | "Disabled";
};

export default function AdminStatusBadge({ status }: AdminStatusBadgeProps) {
  return (
    <span style={badgeStyle(status)} aria-label={`Status: ${status}`}>
      <Icon name={statusIcon(status)} size={14} />
      {status}
    </span>
  );
}

function badgeStyle(status: AdminStatusBadgeProps["status"]): CSSProperties {
  const tone =
    status === "Under Review" || status === "Pending" || status === "Access Unlock Pending" || status === "High" || status === "Review" || status === "Review due"
      ? { background: "#fff7ed", color: "var(--lf-bronze)", border: "#e1d5cd" }
      : status === "Deceased" || status === "Rejected" || status === "Urgent" || status === "Suspended" || status === "Restricted" || status === "Consent required"
        ? { background: "#fef2f2", color: "#991b1b", border: "#fecaca" }
        : status === "Active" || status === "Success" || status === "Consent allowed"
          ? { background: "#f0fdf4", color: "#166534", border: "#bbf7d0" }
          : status === "Static mock data" || status === "Disabled"
            ? { background: "var(--lf-surface-muted)", color: "var(--lf-text-soft)", border: "#e2e8f0" }
            : { background: "var(--lf-surface-muted)", color: "var(--lf-text-soft)", border: "#e2e8f0" };

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    width: "fit-content",
    border: `1px solid ${tone.border}`,
    borderRadius: 999,
    background: tone.background,
    color: tone.color,
    padding: "4px 9px",
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
}

function statusIcon(status: AdminStatusBadgeProps["status"]) {
  if (status === "Active" || status === "Success" || status === "Consent allowed") return "check_circle";
  if (status === "Rejected" || status === "Restricted" || status === "Consent required" || status === "Suspended") return "block";
  if (status === "Urgent" || status === "High" || status === "Review due") return "priority_high";
  if (status === "Pending" || status === "Under Review" || status === "Review" || status === "Access Unlock Pending") return "pending";
  if (status === "Static mock data") return "science";
  if (status === "Disabled") return "lock";
  return "radio_button_checked";
}
