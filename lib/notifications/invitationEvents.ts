/**
 * Wording for invitation events in the bell and the Notifications page.
 * "auth_request_accepted" means the sign-in service accepted our request to SEND the email; it is
 * not the person accepting. It was shown as "Invitation accepted" before 2 Nov 2026 (owner report).
 */
export type InvitationEventCopy = { title: string; detail: string; kind: "sent" | "accepted" | "failed" | "expired" | "verified" | "access" | "other" };

export function describeInvitationEvent(eventType: string, payload?: Record<string, unknown> | null, contactName?: string | null): InvitationEventCopy {
  const type = eventType.toLowerCase();
  const email = typeof payload?.contact_email === "string" && payload.contact_email ? payload.contact_email : "";
  // Owner request 2 Nov 2026: name the person ("Invite sent to Jacqui").
  const first = String(contactName ?? (typeof payload?.contact_name === "string" ? payload.contact_name : "")).trim().split(/\s+/)[0] || "";
  if (type === "auth_request_accepted" || type === "sent" || type === "invite_sent" || type === "resent") {
    return { kind: "sent", title: first ? `Invite sent to ${first}` : "Invite sent", detail: email ? `Sent to ${email}. We’ll tell you when ${first || "they"} join${first ? "s" : ""}.` : `We’ll tell you when ${first || "they"} join${first ? "s" : ""}.` };
  }
  if (type === "person_told") {
    return { kind: "sent", title: first ? `Invite sent to ${first}` : "Invite sent", detail: `${first || "They"} had already joined, so we let ${first ? "them" : "them"} know you added them to a record. No details were shared.` };
  }
  if (type === "accepted") return { kind: "accepted", title: first ? `${first} accepted your invite` : "Invitation accepted", detail: `${first || "Someone you invited"} has joined Legacy Fortress.` };
  if (type === "failed" || type === "not_delivered" || type.includes("bounce")) return { kind: "failed", title: "Invitation not delivered", detail: email ? `We couldn’t deliver the invitation to ${email}. Check the address in People.` : "Check their email address in People." };
  if (type === "expired") return { kind: "expired", title: "Invitation expired", detail: "Send a new invitation from their page in People." };
  if (type.includes("verified")) return { kind: "verified", title: "Identity verified", detail: "Someone you invited completed their ID check." };
  if (type.includes("access")) return { kind: "access", title: "Access updated", detail: "What someone can see was changed." };
  return { kind: "other", title: "People activity", detail: "Something changed for one of your people." };
}
