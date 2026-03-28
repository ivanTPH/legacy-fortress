import type { AccessActivationStatus } from "../../../../lib/access-control/roles";
import { resolveInvitationBadgeState, type InvitationStatus } from "../../../../lib/contacts/invitationStatus";

export default function InvitationStatusBadge({
  invitationStatus,
  activationStatus,
  sentAt,
}: {
  invitationStatus: InvitationStatus;
  activationStatus: AccessActivationStatus;
  sentAt?: string | null;
}) {
  const state = resolveInvitationBadgeState(invitationStatus, activationStatus, sentAt);
  const tone = getTone(state);
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
      {state.label}
    </span>
  );
}

function getTone(status: ReturnType<typeof resolveInvitationBadgeState>) {
  switch (status.tone) {
    case "success":
      return { border: "#a7f3d0", text: "#065f46", bg: "#ecfdf5" };
    case "danger":
      return { border: "#fecaca", text: "#991b1b", bg: "#fef2f2" };
    case "neutral":
      return { border: "#e5e7eb", text: "#374151", bg: "#f9fafb" };
    default:
      return { border: "#fde68a", text: "#92400e", bg: "#fffbeb" };
  }
}
