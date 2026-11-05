import type { SupabaseClient } from "@supabase/supabase-js";
import type { VaultFacts, VaultFactRow } from "./nextSteps.ts";

/**
 * Loads what the next-steps rule needs about one person's Vault (4 Nov 2026). Used by the app (through
 * /api/next-steps, for the owner only) and by the summary email, so both read the same facts.
 * A table that isn't available yet simply contributes nothing.
 */
export async function loadVaultFacts(client: SupabaseClient, ownerUserId: string): Promise<VaultFacts> {
  const rows = <T>(result: { data: unknown; error: unknown }) => (result.error ? [] : ((result.data ?? []) as T[]));
  const [assets, records, documents, contacts, invitations, links, suggestions, nominations] = await Promise.all([
    client.from("assets").select("id,section_key,category_key,title,status,archived_at,deleted_at,metadata_json,created_at,updated_at").eq("owner_user_id", ownerUserId).is("deleted_at", null).limit(2000),
    client.from("records").select("id,section_key,category_key,title,status,archived_at,metadata,created_at,updated_at").eq("owner_user_id", ownerUserId).limit(2000),
    client.from("documents").select("id,asset_id,file_name,display_title,document_type").eq("owner_user_id", ownerUserId).is("deleted_at", null).limit(2000),
    client.from("contacts").select("id,full_name,contact_role,relationship,linked_user_id").eq("owner_user_id", ownerUserId).limit(1000),
    client.from("contact_invitations").select("contact_id,invitation_status,sent_at,invited_at").eq("owner_user_id", ownerUserId).limit(1000),
    client.from("record_links").select("record_id,person_id,role,removed_at").eq("owner_user_id", ownerUserId).is("removed_at", null).limit(2000),
    client.from("extraction_suggestions").select("record_id,extracted_name,extracted_role,status,match_person_id").eq("owner_user_id", ownerUserId).eq("status", "pending").limit(500),
    client.from("vault_nominations").select("person_id,status").eq("owner_user_id", ownerUserId).limit(500),
  ]);

  type AssetRow = { id: string; section_key: string | null; category_key: string | null; title: string | null; status: string | null; archived_at: string | null; deleted_at: string | null; metadata_json: Record<string, unknown> | null; created_at: string | null; updated_at: string | null };
  type RecordRow = Omit<AssetRow, "deleted_at" | "metadata_json"> & { metadata: Record<string, unknown> | null };
  const assetRows = rows<AssetRow>(assets);
  const vaultRows: VaultFactRow[] = [
    ...assetRows.map((row) => ({ ...row, kind: "asset" as const, status: row.status === "archived" ? "archived" as const : "active" as const })),
    ...rows<RecordRow>(records).map((row) => ({ ...row, kind: "record" as const, deleted_at: null, metadata_json: row.metadata, status: row.status === "archived" ? "archived" as const : "active" as const })),
  ];
  const willAssetIds = new Set(assetRows.filter((row) => /will/i.test(`${row.category_key ?? ""} ${row.title ?? ""}`)).map((row) => row.id));
  const willDocumentCount = rows<{ asset_id: string | null; file_name: string | null; display_title: string | null; document_type: string | null }>(documents)
    .filter((doc) => !(doc.asset_id && willAssetIds.has(doc.asset_id)) && /\bwills?\b|testament/i.test(`${doc.document_type ?? ""} ${doc.display_title ?? ""} ${doc.file_name ?? ""}`)).length;

  return {
    rows: vaultRows,
    willDocumentCount,
    contacts: rows<{ id: string; full_name: string | null; contact_role: string | null; relationship: string | null; linked_user_id: string | null }>(contacts)
      .map((row) => ({ id: row.id, name: String(row.full_name ?? "Someone"), role: [row.contact_role, row.relationship].filter(Boolean).join(" ") || null, linkedUserId: row.linked_user_id })),
    invitations: rows<{ contact_id: string | null; invitation_status: string; sent_at: string | null; invited_at: string | null }>(invitations)
      .map((row) => ({ contactId: row.contact_id, status: row.invitation_status, sentAt: row.sent_at ?? row.invited_at })),
    links: rows<{ record_id: string; person_id: string; role: string }>(links).map((row) => ({ recordId: row.record_id, personId: row.person_id, role: row.role })),
    suggestions: rows<{ record_id: string; extracted_name: string; extracted_role: string | null; status: string; match_person_id: string | null }>(suggestions)
      .map((row) => ({ recordId: row.record_id, name: row.extracted_name, role: row.extracted_role, status: row.status, matchPersonId: row.match_person_id })),
    nominations: rows<{ person_id: string; status: string }>(nominations).map((row) => ({ personId: row.person_id, status: row.status })),
  };
}
