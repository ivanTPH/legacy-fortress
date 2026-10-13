"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { waitForActiveUser } from "../../lib/auth/session";
import { loadCanonicalContactsForOwner } from "../../lib/contacts/canonicalContacts";
import { buildScopedPermissionPayload, normalizeContactPermissionsOverride } from "../../lib/contacts/contactPermissions";
import InfoTip from "../ui/InfoTip";

type Contact = {
  id: string;
  full_name: string;
  relationship: string | null;
  contact_role: string | null;
  linked_user_id: string | null;
  verification_status: string;
};

type Grant = {
  id: string;
  invitation_id: string | null;
  contact_id: string | null;
  linked_user_id: string | null;
  permissions_override: Record<string, unknown> | null;
  activation_status: string | null;
};

const VIEWABLE_STATUSES = new Set(["accepted", "verified", "active", "pending_verification", "verification_submitted"]);

export default function AccessSharingWorkspace() {
  const searchParams = useSearchParams();
  const assetId = searchParams.get("asset") || "";
  const recordId = assetId || searchParams.get("record") || "";
  const [ownerId, setOwnerId] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [recordLabel, setRecordLabel] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
      if (!user) return;
      const [contactRows, grantResult, assetResult, entryResult] = await Promise.all([
        loadCanonicalContactsForOwner(supabase, user.id),
        supabase.from("account_access_grants").select("id,invitation_id,contact_id,linked_user_id,permissions_override,activation_status").eq("owner_user_id", user.id),
        recordId ? supabase.from("assets").select("id,title,provider_name").eq("owner_user_id", user.id).eq("id", recordId).maybeSingle() : Promise.resolve({ data: null }),
        recordId ? supabase.from("section_entries").select("id,title,summary").eq("user_id", user.id).eq("id", recordId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      const nextContacts = (contactRows ?? []) as Contact[];
      const nextGrants = (grantResult.data ?? []) as Grant[];
      setOwnerId(user.id);
      setContacts(nextContacts);
      setGrants(nextGrants);
      const row = (assetResult.data ?? entryResult.data) as { title?: unknown; provider_name?: unknown; summary?: unknown } | null;
      setRecordLabel(String(row?.title ?? row?.provider_name ?? row?.summary ?? "Selected record"));
      if (recordId) {
        setSelected(new Set(nextGrants.filter((grant) => {
          const permissions = normalizeContactPermissionsOverride(grant.permissions_override);
          return permissions.asset_ids.includes(recordId) || permissions.record_ids.includes(recordId);
        }).map((grant) => grant.id)));
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [recordId]);

  const grantByContact = useMemo(() => new Map(grants.map((grant) => [grant.contact_id || grant.linked_user_id || grant.id, grant])), [grants]);
  const eligibleContacts = contacts.filter((contact) => contact.linked_user_id && VIEWABLE_STATUSES.has(contact.verification_status) && contact.contact_role !== "executor");

  async function toggleRecordAccess(contact: Contact, grant: Grant) {
    if (!recordId || saving) return;
    const permissions = normalizeContactPermissionsOverride(grant.permissions_override);
    const sourceIsAsset = Boolean(assetId);
    const assetIds = permissions.asset_ids.filter((id) => id !== recordId);
    const recordIds = permissions.record_ids.filter((id) => id !== recordId);
    const isSelected = selected.has(grant.id);
    if (!isSelected) {
      if (sourceIsAsset) assetIds.push(recordId);
      else recordIds.push(recordId);
    }
    const payload = buildScopedPermissionPayload({
      allowedSections: permissions.allowed_sections,
      assetIds,
      recordIds,
      editableAssetIds: [],
      editableRecordIds: [],
      ownerNotes: permissions.owner_notes,
      assignedRole: contact.contact_role,
    });
    setSaving(grant.id);
    setStatus("");
    const result = await supabase.from("account_access_grants").update({ permissions_override: payload, updated_at: new Date().toISOString() }).eq("owner_user_id", ownerId).eq("id", grant.id);
    if (result.error) {
      setStatus("We could not update shared access. Please try again.");
    } else {
      if (grant.invitation_id) {
        await supabase.from("role_assignments").update({ permissions_override: payload, updated_at: new Date().toISOString() }).eq("owner_user_id", ownerId).eq("invitation_id", grant.invitation_id);
        await supabase.from("contact_invitations").update({ permissions_override: payload, updated_at: new Date().toISOString() }).eq("owner_user_id", ownerId).eq("id", grant.invitation_id);
        await supabase.from("invitation_events").insert({ owner_user_id: ownerId, invitation_id: grant.invitation_id, event_type: isSelected ? "access_revoked" : "access_updated", payload: { source: "access_sharing_record", scope_count: assetIds.length + recordIds.length } });
      }
      setSelected((current) => {
        const next = new Set(current);
        if (isSelected) next.delete(grant.id); else next.add(grant.id);
        return next;
      });
      setGrants((current) => current.map((item) => item.id === grant.id ? { ...item, permissions_override: payload } : item));
    }
    setSaving("");
  }

  if (loading) return <section className="lf-page-shell"><p role="status">Loading Access &amp; Sharing...</p></section>;

  return (
    <section className="lf-page-shell lf-access-sharing-page">
      <div className="lf-page-heading">
        <div>
          <h1>Access &amp; Sharing</h1>
          <p>{recordId ? `Choose who can view ${recordLabel || "this record"}.` : "See who can currently view information in your Fortress."}</p>
        </div>
        <Link href="/contacts" className="lf-secondary-btn">People I Trust</Link>
      </div>
      {recordId ? (
        <section className="lf-access-sharing-panel" aria-labelledby="record-sharing-heading">
          <h2 id="record-sharing-heading">People with access</h2>
          <p className="lf-muted-copy">View only <InfoTip label="Explain view-only access" message="People can view information you share but cannot change or delete your records." /></p>
          {eligibleContacts.length ? eligibleContacts.map((contact) => {
            const grant = grantByContact.get(contact.id) ?? (contact.linked_user_id ? grantByContact.get(contact.linked_user_id) : undefined);
            if (!grant) return null;
            return <label key={grant.id} className="lf-access-sharing-person"><input type="checkbox" checked={selected.has(grant.id)} disabled={saving === grant.id} onChange={() => void toggleRecordAccess(contact, grant)} /><span><strong>{contact.full_name}</strong><small>{contact.relationship || "Relationship not set"}{contact.contact_role && contact.contact_role !== contact.relationship ? ` · ${contact.contact_role}` : ""}</small></span></label>;
          }) : <p className="lf-muted-copy">No eligible linked people are available for living Vault sharing.</p>}
        </section>
      ) : (
        <section className="lf-access-sharing-list" aria-label="Current shared access">
          {contacts.filter((contact) => contact.linked_user_id).map((contact) => {
            const grant = grantByContact.get(contact.id) ?? (contact.linked_user_id ? grantByContact.get(contact.linked_user_id) : undefined);
            const permissions = normalizeContactPermissionsOverride(grant?.permissions_override);
            const count = permissions.asset_ids.length + permissions.record_ids.length;
            return <article key={contact.id} className="lf-access-sharing-card"><div><h2>{contact.full_name}</h2><p>{contact.relationship || "Relationship not set"}{contact.contact_role && contact.contact_role !== contact.relationship ? ` · ${contact.contact_role}` : ""}</p></div><strong>{contact.contact_role === "executor" ? "No living access" : count ? `${count} records shared · View only` : "No records shared"}</strong><Link href={`/contacts?contact=${encodeURIComponent(contact.id)}`} className="lf-secondary-btn">Edit</Link></article>;
          })}
          {!contacts.some((contact) => contact.linked_user_id) ? <p className="lf-muted-copy">No linked people are available yet.</p> : null}
        </section>
      )}
      {status ? <p role="status" className="lf-muted-copy">{status}</p> : null}
    </section>
  );
}
