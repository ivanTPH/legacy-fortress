/**
 * Wording for invitation events in the bell and the Notifications page.
 * "auth_request_accepted" means the sign-in service accepted our request to SEND the email; it is
 * not the person accepting. It was shown as "Invitation accepted" before 2 Nov 2026 (owner report).
 */
export type InvitationEventCopy = { title: string; detail: string; kind: "sent" | "accepted" | "failed" | "expired" | "verified" | "access" | "other" };

export function describeInvitationEvent(eventType: string, payload?: Record<string, unknown> | null): InvitationEventCopy {
  const type = eventType.toLowerCase();
  const email = typeof payload?.contact_email === "string" && payload.contact_email ? payload.contact_email : "";
  if (type === "auth_request_accepted" || type === "sent" || type === "invite_sent" || type === "resent") {
    return { kind: "sent", title: "Invitation sent", detail: email ? `Sent to ${email}. We’ll tell you when they join.` : "We’ll tell you when they join." };
  }
  if (type === "accepted") return { kind: "accepted", title: "Invitation accepted", detail: "Someone you invited has joined Legacy Fortress." };
  if (type === "failed" || type === "not_delivered" || type.includes("bounce")) return { kind: "failed", title: "Invitation not delivered", detail: email ? `We couldn’t deliver the invitation to ${email}. Check the address in People.` : "Check their email address in People." };
  if (type === "expired") return { kind: "expired", title: "Invitation expired", detail: "Send a new invitation from their page in People." };
  if (type.includes("verified")) return { kind: "verified", title: "Identity verified", detail: "Someone you invited completed their ID check." };
  if (type.includes("access")) return { kind: "access", title: "Access updated", detail: "What someone can see was changed." };
  return { kind: "other", title: "People activity", detail: "Something changed for one of your people." };
}
