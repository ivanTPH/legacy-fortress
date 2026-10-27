import type { SupabaseClient } from "@supabase/supabase-js";
import { listPeopleContactsForOwner, savePeopleContact } from "../contacts/contactRepository.ts";

export type LinkedRecordType = "asset" | "record";
export type LinkedPerson = {
  id: string;
  person_id: string;
  role: string;
  role_other_text: string | null;
  source: "manual" | "extraction";
  manual_origin: "new" | "people" | null;
  source_page: number | null;
  source_document_id: string | null;
  created_at: string;
};

export function linkedPeopleConfig(section: string, category: string) {
  if (section === "personal" && ["tasks", "beneficiaries", "executors"].includes(category)) return null;
  if (section === "legal" && category === "identity-documents") return null;
  if (section === "legal" && category === "wills") return { heading: "Executors", action: "Add another executor", roles: ["Executor", "Reserve executor", "Solicitor", "Other"] };
  if (section === "property") return { heading: "People linked to this property", action: "Add person", roles: ["Joint owner", "Solicitor", "Managing agent", "Other"] };
  if (section === "finances") {
    const roles = category === "bank" ? ["Joint account holder", "Adviser", "Bank contact", "Other"]
      : category === "insurance" ? ["Beneficiary", "Broker", "Adviser", "Other"]
      : ["Financial adviser", "Broker", "Joint holder", "Other"];
    return { heading: "People linked to this record", action: "Add person", roles };
  }
  if (section === "business") return { heading: "People linked to this business", action: "Add person", roles: ["Business partner", "Director", "Accountant", "Adviser", "Other"] };
  if (section === "digital") return { heading: "People linked to this record", action: "Add person", roles: ["Authorised contact", "Digital executor", "Other"] };
  if (section === "legal") return { heading: "People linked to this record", action: "Add person", roles: ["Solicitor", "Attorney", "Trustee", "Beneficiary", "Other"] };
  if (section === "possessions" || (section === "personal" && category === "possessions")) return { heading: "People linked to this possession", action: "Add person", roles: ["Beneficiary", "Joint owner", "Adviser", "Other"] };
  return { heading: "People linked to this record", action: "Add person", roles: ["Contact", "Adviser", "Other"] };
}

export async function loadRecordLinkedPeople(client: SupabaseClient, ownerUserId: string, recordType: LinkedRecordType, recordId: string) {
  const [linksResult, contacts] = await Promise.all([
    client.from("record_links")
      .select("id,person_id,role,role_other_text,source,manual_origin,source_page,source_document_id,created_at")
      .eq("owner_user_id", ownerUserId).eq("record_type", recordType).eq("record_id", recordId)
      .is("removed_at", null).order("created_at", { ascending: true }),
    listPeopleContactsForOwner(client, ownerUserId),
  ]);
  if (linksResult.error) throw new Error(linksResult.error.message);
  return { links: (linksResult.data ?? []) as LinkedPerson[], contacts };
}

export async function saveRecordLinkedPerson(client: SupabaseClient, input: {
  ownerUserId: string;
  recordType: LinkedRecordType;
  recordId: string;
  existingPersonId?: string;
  name?: string;
  email?: string;
  phone?: string;
  relationship?: string;
  role: string;
  roleOtherText?: string;
}) {
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== input.ownerUserId) throw new Error("Only the owner can link a person.");
  const role = input.role.trim();
  if (!role || role.length > 60) throw new Error("Choose a role for this record.");
  const roleOtherText = role === "Other" ? input.roleOtherText?.trim() : null;
  if (role === "Other" && (!roleOtherText || roleOtherText.length > 60)) throw new Error("Enter a role of up to 60 characters.");
  if (!input.recordId) throw new Error("Save the record before adding people.");

  let personId = input.existingPersonId;
  if (!personId) {
    if (!input.name?.trim()) throw new Error("Enter the person's name.");
    // Never pass a legacy contact_links link: that path can widen an existing grant.
    const contact = await savePeopleContact(client, {
      ownerUserId: input.ownerUserId,
      fullName: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      relationship: input.relationship?.trim() || null,
      sourceType: "manual",
    });
    personId = contact.id;
  }
  const result = await client.from("record_links").insert({
    owner_user_id: input.ownerUserId,
    record_type: input.recordType,
    record_id: input.recordId,
    person_id: personId,
    role,
    role_other_text: roleOtherText || null,
    source: "manual",
    manual_origin: input.existingPersonId ? "people" : "new",
    created_by: input.ownerUserId,
  }).select("id").single();
  if (result.error) {
    throw new Error(input.existingPersonId ? result.error.message : "Person saved in People, but the record link failed. Select that person and try again.");
  }
  return { linkId: result.data.id as string, personId };
}
