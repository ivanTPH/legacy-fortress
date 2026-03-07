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
      {invitationStatus} · {activationStatus.replace(/_/g, " ")}
    </span>
  );
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
