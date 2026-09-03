import { NextResponse } from "next/server";
import { getRequestUser } from "../../../../lib/admin/access";
import { createSupabaseAdminClient, getSupabaseAdminConfigIssue } from "../../../../lib/supabaseAdmin";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const ACTIONABLE_STATUSES = ["pending", "sent"];

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user.user?.email) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const configIssue = getSupabaseAdminConfigIssue();
  if (configIssue) return NextResponse.json({ error: "Pending invitations unavailable." }, { status: 503 });

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Pending invitations unavailable." }, { status: 503 });
  const invitations = await findActionableInvitations(admin, user.user.email);
  if (invitations.error) {
    console.error("[pending-invitations] lookup failed", invitations.error.message);
    return NextResponse.json({ error: "Pending invitations unavailable." }, { status: 503 });
  }

  const ownerIds = [...new Set(invitations.rows.map((row) => row.owner_user_id))];
  const profiles = ownerIds.length
    ? await admin.from("user_profiles").select("user_id,display_name").in("user_id", ownerIds)
    : { data: [], error: null };
  const ownerNames = new Map((profiles.data ?? []).map((row) => [row.user_id, row.display_name]));

  return NextResponse.json({
    invitations: invitations.rows.map((row) => toSafeSummary(row, ownerNames.get(row.owner_user_id))),
  });
}

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user.user?.email) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const configIssue = getSupabaseAdminConfigIssue();
  if (configIssue) return NextResponse.json({ error: "Invitation unavailable." }, { status: 503 });

  const body = await request.json().catch(() => null) as { invitationId?: string } | null;
  if (!body?.invitationId || !/^[0-9a-f-]{36}$/i.test(body.invitationId)) {
    return NextResponse.json({ error: "Invitation unavailable." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Invitation unavailable." }, { status: 503 });
  const found = await findActionableInvitations(admin, user.user.email, body.invitationId);
  const invitation = found.rows[0];
  if (found.error || !invitation) return NextResponse.json({ error: "Invitation unavailable." }, { status: 404 });

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const now = new Date().toISOString();
  const update = await admin.from("contact_invitations").update({
    invite_token_hash: tokenHash,
    token_consumed_at: null,
    updated_at: now,
  }).eq("id", invitation.id).eq("contact_email", invitation.contact_email);
  if (update.error) return NextResponse.json({ error: "Invitation unavailable." }, { status: 503 });

  const event = await admin.from("invitation_events").insert({
    owner_user_id: invitation.owner_user_id,
    invitation_id: invitation.id,
    event_type: "acceptance_link_recovered",
    payload: { channel: "authenticated_pending_invitation_recovery" },
  });
  if (event.error) console.error("[pending-invitations] event write failed", event.error.message);

  return NextResponse.json({ acceptancePath: `/invite/accept?invitation=${encodeURIComponent(invitation.id)}&token=${rawToken}` });
}

type InvitationRow = {
  id: string;
  owner_user_id: string;
  contact_name: string;
  contact_email: string;
  assigned_role: string;
  invitation_status: string;
  invited_at: string | null;
  sent_at: string | null;
  expires_at: string | null;
};

async function findActionableInvitations(admin: SupabaseClient, email: string, invitationId?: string) {
  let query = admin.from("contact_invitations")
    .select("id,owner_user_id,contact_name,contact_email,assigned_role,invitation_status,invited_at,sent_at,expires_at")
    .eq("contact_email", email.trim().toLowerCase())
    .in("invitation_status", ACTIONABLE_STATUSES)
    .is("token_consumed_at", null)
    .is("accepted_user_id", null)
    .is("revoked_at", null);
  if (invitationId) query = query.eq("id", invitationId);
  const result = await query.order("invited_at", { ascending: false });
  const rows = ((result.data ?? []) as InvitationRow[]).filter((row) => {
    if (!row.sent_at && row.invitation_status !== "sent") return false;
    return !row.expires_at || new Date(row.expires_at).getTime() > Date.now();
  });
  return { rows, error: result.error };
}

function toSafeSummary(row: InvitationRow, ownerName?: string | null) {
  return {
    invitationId: row.id,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    assignedRole: row.assigned_role,
    ownerName: ownerName || "Legacy Fortress account holder",
    invitationStatus: row.invitation_status,
    sentAt: row.sent_at,
    expiresAt: row.expires_at,
  };
}
