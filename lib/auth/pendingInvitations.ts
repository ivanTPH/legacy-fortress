import type { SupabaseClient } from "@supabase/supabase-js";

export type PendingInvitationSummary = {
  invitationId: string;
  contactName: string;
  contactEmail: string;
  assignedRole: string;
  ownerName: string;
  invitationStatus: string;
  sentAt: string | null;
  expiresAt: string | null;
};

export async function findPendingInvitationDestination(
  client: SupabaseClient,
  nextPath?: string | null,
) {
  // A validated invitation next path remains authoritative. Discovery is only
  // needed when authentication was completed without a return path.
  if (nextPath && nextPath.startsWith("/")) return null;

  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return null;

  const response = await fetch("/api/auth/pending-invitations", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = await response.json() as { invitations?: PendingInvitationSummary[] };
  const invitations = payload.invitations ?? [];
  if (invitations.length === 0) return null;
  if (invitations.length > 1) return "/pending-invitations";

  const linkResponse = await fetch("/api/auth/pending-invitations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ invitationId: invitations[0].invitationId }),
  });
  if (!linkResponse.ok) return null;
  const linkPayload = await linkResponse.json() as { acceptancePath?: string };
  return linkPayload.acceptancePath ?? null;
}

export async function createPendingInvitationLink(client: SupabaseClient, invitationId: string) {
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sign in is required to open this invitation.");
  const response = await fetch("/api/auth/pending-invitations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ invitationId }),
  });
  if (!response.ok) throw new Error("This invitation is no longer available.");
  const payload = await response.json() as { acceptancePath?: string };
  if (!payload.acceptancePath) throw new Error("This invitation could not be opened.");
  return payload.acceptancePath;
}

export async function loadPendingInvitations(client: SupabaseClient) {
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return [] as PendingInvitationSummary[];
  const response = await fetch("/api/auth/pending-invitations", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Pending invitations could not be loaded.");
  const payload = await response.json() as { invitations?: PendingInvitationSummary[] };
  return payload.invitations ?? [];
}
