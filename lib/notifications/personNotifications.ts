import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Content-free Vault access notifications (rules 5 and 8). Copy says who and what happened,
 * never record names, values, counts or scope.
 */
export type PersonNotification = { id: string; kind: string; ownerName: string | null; link: string; createdAt: string; readAt: string | null };

export async function loadPersonNotifications(client: SupabaseClient, limit = 50): Promise<PersonNotification[]> {
  const { data, error } = await client.from("user_notifications").select("id,kind,owner_display_name,link,created_at,read_at").order("created_at", { ascending: false }).limit(limit);
  if (error) return [];
  return (data ?? []).map((row) => ({ id: row.id, kind: row.kind, ownerName: row.owner_display_name ?? null, link: row.link || "/notifications", createdAt: row.created_at, readAt: row.read_at ?? null }));
}

export async function markPersonNotificationsRead(client: SupabaseClient, ids: string[]) {
  if (!ids.length) return;
  await client.from("user_notifications").update({ read_at: new Date().toISOString() }).in("id", ids).is("read_at", null);
}

export function describePersonNotification(kind: string, ownerName: string | null): { title: string; detail: string; icon: string; group: "people" | "security" | "records" } {
  const who = ownerName || "Someone";
  const first = who.split(/\s+/)[0] || who;
  switch (kind) {
    case "nomination_added": return { title: `${who} nominated you`, detail: `${first} has arranged for you to see part of their Vault later. You can’t see anything in it now.`, icon: "bookmark_added", group: "people" };
    case "nomination_ended": return { title: "Nomination ended", detail: `${first} has changed their arrangements. You’re no longer nominated for their Vault.`, icon: "block", group: "people" };
    case "release_approved": return { title: `${who}’s Vault has been released to you`, detail: "The release was approved. You can view what was chosen for you.", icon: "lock_open", group: "people" };
    case "access_given": return { title: `${who} shared records with you`, detail: `Choose ${first}’s Vault in the Vault switcher to see them.`, icon: "visibility", group: "records" };
    case "access_stopped": return { title: "Access stopped", detail: `You can no longer see ${first}’s records.`, icon: "block", group: "records" };
    case "authority_in_effect": return ownerName
      ? { title: "Your Power of Attorney is in effect", detail: `You can now see the areas ${first} chose, view only.`, icon: "gavel", group: "people" }
      : { title: "A Power of Attorney is in effect", detail: "Our team checked the authority and the attorney’s ID. You can withdraw it at any time.", icon: "gavel", group: "people" };
    case "authority_ended": return { title: "Power of Attorney ended", detail: `You can no longer act for ${first} in Legacy Fortress.`, icon: "block", group: "people" };
    case "authority_confirmed": return { title: "Authority confirmed", detail: "Our team checked the document. It isn’t in effect until it’s activated.", icon: "check_circle", group: "people" };
    case "authority_needs_attention": return { title: "Your authority needs attention", detail: "Our team asked you to fix something. Open Vault access to see what.", icon: "error", group: "people" };
    case "authority_rejected": return { title: "Authority not accepted", detail: "Our team couldn’t accept the authority. Open Vault access for details.", icon: "block", group: "people" };
    case "early_access_requested": return { title: "Someone asked for access now", detail: "A person you nominated asked to see something now. Nothing changes unless you share.", icon: "contact_support", group: "people" };
    case "early_access_answered": return { title: "Your request was answered", detail: `${first} has answered your request.`, icon: "mark_email_read", group: "people" };
    case "more_evidence_requested": return { title: "We need a little more evidence", detail: `Our team needs something else before going further with ${first}’s Vault. Open the report to add it.`, icon: "upload_file", group: "people" };
    case "attorney_check_requested": return { title: "Confirm it’s you", detail: `To act under ${first}’s Power of Attorney, take a fresh photo of your ID and a live selfie.`, icon: "badge", group: "security" };
    case "identity_approved": return { title: "Your ID is verified", detail: "Our team checked your photos. Your check lasts a year.", icon: "verified_user", group: "security" };
    case "identity_rejected": return { title: "We couldn’t verify your ID", detail: "Our team couldn’t approve your photos. You can try again.", icon: "gpp_bad", group: "security" };
    default: return { title: "Vault access updated", detail: "Something changed in your Vault access.", icon: "notifications", group: "people" };
  }
}
