import type { AccessActivationStatus } from "../../../../lib/access-control/roles";

export type InvitationStatus = "pending" | "accepted" | "rejected" | "revoked";

export default function InvitationStatusBadge({
  invitationStatus,
  activationStatus,
}: {
  invitationStatus: InvitationStatus;
  activationStatus: AccessActivationStatus;
}) {
  const tone = getTone(invitationStatus);
  return (
    <span
      style={{
        border: `1px solid ${tone.border}`,
        color: tone.text,
        background: tone.bg,
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
      }}
    >
      {formatInvitationStatus(invitationStatus)} · {formatActivationStatus(activationStatus)}
    </span>
  );
}

function formatInvitationStatus(status: InvitationStatus) {
  if (status === "pending") return "Pending invitation";
  if (status === "accepted") return "Invitation accepted";
  if (status === "rejected") return "Invitation rejected";
  return "Invitation revoked";
}

function formatActivationStatus(status: AccessActivationStatus) {
  if (status === "invited") return "Awaiting sign-in";
  if (status === "accepted") return "Awaiting verification";
  return status.replace(/_/g, " ");
}

function getTone(status: InvitationStatus) {
  switch (status) {
    case "accepted":
      return { border: "#a7f3d0", text: "#065f46", bg: "#ecfdf5" };
    case "rejected":
      return { border: "#fecaca", text: "#991b1b", bg: "#fef2f2" };
    case "revoked":
      return { border: "#e5e7eb", text: "#374151", bg: "#f9fafb" };
    default:
      return { border: "#fde68a", text: "#92400e", bg: "#fffbeb" };
  }
}
