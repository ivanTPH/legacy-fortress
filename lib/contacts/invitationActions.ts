import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessActivationStatus, CollaboratorRole } from "../access-control/roles";
import { sendContactInvite } from "./sendContactInvite";

/**
 * Resend, change the email of, or cancel a waiting invitation (owner decision 16 Nov 2026: do these in the Inbox).
 * Shared by the Inbox and the People screen, so the rules, history and emails are the same wherever it's done.
 * None of these share anything: an invitation never grants access (only an explicit record choice does).
 */
export type WaitingInvitation = {
  contactId: string;
  invitationId: string;
  name: string;
  email: string;
  relationship: string | null;
  role: CollaboratorRole;
  activation: AccessActivationStatus;
  lastSentAt: string | null;
  expiresAt: string | null;
};

const ROLES: CollaboratorRole[] = ["executor", "professional_advisor", "accountant", "financial_advisor", "lawyer", "friend_or_family"];
const ACTIVATIONS: AccessActivationStatus[] = ["invited", "accepted", "pending_verification", "verification_submitted", "verified", "active", "rejected", "revoked"];
export function toCollaboratorRole(value: string | null | undefined): CollaboratorRole {
  return ROLES.includes(value as CollaboratorRole) ? value as CollaboratorRole : "friend_or_family";
}
export function toAccessActivationStatus(value: string | null | undefined): AccessActivationStatus {
  return ACTIVATIONS.includes(value as AccessActivationStatus) ? value as AccessActivationStatus : "invited";
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isPlausibleEmail(value: string) {
  return EMAIL.test(value.trim());
}

/** The owner's latest open invitation for one person in People, or null if there isn't one. */
export async function loadWaitingInvitation(client: SupabaseClient, ownerUserId: string, contactId: string): Promise<WaitingInvitation | null> {
  const [contact, invitation] = await Promise.all([
    client.from("contacts").select("id,full_name,email,relationship,contact_role,verification_status")
      .eq("owner_user_id", ownerUserId).eq("id", contactId).maybeSingle(),
    client.from("contact_invitations").select("id,contact_email,invitation_status,last_sent_at,sent_at,expires_at")
      .eq("owner_user_id", ownerUserId).eq("contact_id", contactId).in("invitation_status", ["pending", "sent"])
      .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const person = contact.data as Record<string, string | null> | null;
  const invite = invitation.data as Record<string, string | null> | null;
  if (!person || !invite?.id) return null;
  return {
    contactId,
    invitationId: String(invite.id),
    name: String(person.full_name ?? "").trim() || "This person",
    email: String(person.email ?? invite.contact_email ?? "").trim(),
    relationship: person.relationship ?? null,
    role: toCollaboratorRole(person.contact_role),
    activation: toAccessActivationStatus(person.verification_status),
    lastSentAt: invite.last_sent_at ?? invite.sent_at ?? null,
    expiresAt: invite.expires_at ?? null,
  };
}

/**
 * Sends the invitation again, to a new address if one is given. A new link is made each time, so an older email's
 * link stops working; the person's email in People is updated to match.
 */
export async function resendWaitingInvitation(client: SupabaseClient, input: {
  ownerUserId: string;
  ownerEmail?: string | null;
  invitation: WaitingInvitation;
  newEmail?: string | null;
  origin?: string | null;
}) {
  const email = String(input.newEmail ?? input.invitation.email).trim().toLowerCase();
  if (!isPlausibleEmail(email)) throw new Error("Enter a full email address, like name@example.com.");
  await sendContactInvite(client, {
    ownerUserId: input.ownerUserId,
    ownerEmail: input.ownerEmail ?? null,
    contactId: input.invitation.contactId,
    contactName: input.invitation.name,
    contactEmail: email,
    contactRelationship: input.invitation.relationship,
    assignedRole: input.invitation.role,
    invitationId: input.invitation.invitationId,
    invitedAt: new Date().toISOString(),
    activationStatus: input.invitation.activation,
    resend: true,
    origin: input.origin ?? null,
  });
  return email;
}

/** Cancels the invitation: its link stops working. The person stays in People; nothing they could see changes. */
export async function cancelWaitingInvitation(client: SupabaseClient, input: { ownerUserId: string; contactId: string; invitationId: string; source: string }) {
  const now = new Date().toISOString();
  const result = await client
    .from("contact_invitations")
    .update({ invitation_status: "revoked", revoked_at: now, updated_at: now })
    .eq("owner_user_id", input.ownerUserId)
    .eq("id", input.invitationId);
  if (result.error) throw new Error(result.error.message);
  await client.from("contacts").update({ invite_status: "revoked", verification_status: "revoked", updated_at: now })
    .eq("owner_user_id", input.ownerUserId).eq("id", input.contactId);
  await client.from("invitation_events").insert({ owner_user_id: input.ownerUserId, invitation_id: input.invitationId, event_type: "revoked", payload: { source: input.source } });
}
