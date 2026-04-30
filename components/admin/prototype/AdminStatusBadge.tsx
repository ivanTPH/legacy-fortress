import type { CSSProperties } from "react";
import type { AdminCaseStatus } from "./mockData";

type AdminStatusBadgeProps = {
  status: AdminCaseStatus | "Success" | "Pending" | "Rejected" | "High" | "Urgent" | "Normal";
};

export default function AdminStatusBadge({ status }: AdminStatusBadgeProps) {
  return <span style={badgeStyle(status)}>{status}</span>;
}

function badgeStyle(status: AdminStatusBadgeProps["status"]): CSSProperties {
  const tone =
    status === "Under Review" || status === "Pending" || status === "Access Unlock Pending" || status === "High"
      ? { background: "#fff7ed", color: "#9a3412", border: "#fed7aa" }
      : status === "Deceased" || status === "Rejected" || status === "Urgent"
        ? { background: "#fef2f2", color: "#991b1b", border: "#fecaca" }
        : status === "Active" || status === "Success"
          ? { background: "#f0fdf4", color: "#166534", border: "#bbf7d0" }
          : { background: "#f8fafc", color: "#475569", border: "#e2e8f0" };

  return {
    display: "inline-flex",
    alignItems: "center",
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
