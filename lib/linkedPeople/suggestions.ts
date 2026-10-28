import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeLinkedPersonEmail, normalizeLinkedPersonPhone } from "./recordLinkedPeople.ts";

export type LinkedPersonSuggestion = {
  id: string;
  document_id: string;
  record_id: string;
  page: number;
  extracted_name: string;
  extracted_role: string | null;
  match_person_id: string | null;
  match_kind: "exact" | "possible" | "none";
  document_title: string;
};

export async function loadLinkedPersonSuggestions(client: SupabaseClient, ownerUserId: string, recordId: string): Promise<LinkedPersonSuggestion[]> {
  const result = await client.from("extraction_suggestions")
    .select("id,document_id,record_id,page,extracted_name,extracted_role,match_person_id,match_kind")
    .eq("owner_user_id", ownerUserId).eq("record_id", recordId).eq("status", "pending")
    .order("created_at", { ascending: true });
  if (result.error) throw new Error("Document suggestions are unavailable.");
  const rows = result.data ?? [];
  if (!rows.length) return [];
  const documents = await client.from("documents").select("id,file_name,display_title")
    .eq("owner_user_id", ownerUserId).eq("asset_id", recordId).is("deleted_at", null)
    .in("id", rows.map((row) => row.document_id));
  if (documents.error) throw new Error("Source documents are unavailable.");
  const titles = new Map((documents.data ?? []).map((row) => [row.id, row.display_title || row.file_name]));
  return rows.filter((row) => titles.has(row.document_id)).map((row) => ({
    ...row,
    document_title: titles.get(row.document_id) || "Document",
  })) as LinkedPersonSuggestion[];
}

export async function reviewLinkedPersonSuggestion(client: SupabaseClient, input: {
  ownerUserId: string;
  suggestionId: string;
  decision: "confirm" | "dismiss";
  choice?: "existing" | "new";
  personId?: string;
  name?: string;
  role?: string;
  roleOtherText?: string;
  email?: string;
  phone?: string;
}) {
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== input.ownerUserId) throw new Error("Only the owner can review this suggestion.");
  if (input.decision === "confirm" && !input.choice) throw new Error("Choose an existing or new person.");
  const result = await client.rpc("lf_review_linked_person_suggestion", {
    p_suggestion_id: input.suggestionId,
    p_decision: input.decision,
    p_choice: input.choice ?? null,
    p_person_id: input.choice === "existing" ? input.personId || null : null,
    p_name: input.choice === "new" ? input.name?.trim() || null : null,
    p_role: input.role?.trim() || null,
    p_role_other_text: input.roleOtherText?.trim() || null,
    p_email: input.choice === "new" ? normalizeLinkedPersonEmail(input.email ?? "") || null : null,
    p_phone: input.choice === "new" ? normalizeLinkedPersonPhone(input.phone ?? "") || null : null,
  });
  if (result.error || !Array.isArray(result.data) || result.data.length !== 1) {
    throw new Error(result.error?.message || "Could not confirm this suggestion. Reopen the record to check its status.");
  }
  return result.data[0] as { person_id: string | null; link_id: string | null; decision_status: string };
}
