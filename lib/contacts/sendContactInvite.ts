import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessActivationStatus, CollaboratorRole } from "../access-control/roles";
import { assertOwnerCanSendInvitation, ensureOwnerPlanProfile } from "../accountPlan";
import {
  buildCanonicalInvitationProjectionPayload,
} from "./canonicalContacts";
import { ACTIVE_CONTACT_INVITATION_STATUSES, getSafeContactInvitationErrorMessage } from "./invitationLifecycle.ts";
import {
  mapActivationStatusToVerificationStatus,
  savePeopleContact,
  savePeopleInvitationProjection,
} from "./contactRepository";
import { buildInvitationEmailDraft } from "./invitations";

type AnySupabaseClient = SupabaseClient;

export type SendContactInviteInput = {
  ownerUserId: string;
  ownerEmail?: string | null;
  contactId?: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  contactRelationship?: string | null;
  assignedRole: CollaboratorRole;
  invitationId?: string | null;
  invitedAt?: string | null;
  activationStatus?: AccessActivationStatus;
  permissionsOverride?: Record<string, unknown> | null;
  resend?: boolean;
  origin?: string | null;
};

export type SendContactInviteResult = {
  invitationId: string;
  eventWarning?: string | null;
};

export async function sendContactInvite(
  client: AnySupabaseClient,
  input: SendContactInviteInput,
): Promise<SendContactInviteResult> {
  const contactEmail = input.contactEmail.trim().toLowerCase();
  if (!contactEmail) {
    throw new Error("Contact email is required before an invite can be sent.");
  }

  if (!input.resend) {
    const ownerPlan = await ensureOwnerPlanProfile(client, input.ownerUserId);
    const inviteCountRes = await client
      .from("contact_invitations")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", input.ownerUserId)
      .neq("invitation_status", "revoked");
    if (inviteCountRes.error) {
      throw new Error(inviteCountRes.error.message);
    }
    assertOwnerCanSendInvitation(ownerPlan, Number(inviteCountRes.count ?? 0));
  }

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const invitationId = await resolveContactInvitationId(client, input, now);
  const token = crypto.randomUUID().replace(/-/g, "");
  const tokenHash = await sha256(token);
  const { data: ownerProfile } = await client
    .from("user_profiles")
    .select("display_name")
    .eq("user_id", input.ownerUserId)
    .maybeSingle();
  const accountHolderName =
    String(ownerProfile?.display_name ?? "").trim()
    || input.ownerEmail?.split("@")[0]
    || "the account holder";
  const emailDraft = buildInvitationEmailDraft({
    invitationId,
    token,
    assignedRole: input.assignedRole,
    accountHolderName,
  });

  const deliveryResult = await client.auth.signInWithOtp({
    email: contactEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: input.origin
        ? `${input.origin}/auth/callback?next=${encodeURIComponent(emailDraft.acceptPath)}`
        : undefined,
      data: {
        invitation_id: invitationId,
        invitation_role: input.assignedRole,
        account_holder_name: accountHolderName,
        linked_access: "view_only",
      },
    },
  });
  if (deliveryResult.error) {
    await markInvitationDeliveryFailed(client, input, invitationId, contactEmail, deliveryResult.error.message);
    throw new Error(getSafeContactInvitationErrorMessage(deliveryResult.error));
  }

  const activationStatus = input.activationStatus ?? "invited";
  const updateRes = await client
    .from("contact_invitations")
    .update({
      ...buildCanonicalInvitationProjectionPayload({
        ownerUserId: input.ownerUserId,
        contact: {
          id: input.contactId ?? "",
          full_name: input.contactName || contactEmail,
          email: contactEmail,
          relationship: input.contactRelationship ?? null,
          contact_role: input.assignedRole,
        },
        assignedRole: input.assignedRole,
        invitationStatus: "pending",
        invitedAt: input.invitedAt || now,
        sentAt: now,
        updatedAt: now,
        permissionsOverride: input.permissionsOverride ?? null,
        activationStatus,
      }).invitation,
      invite_token_hash: tokenHash,
      expires_at: expiresAt,
      token_consumed_at: null,
      last_sent_at: now,
    })
    .eq("id", invitationId)
    .eq("owner_user_id", input.ownerUserId);
  if (updateRes.error) {
    throw new Error(updateRes.error.message);
  }

  if (input.contactId) {
    await savePeopleContact(client, {
      ownerUserId: input.ownerUserId,
      existingContactId: input.contactId,
      fullName: input.contactName || contactEmail,
      email: contactEmail,
      phone: input.contactPhone ?? null,
      relationship: input.contactRelationship ?? null,
      contactRole: input.assignedRole,
      sourceType: "invitation",
      inviteStatus: "invite_sent",
      verificationStatus: mapActivationStatusToVerificationStatus(activationStatus),
      link: {
        sourceKind: "invitation",
        sourceId: invitationId,
        sectionKey: "dashboard",
        categoryKey: "contacts",
        label: "Contact invitation",
        role: input.assignedRole,
      },
    });
  }

  const eventRes = await client.from("invitation_events").insert({
    owner_user_id: input.ownerUserId,
    invitation_id: invitationId,
    event_type: input.resend ? "resent" : "sent",
    payload: {
      contact_email: contactEmail,
      subject: emailDraft.subject,
      preview: emailDraft.preview,
      channel: "supabase_auth_otp",
      accept_route: "/invite/accept",
      email_redirect_configured: Boolean(input.origin),
    },
  });

  return {
    invitationId,
    eventWarning: eventRes.error?.message ?? null,
  };
}

async function markInvitationDeliveryFailed(
  client: AnySupabaseClient,
  input: SendContactInviteInput,
  invitationId: string,
  contactEmail: string,
  reason: string,
) {
  const now = new Date().toISOString();
  const updateRes = await client
    .from("contact_invitations")
    .update({
      invitation_status: "failed",
      updated_at: now,
    })
    .eq("id", invitationId)
    .eq("owner_user_id", input.ownerUserId);
  if (updateRes.error) {
    throw new Error(`${reason}; additionally, failed invitation status could not be saved: ${updateRes.error.message}`);
  }

  if (input.contactId) {
    await savePeopleContact(client, {
      ownerUserId: input.ownerUserId,
      existingContactId: input.contactId,
      fullName: input.contactName || contactEmail,
      email: contactEmail,
      phone: input.contactPhone ?? null,
      relationship: input.contactRelationship ?? null,
      contactRole: input.assignedRole,
      sourceType: "invitation",
      inviteStatus: "failed",
      verificationStatus: "not_verified",
      link: {
        sourceKind: "invitation",
        sourceId: invitationId,
        sectionKey: "dashboard",
        categoryKey: "contacts",
        label: "Contact invitation",
        role: input.assignedRole,
      },
    }).then(() => undefined, () => undefined);
  }

  await client.from("invitation_events").insert({
    owner_user_id: input.ownerUserId,
    invitation_id: invitationId,
    event_type: "failed",
    payload: {
      contact_email: contactEmail,
      reason,
    },
  }).then(() => undefined, () => undefined);
}

async function resolveContactInvitationId(
  client: AnySupabaseClient,
  input: SendContactInviteInput,
  now: string,
) {
  const existingInvitationId = String(input.invitationId ?? "").trim();
  if (existingInvitationId) return existingInvitationId;

  const contactId = String(input.contactId ?? "").trim();
  if (contactId) {
    const existingRes = await client
      .from("contact_invitations")
      .select("id")
      .eq("owner_user_id", input.ownerUserId)
      .eq("contact_id", contactId)
      .neq("invitation_status", "revoked")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingRes.error) {
      throw new Error(existingRes.error.message);
    }
    const existingId = String((existingRes.data as Record<string, unknown> | null)?.id ?? "").trim();
    if (existingId) return existingId;
  }

  const contactEmail = input.contactEmail.trim().toLowerCase();
  if (contactEmail) {
    const existingEmailRes = await client
      .from("contact_invitations")
      .select("id")
      .eq("owner_user_id", input.ownerUserId)
      .eq("contact_email", contactEmail)
      .in("invitation_status", [...ACTIVE_CONTACT_INVITATION_STATUSES])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingEmailRes.error) {
      throw new Error(existingEmailRes.error.message);
    }
    const existingEmailId = String((existingEmailRes.data as Record<string, unknown> | null)?.id ?? "").trim();
    if (existingEmailId) return existingEmailId;
  }

  const insertRes = await savePeopleInvitationProjection(client, {
    ownerUserId: input.ownerUserId,
    contact: {
      id: contactId,
      full_name: input.contactName || input.contactEmail,
      email: input.contactEmail,
      relationship: input.contactRelationship ?? null,
      contact_role: input.assignedRole,
    },
    assignedRole: input.assignedRole,
    invitationStatus: "pending",
    invitedAt: input.invitedAt || now,
    sentAt: null,
    updatedAt: now,
    permissionsOverride: input.permissionsOverride ?? null,
    activationStatus: input.activationStatus ?? "invited",
  });

  return insertRes.id;
}

async function sha256(input: string) {
  const bytes = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
