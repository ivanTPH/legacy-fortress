import type { SupabaseClient } from "@supabase/supabase-js";
import type { PeopleContactEntity } from "../contacts/contactRepository.ts";
import { listPeopleContactsForOwner, loadPeopleContactsByIds, savePeopleContact } from "../contacts/contactRepository.ts";
import type { SendContactInviteResult } from "../contacts/sendContactInvite.ts";
import type { CollaboratorRole } from "../access-control/roles.ts";
import { normalizePhone } from "../validation/profile.ts";

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
export type LinkedRecordAccessState = "explicit" | "none" | "unavailable";
export function searchLinkedPeopleContacts(contacts: PeopleContactEntity[], activeIds: Set<string>, search: string) {
  const query = search.trim().toLocaleLowerCase();
  return contacts.filter((contact) => !activeIds.has(contact.id) &&
    `${contact.full_name} ${contact.email ?? ""} ${contact.phone ?? ""}`.toLocaleLowerCase().includes(query));
}
export type LinkedPersonHistoryEvent = {
  id: string;
  link_id: string;
  person_id: string;
  action: "link.created" | "link.role_changed" | "link.removed";
  created_at: string;
};

export class LinkedPersonRecoveryError extends Error {
  readonly personId: string;
  constructor(message: string, personId: string) { super(message); this.personId = personId; }
}

export function normalizeLinkedPersonEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error("Enter a valid email address.");
  }
  return email;
}

export function normalizeLinkedPersonPhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (!/^\+?[\d\s().-]+$/.test(trimmed) || digits.length < 7 || digits.length > 15) {
    throw new Error("Enter a valid telephone number.");
  }
  return normalizePhone(trimmed);
}

async function assertOwnerMayManage(client: SupabaseClient, ownerUserId: string) {
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== ownerUserId) throw new Error("Only the owner can manage linked people.");
  const vault = await client.rpc("lf_vault_allows_owner_mutation", { p_owner_user_id: ownerUserId });
  if (vault.error || vault.data !== true) throw new Error("This Vault is locked or unavailable for changes.");
  return auth.data.user;
}

async function assertSavedOwnerRecord(client: SupabaseClient, ownerUserId: string, recordType: LinkedRecordType, recordId: string) {
  if (!recordId) throw new Error("Save the record before adding people.");
  let query = client.from(recordType === "asset" ? "assets" : "records")
    .select("id").eq("owner_user_id", ownerUserId).eq("id", recordId);
  if (recordType === "asset") query = query.is("deleted_at", null);
  const result = await query.maybeSingle();
  if (result.error || !result.data) throw new Error("This saved record is unavailable to the owner.");
}

export function linkedPeopleConfig(section: string, category: string) {
  if (section === "personal" && ["tasks", "beneficiaries", "executors"].includes(category)) return null;
  if (section === "legal" && category === "identity-documents") return null;
  if (section === "legal" && category === "wills") return { heading: "Executors", action: "Add another executor", roles: ["Executor", "Reserve executor", "Solicitor", "Other"] };
  if (section === "property") return { heading: "People linked to this property", action: "Add person", roles: ["Joint owner", "Solicitor", "Managing agent", "Other"] };
  if (section === "finances") {
    const roles = category === "bank" ? ["Joint account holder", "Adviser", "Bank contact", "Other"]
      : category === "insurance" ? ["Beneficiary", "Broker", "Adviser", "Other"]
      : ["Financial adviser", "Broker", "Joint holder", "Other"];
    const heading = category === "bank" ? "People linked to this account"
      : category === "insurance" ? "People linked to this policy"
      : "People linked to this investment";
    return { heading, action: "Add person", roles };
  }
  if (section === "business") return { heading: "People linked to this company", action: "Add person", roles: ["Business partner", "Director", "Accountant", "Adviser", "Other"] };
  if (section === "digital") return { heading: "People linked to this account", action: "Add person", roles: ["Authorised contact", "Digital executor", "Other"] };
  if (section === "legal") return { heading: "People linked to this document", action: "Add person", roles: ["Solicitor", "Attorney", "Trustee", "Beneficiary", "Other"] };
  if (section === "possessions" || (section === "personal" && category === "possessions")) return { heading: "People linked to this item", action: "Add person", roles: ["Beneficiary", "Joint owner", "Adviser", "Other"] };
  return { heading: "People linked to this record", action: "Add person", roles: ["Contact", "Adviser", "Other"] };
}

export async function loadRecordLinkedPeople(client: SupabaseClient, ownerUserId: string, recordType: LinkedRecordType, recordId: string) {
  const [linksResult, contacts, grantsResult] = await Promise.all([
    client.from("record_links")
      .select("id,person_id,role,role_other_text,source,manual_origin,source_page,source_document_id,created_at")
      .eq("owner_user_id", ownerUserId).eq("record_type", recordType).eq("record_id", recordId)
      .is("removed_at", null).order("created_at", { ascending: true }),
    listPeopleContactsForOwner(client, ownerUserId),
    client.from("account_access_grants")
      .select("contact_id,linked_user_id,activation_status,permissions_override,vault_lifecycle_state")
      .eq("owner_user_id", ownerUserId),
  ]);
  if (linksResult.error) throw new Error(linksResult.error.message);
  const links = (linksResult.data ?? []) as LinkedPerson[];
  const sourceDocumentIds = [...new Set(links.map((link) => link.source_document_id).filter((id): id is string => Boolean(id)))];
  const documentTitles: Record<string, string> = {};
  if (sourceDocumentIds.length) {
    const documents = await client.from("documents").select("id,file_name,display_title")
      .eq("owner_user_id", ownerUserId).eq("asset_id", recordId).is("deleted_at", null)
      .in("id", sourceDocumentIds);
    if (!documents.error) for (const document of documents.data ?? []) documentTitles[document.id] = document.display_title || document.file_name;
  }
  const accessByPerson: Record<string, LinkedRecordAccessState> = {};
  for (const link of links) accessByPerson[link.person_id] = grantsResult.error ? "unavailable" : "none";
  if (!grantsResult.error) {
    for (const grant of grantsResult.data ?? []) {
      const personId = String(grant.contact_id ?? "");
      if (!(personId in accessByPerson) || !grant.linked_user_id || !["verified", "active"].includes(String(grant.activation_status ?? ""))) continue;
      if (grant.vault_lifecycle_state !== "OWNER_ACTIVE") continue;
      const scope = grant.permissions_override as Record<string, unknown> | null;
      const ids = scope?.[recordType === "asset" ? "asset_ids" : "record_ids"];
      if (Array.isArray(ids) && ids.includes(recordId)) accessByPerson[personId] = "explicit";
    }
  }
  return { links, contacts, accessByPerson, documentTitles };
}

export async function saveRecordLinkedPerson(client: SupabaseClient, input: {
  ownerUserId: string;
  recordType: LinkedRecordType;
  recordId: string;
  existingPersonId?: string;
  recoveryPersonId?: string;
  name?: string;
  email?: string;
  phone?: string;
  relationship?: string;
  role: string;
  roleOtherText?: string;
}) {
  await assertOwnerMayManage(client, input.ownerUserId);
  await assertSavedOwnerRecord(client, input.ownerUserId, input.recordType, input.recordId);
  const role = input.role.trim();
  if (!role || role.length > 60) throw new Error("Choose a role for this record.");
  const roleOtherText = role === "Other" ? input.roleOtherText?.trim() : null;
  if (role === "Other" && (!roleOtherText || roleOtherText.length > 60)) throw new Error("Enter a role of up to 60 characters.");
  const creatingContact = !input.existingPersonId && !input.recoveryPersonId;
  const email = creatingContact ? normalizeLinkedPersonEmail(input.email ?? "") : "";
  const phone = creatingContact ? normalizeLinkedPersonPhone(input.phone ?? "") : "";
  let personId = input.recoveryPersonId || input.existingPersonId;
  if (!personId) {
    const name = input.name?.trim() ?? "";
    if (!name || name.length > 120) throw new Error("Enter a name of up to 120 characters.");
    // Never pass a legacy contact_links link: that path can widen an existing grant.
    const contact = await savePeopleContact(client, {
      ownerUserId: input.ownerUserId,
      createOnly: true,
      fullName: name,
      email: email || null,
      phone: phone || null,
      relationship: input.relationship?.trim() || null,
      sourceType: "manual",
    });
    personId = contact.id;
  }
  try {
    if (input.existingPersonId || input.recoveryPersonId) {
      const [person] = await loadPeopleContactsByIds(client, input.ownerUserId, [personId]);
      if (!person) throw new Error("Choose a person from your own People list.");
    }
    const existing = await client.from("record_links").select("id")
      .eq("owner_user_id", input.ownerUserId).eq("record_type", input.recordType)
      .eq("record_id", input.recordId).eq("person_id", personId).is("removed_at", null).maybeSingle();
    if (existing.error) throw new Error("Could not check the existing record links.");
    if (existing.data?.id) return { linkId: existing.data.id as string, personId };
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
      if (result.error.code === "23505") {
        const concurrent = await client.from("record_links").select("id")
          .eq("owner_user_id", input.ownerUserId).eq("record_type", input.recordType)
          .eq("record_id", input.recordId).eq("person_id", personId).is("removed_at", null).maybeSingle();
        if (concurrent.data?.id) return { linkId: concurrent.data.id as string, personId };
      }
      throw new Error(result.error.message);
    }
    return { linkId: result.data.id as string, personId };
  } catch (cause) {
    if (!input.existingPersonId) throw new LinkedPersonRecoveryError("Person is saved in People, but the record link could not be confirmed. Retry this relationship; the person will not be created again.", personId);
    throw cause;
  }
}

export async function changeRecordLinkedPersonRole(client: SupabaseClient, input: {
  ownerUserId: string;
  recordType: LinkedRecordType;
  recordId: string;
  linkId: string;
  role: string;
  roleOtherText?: string;
}) {
  await assertOwnerMayManage(client, input.ownerUserId);
  await assertSavedOwnerRecord(client, input.ownerUserId, input.recordType, input.recordId);
  const role = input.role.trim();
  if (!role || role.length > 60) throw new Error("Choose a role for this record.");
  const roleOtherText = role === "Other" ? input.roleOtherText?.trim() : null;
  if (role === "Other" && (!roleOtherText || roleOtherText.length > 60)) throw new Error("Enter a role of up to 60 characters.");
  const result = await client.from("record_links")
    .update({ role, role_other_text: roleOtherText || null })
    .eq("id", input.linkId).eq("owner_user_id", input.ownerUserId)
    .eq("record_type", input.recordType).eq("record_id", input.recordId)
    .is("removed_at", null).select("id").maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("This active relationship is unavailable. Refresh the record.");
}

export async function unlinkRecordLinkedPerson(client: SupabaseClient, input: {
  ownerUserId: string;
  recordType: LinkedRecordType;
  recordId: string;
  linkId: string;
}) {
  await assertOwnerMayManage(client, input.ownerUserId);
  await assertSavedOwnerRecord(client, input.ownerUserId, input.recordType, input.recordId);
  const result = await client.from("record_links")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", input.linkId).eq("owner_user_id", input.ownerUserId)
    .eq("record_type", input.recordType).eq("record_id", input.recordId)
    .is("removed_at", null).select("id").maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("This active relationship is unavailable. Refresh the record.");
}

export async function loadRecordLinkedPeopleHistory(client: SupabaseClient, input: {
  ownerUserId: string;
  recordType: LinkedRecordType;
  recordId: string;
}): Promise<LinkedPersonHistoryEvent[]> {
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== input.ownerUserId) throw new Error("Only the owner can view relationship history.");
  await assertSavedOwnerRecord(client, input.ownerUserId, input.recordType, input.recordId);
  const result = await client.rpc("lf_record_link_history", {
    p_record_type: input.recordType,
    p_record_id: input.recordId,
  });
  if (result.error) throw new Error("Record-link history is unavailable.");
  return (result.data ?? []) as LinkedPersonHistoryEvent[];
}

function collaboratorRole(value: string | null): CollaboratorRole {
  const roles: CollaboratorRole[] = ["executor", "professional_advisor", "accountant", "financial_advisor", "lawyer", "friend_or_family"];
  return roles.includes(value as CollaboratorRole) ? value as CollaboratorRole : "friend_or_family";
}

export async function sendRecordLinkedPersonInvitation(client: SupabaseClient, input: {
  ownerUserId: string;
  recordType: LinkedRecordType;
  recordId: string;
  personId: string;
  origin: string;
}, dispatch: typeof import("../contacts/sendContactInvite.ts").sendContactInvite = async (client, invitation) => {
  const { sendContactInvite } = await import("../contacts/sendContactInvite.ts");
  return sendContactInvite(client, invitation);
}): Promise<SendContactInviteResult> {
  const owner = await assertOwnerMayManage(client, input.ownerUserId);
  const link = await client.from("record_links").select("id")
    .eq("owner_user_id", input.ownerUserId).eq("record_type", input.recordType)
    .eq("record_id", input.recordId).eq("person_id", input.personId).is("removed_at", null).maybeSingle();
  if (link.error || !link.data) throw new Error("This person is not linked to this record.");
  const [contact] = await loadPeopleContactsByIds(client, input.ownerUserId, [input.personId]);
  if (!contact) throw new Error("This person is unavailable.");
  const email = normalizeLinkedPersonEmail(contact.email ?? "");
  if (!email) throw new Error("Add an email to this person before sending an invitation.");
  if (["invite_sent", "accepted"].includes(contact.invite_status)) {
    throw new Error("This person already has an active invitation. Manage it in People.");
  }
  return dispatch(client, {
    ownerUserId: input.ownerUserId,
    ownerEmail: owner.email,
    contactId: contact.id,
    contactName: contact.full_name,
    contactEmail: email,
    contactPhone: contact.phone,
    contactRelationship: contact.relationship,
    assignedRole: collaboratorRole(contact.contact_role),
    activationStatus: "invited",
    skipLegacyContactLink: true,
    permissionsOverride: { asset_ids: [], record_ids: [], editable_asset_ids: [], editable_record_ids: [], allowed_sections: [], explicit_permissions: [] },
    origin: input.origin,
  });
}
