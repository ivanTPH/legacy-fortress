import type { SupabaseClient } from "@supabase/supabase-js";

type AnySupabaseClient = SupabaseClient;

export type CanonicalContactInviteStatus =
  | "not_invited"
  | "invite_sent"
  | "accepted"
  | "rejected"
  | "revoked";

export type CanonicalContactVerificationStatus =
  | "not_verified"
  | "invited"
  | "accepted"
  | "pending_verification"
  | "verification_submitted"
  | "verified"
  | "active"
  | "rejected"
  | "revoked";

export type CanonicalContactSourceType =
  | "next_of_kin"
  | "executor_asset"
  | "trusted_contact"
  | "invitation"
  | "record_contact"
  | "manual";

export type CanonicalContactContext = {
  source_kind: "record" | "asset" | "invitation";
  source_id: string;
  section_key?: string | null;
  category_key?: string | null;
  label?: string | null;
  role?: string | null;
};

export type CanonicalContactRow = {
  id: string;
  owner_user_id: string;
  full_name: string;
  email: string | null;
  email_normalized: string | null;
  phone: string | null;
  contact_role: string | null;
  relationship: string | null;
  linked_context: CanonicalContactContext[];
  invite_status: CanonicalContactInviteStatus;
  verification_status: CanonicalContactVerificationStatus;
  source_type: CanonicalContactSourceType;
  validation_overrides: Record<string, { manually_confirmed?: boolean; updated_at?: string }>;
  created_at: string;
  updated_at: string;
};

export type CanonicalContactLinkRow = {
  id: string;
  owner_user_id: string;
  contact_id: string;
  source_kind: "record" | "asset" | "invitation";
  source_id: string;
  section_key: string | null;
  category_key: string | null;
  context_label: string | null;
  role_label: string | null;
  created_at: string;
  updated_at: string;
};

export type CanonicalContactInvitationRow = {
  id: string;
  contact_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  assigned_role: string | null;
  invitation_status: string | null;
  invited_at: string;
  sent_at: string | null;
  updated_at: string;
};

export type CanonicalContactActivationRow = {
  invitation_id: string;
  assigned_role: string | null;
  activation_status: string | null;
  updated_at: string;
};

type ContactSyncLink = {
  sourceKind: "record" | "asset" | "invitation";
  sourceId: string;
  sectionKey?: string | null;
  categoryKey?: string | null;
  label?: string | null;
  role?: string | null;
};

export type SyncCanonicalContactInput = {
  ownerUserId: string;
  existingContactId?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  contactRole?: string | null;
  relationship?: string | null;
  inviteStatus?: CanonicalContactInviteStatus | null;
  verificationStatus?: CanonicalContactVerificationStatus | null;
  sourceType: CanonicalContactSourceType;
  link?: ContactSyncLink | null;
};

type ContactLinkRow = {
  contact_id: string;
};

export async function syncCanonicalContact(
  client: AnySupabaseClient,
  input: SyncCanonicalContactInput,
): Promise<CanonicalContactRow> {
  const prepared = prepareCanonicalContactPayload(input);
  if (!prepared.full_name) {
    throw new Error("Full name is required.");
  }

  const linkedContext = input.link ? buildLinkedContext(input.link) : null;
  const existingLookup = await findExistingCanonicalContact(client, prepared.owner_user_id, {
    existingContactId: input.existingContactId ?? null,
    emailNormalized: prepared.email_normalized,
    link: input.link ?? null,
  });

  const mergeMode = existingLookup?.matchedBy ?? "none";
  const existing = existingLookup?.contact ?? null;
  const payload = buildCanonicalContactWritePayload({
    existing,
    incoming: prepared,
    linkedContext,
    mergeMode,
  });

  let contact: CanonicalContactRow;
  if (existing) {
    const updateRes = await client
      .from("contacts")
      .update(payload)
      .eq("id", existing.id)
      .eq("owner_user_id", prepared.owner_user_id)
      .select(CONTACT_SELECT)
      .single();
    if (updateRes.error || !updateRes.data) {
      throw new Error(updateRes.error?.message || "Could not update contact.");
    }
    contact = normalizeCanonicalContactRow(updateRes.data as Record<string, unknown>);
  } else {
    const insertRes = await client
      .from("contacts")
      .insert(payload)
      .select(CONTACT_SELECT)
      .single();
    if (insertRes.error || !insertRes.data) {
      throw new Error(insertRes.error?.message || "Could not create contact.");
    }
    contact = normalizeCanonicalContactRow(insertRes.data as Record<string, unknown>);
  }

  if (input.link) {
    const linkPayload = {
      owner_user_id: prepared.owner_user_id,
      contact_id: contact.id,
      source_kind: input.link.sourceKind,
      source_id: input.link.sourceId,
      section_key: input.link.sectionKey ?? null,
      category_key: input.link.categoryKey ?? null,
      context_label: input.link.label ?? null,
      role_label: input.link.role ?? null,
      updated_at: new Date().toISOString(),
    };
    const linkRes = await client.from("contact_links").upsert(linkPayload, {
      onConflict: "owner_user_id,source_kind,source_id",
    });
    if (linkRes.error) {
      throw new Error(linkRes.error.message);
    }
  }

  return contact;
}

export async function unlinkCanonicalContactSource(
  client: AnySupabaseClient,
  {
    ownerUserId,
    sourceKind,
    sourceId,
  }: {
    ownerUserId: string;
    sourceKind: "record" | "asset" | "invitation";
    sourceId: string;
  },
) {
  const res = await client
    .from("contact_links")
    .delete()
    .eq("owner_user_id", ownerUserId)
    .eq("source_kind", sourceKind)
    .eq("source_id", sourceId);

  if (res.error) {
    throw new Error(res.error.message);
  }
}

export async function loadCanonicalContactsByIds(
  client: AnySupabaseClient,
  ownerUserId: string,
  ids: string[],
) {
  const uniqueIds = [...new Set(ids.map((value) => value.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const res = await client
    .from("contacts")
    .select(CONTACT_SELECT)
    .eq("owner_user_id", ownerUserId)
    .in("id", uniqueIds);

  if (res.error) {
    throw new Error(res.error.message);
  }

  return hydrateCanonicalContacts(
    ((res.data ?? []) as Array<Record<string, unknown>>).map(normalizeCanonicalContactRow),
    await loadCanonicalContactSupport(client, ownerUserId, uniqueIds),
  );
}

export async function loadCanonicalContactsForOwner(
  client: AnySupabaseClient,
  ownerUserId: string,
) {
  const res = await client
    .from("contacts")
    .select(CONTACT_SELECT)
    .eq("owner_user_id", ownerUserId)
    .order("updated_at", { ascending: false });

  if (res.error) {
    throw new Error(res.error.message);
  }

  const contacts = ((res.data ?? []) as Array<Record<string, unknown>>).map(normalizeCanonicalContactRow);
  return hydrateCanonicalContacts(contacts, await loadCanonicalContactSupport(client, ownerUserId, contacts.map((row) => row.id)));
}

export async function deleteCanonicalContact(
  client: AnySupabaseClient,
  {
    ownerUserId,
    contactId,
  }: {
    ownerUserId: string;
    contactId: string;
  },
) {
  const inviteRes = await client
    .from("contact_invitations")
    .select("id")
    .eq("owner_user_id", ownerUserId)
    .eq("contact_id", contactId);

  if (inviteRes.error) {
    throw new Error(inviteRes.error.message);
  }

  const invitationIds = ((inviteRes.data ?? []) as Array<Record<string, unknown>>)
    .map((row) => String(row.id ?? "").trim())
    .filter(Boolean);

  const grantDeleteRequests = [
    client
      .from("account_access_grants")
      .delete()
      .eq("owner_user_id", ownerUserId)
      .eq("contact_id", contactId),
  ];
  if (invitationIds.length > 0) {
    grantDeleteRequests.push(
      client
        .from("account_access_grants")
        .delete()
        .eq("owner_user_id", ownerUserId)
        .in("invitation_id", invitationIds),
    );
  }

  const [grantsByContactRes, grantsByInvitationRes, invitationDeleteRes, recordContactsRes, deleteRes] = await Promise.all([
    grantDeleteRequests[0],
    grantDeleteRequests[1] ?? Promise.resolve({ error: null }),
    client
      .from("contact_invitations")
      .delete()
      .eq("owner_user_id", ownerUserId)
      .eq("contact_id", contactId),
    client
      .from("record_contacts")
      .update({ contact_id: null })
      .eq("owner_user_id", ownerUserId)
      .eq("contact_id", contactId),
    client
      .from("contacts")
      .delete()
      .eq("owner_user_id", ownerUserId)
      .eq("id", contactId),
  ]);

  if (grantsByContactRes.error) throw new Error(grantsByContactRes.error.message);
  if (grantsByInvitationRes?.error) throw new Error(grantsByInvitationRes.error.message);
  if (invitationDeleteRes.error) throw new Error(invitationDeleteRes.error.message);
  if (recordContactsRes.error) throw new Error(recordContactsRes.error.message);
  if (deleteRes.error) throw new Error(deleteRes.error.message);
}

export function mapInvitationStatusToCanonicalInviteStatus(status: string): CanonicalContactInviteStatus {
  const normalized = normalizeText(status);
  if (normalized === "accepted") return "accepted";
  if (normalized === "rejected") return "rejected";
  if (normalized === "revoked") return "revoked";
  if (normalized === "pending") return "invite_sent";
  return "not_invited";
}

export function mapActivationStatusToVerificationStatus(status: string): CanonicalContactVerificationStatus {
  const normalized = normalizeText(status);
  if (
    normalized === "invited"
    || normalized === "accepted"
    || normalized === "pending_verification"
    || normalized === "verification_submitted"
    || normalized === "verified"
    || normalized === "active"
    || normalized === "rejected"
    || normalized === "revoked"
  ) {
    return normalized as CanonicalContactVerificationStatus;
  }
  return "not_verified";
}

export function mergeLinkedContexts(
  existing: CanonicalContactContext[],
  nextContext: CanonicalContactContext | null,
) {
  const merged = [...existing];
  if (nextContext) {
    const existingIndex = merged.findIndex(
      (item) => item.source_kind === nextContext.source_kind && item.source_id === nextContext.source_id,
    );
    if (existingIndex >= 0) {
      merged[existingIndex] = {
        ...merged[existingIndex],
        ...nextContext,
      };
    } else {
      merged.push(nextContext);
    }
  }
  return merged;
}

export function normalizeCanonicalLinkedContexts(
  existing: CanonicalContactContext[],
  authoritative: CanonicalContactContext[],
) {
  const normalizedAuthoritative = authoritative.filter(Boolean);
  const carryForward = (existing ?? []).filter((candidate) => {
    return !normalizedAuthoritative.some((truth) => isSupersededContactContext(candidate, truth));
  });

  const merged: CanonicalContactContext[] = [];
  for (const item of [...normalizedAuthoritative, ...carryForward]) {
    const duplicateIndex = merged.findIndex((current) => isExactContactContextMatch(current, item));
    if (duplicateIndex >= 0) {
      merged[duplicateIndex] = {
        ...merged[duplicateIndex],
        ...item,
      };
    } else {
      merged.push(item);
    }
  }
  return merged;
}

function buildLinkedContext(link: ContactSyncLink): CanonicalContactContext {
  return {
    source_kind: link.sourceKind,
    source_id: link.sourceId,
    section_key: link.sectionKey ?? null,
    category_key: link.categoryKey ?? null,
    label: link.label ?? null,
    role: link.role ?? null,
  };
}

function linkRowToContext(row: CanonicalContactLinkRow): CanonicalContactContext {
  return {
    source_kind: row.source_kind,
    source_id: row.source_id,
    section_key: row.section_key,
    category_key: row.category_key,
    label: row.context_label,
    role: row.role_label,
  };
}

function isExactContactContextMatch(left: CanonicalContactContext, right: CanonicalContactContext) {
  return left.source_kind === right.source_kind
    && left.source_id === right.source_id
    && (left.section_key ?? null) === (right.section_key ?? null)
    && (left.category_key ?? null) === (right.category_key ?? null)
    && (left.label ?? null) === (right.label ?? null)
    && (left.role ?? null) === (right.role ?? null);
}

function isSupersededContactContext(candidate: CanonicalContactContext, truth: CanonicalContactContext) {
  if (candidate.source_kind !== truth.source_kind) return false;
  if ((candidate.source_id ?? "") === (truth.source_id ?? "")) return true;

  const sameCategory = (candidate.section_key ?? null) === (truth.section_key ?? null)
    && (candidate.category_key ?? null) === (truth.category_key ?? null);
  const sameRole = (candidate.role ?? null) === (truth.role ?? null);
  const sameLabel = (candidate.label ?? null) === (truth.label ?? null);
  const roleGapButSameCategory = sameCategory && (!candidate.role || !truth.role);

  if (sameCategory && (sameRole || sameLabel || roleGapButSameCategory)) return true;
  return false;
}

type PreparedCanonicalContactPayload = {
  owner_user_id: string;
  full_name: string;
  email: string | null;
  email_normalized: string | null;
  phone: string | null;
  contact_role: string | null;
  relationship: string | null;
  invite_status: CanonicalContactInviteStatus;
  verification_status: CanonicalContactVerificationStatus;
  source_type: CanonicalContactSourceType;
};

function prepareCanonicalContactPayload(input: SyncCanonicalContactInput): PreparedCanonicalContactPayload {
  const email = normalizeText(input.email);
  return {
    owner_user_id: input.ownerUserId,
    full_name: normalizeText(input.fullName),
    email: email || null,
    email_normalized: email ? email.toLowerCase() : null,
    phone: normalizeText(input.phone) || null,
    contact_role: normalizeText(input.contactRole) || null,
    relationship: normalizeText(input.relationship) || null,
    invite_status: input.inviteStatus ?? "not_invited",
    verification_status: input.verificationStatus ?? "not_verified",
    source_type: input.sourceType,
  };
}

export function shouldCanonicalContactIncomingSourceOwnFields(
  existingSourceType: CanonicalContactSourceType | null | undefined,
  incomingSourceType: CanonicalContactSourceType,
  mergeMode: "none" | "id" | "link" | "email",
) {
  if (mergeMode !== "email") return true;
  if (!existingSourceType || existingSourceType === incomingSourceType) return true;
  if (incomingSourceType === "invitation" && existingSourceType !== "invitation") return false;
  if (existingSourceType === "invitation" && incomingSourceType !== "invitation") return true;
  return getCanonicalContactSourcePriority(incomingSourceType) >= getCanonicalContactSourcePriority(existingSourceType);
}

async function findExistingCanonicalContact(
  client: AnySupabaseClient,
  ownerUserId: string,
  {
    existingContactId,
    emailNormalized,
    link,
  }: {
    existingContactId: string | null;
    emailNormalized: string | null;
    link: ContactSyncLink | null;
  },
): Promise<{ contact: CanonicalContactRow; matchedBy: "id" | "link" | "email" } | null> {
  if (existingContactId) {
    const byId = await client
      .from("contacts")
      .select(CONTACT_SELECT)
      .eq("id", existingContactId)
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();
    if (byId.error) throw new Error(byId.error.message);
    if (byId.data) {
      return { contact: normalizeCanonicalContactRow(byId.data as Record<string, unknown>), matchedBy: "id" };
    }
  }

  if (link?.sourceId) {
    const byLink = await client
      .from("contact_links")
      .select("contact_id")
      .eq("owner_user_id", ownerUserId)
      .eq("source_kind", link.sourceKind)
      .eq("source_id", link.sourceId)
      .maybeSingle();
    if (byLink.error) throw new Error(byLink.error.message);
    if (byLink.data?.contact_id) {
      const byLinkedId = await client
        .from("contacts")
        .select(CONTACT_SELECT)
        .eq("id", String((byLink.data as ContactLinkRow).contact_id))
        .eq("owner_user_id", ownerUserId)
        .maybeSingle();
      if (byLinkedId.error) throw new Error(byLinkedId.error.message);
      if (byLinkedId.data) {
        return { contact: normalizeCanonicalContactRow(byLinkedId.data as Record<string, unknown>), matchedBy: "link" };
      }
    }
  }

  if (emailNormalized) {
    const byEmail = await client
      .from("contacts")
      .select(CONTACT_SELECT)
      .eq("owner_user_id", ownerUserId)
      .eq("email_normalized", emailNormalized)
      .maybeSingle();
    if (byEmail.error) throw new Error(byEmail.error.message);
    if (byEmail.data) {
      return { contact: normalizeCanonicalContactRow(byEmail.data as Record<string, unknown>), matchedBy: "email" };
    }
  }

  return null;
}

function buildCanonicalContactWritePayload({
  existing,
  incoming,
  linkedContext,
  mergeMode,
}: {
  existing: CanonicalContactRow | null;
  incoming: PreparedCanonicalContactPayload;
  linkedContext: CanonicalContactContext | null;
  mergeMode: "none" | "id" | "link" | "email";
}) {
  const existingContexts = existing?.linked_context ?? [];
  const mergedContexts = mergeLinkedContexts(existingContexts, linkedContext);
  const sourceOwnsFields = shouldCanonicalContactIncomingSourceOwnFields(existing?.source_type, incoming.source_type, mergeMode);

  return {
    user_id: incoming.owner_user_id,
    owner_user_id: incoming.owner_user_id,
    full_name: sourceOwnsFields ? incoming.full_name || existing?.full_name || "Contact" : existing?.full_name || incoming.full_name || "Contact",
    email: incoming.email ?? existing?.email ?? null,
    email_normalized: incoming.email_normalized ?? existing?.email_normalized ?? null,
    phone: sourceOwnsFields ? incoming.phone ?? existing?.phone ?? null : existing?.phone ?? incoming.phone ?? null,
    contact_role: sourceOwnsFields ? incoming.contact_role ?? existing?.contact_role ?? null : existing?.contact_role ?? incoming.contact_role ?? null,
    relationship: sourceOwnsFields ? incoming.relationship ?? existing?.relationship ?? null : existing?.relationship ?? incoming.relationship ?? null,
    linked_context: mergedContexts,
    invite_status: resolveInviteStatus(existing?.invite_status ?? null, incoming.invite_status),
    verification_status: resolveVerificationStatus(existing?.verification_status ?? null, incoming.verification_status),
    source_type: sourceOwnsFields ? incoming.source_type : existing?.source_type ?? incoming.source_type,
    updated_at: new Date().toISOString(),
  };
}

function getCanonicalContactSourcePriority(sourceType: CanonicalContactSourceType) {
  if (sourceType === "executor_asset") return 5;
  if (sourceType === "trusted_contact") return 4;
  if (sourceType === "next_of_kin") return 3;
  if (sourceType === "record_contact") return 2;
  if (sourceType === "manual") return 1;
  return 0;
}

type CanonicalContactSupport = {
  linksByContactId: Map<string, CanonicalContactLinkRow[]>;
  invitationsByContactId: Map<string, CanonicalContactInvitationRow[]>;
  activationsByInvitationId: Map<string, CanonicalContactActivationRow>;
};

async function loadCanonicalContactSupport(
  client: AnySupabaseClient,
  ownerUserId: string,
  contactIds: string[],
): Promise<CanonicalContactSupport> {
  const uniqueIds = [...new Set(contactIds.map((value) => value.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return {
      linksByContactId: new Map(),
      invitationsByContactId: new Map(),
      activationsByInvitationId: new Map(),
    };
  }

  const [linksRes, invitationsRes] = await Promise.all([
    client
      .from("contact_links")
      .select("id,owner_user_id,contact_id,source_kind,source_id,section_key,category_key,context_label,role_label,created_at,updated_at")
      .eq("owner_user_id", ownerUserId)
      .in("contact_id", uniqueIds),
    client
      .from("contact_invitations")
      .select("id,contact_id,contact_name,contact_email,assigned_role,invitation_status,invited_at,sent_at,updated_at")
      .eq("owner_user_id", ownerUserId)
      .in("contact_id", uniqueIds),
  ]);

  if (linksRes.error) throw new Error(linksRes.error.message);
  if (invitationsRes.error) throw new Error(invitationsRes.error.message);

  const invitationIds = ((invitationsRes.data ?? []) as Array<Record<string, unknown>>)
    .map((row) => String(row.id ?? "").trim())
    .filter(Boolean);

  let activationsByInvitationId = new Map<string, CanonicalContactActivationRow>();
  if (invitationIds.length > 0) {
    const activationsRes = await client
      .from("role_assignments")
      .select("invitation_id,assigned_role,activation_status,updated_at")
      .eq("owner_user_id", ownerUserId)
      .in("invitation_id", invitationIds);
    if (activationsRes.error) throw new Error(activationsRes.error.message);
    activationsByInvitationId = new Map(
      ((activationsRes.data ?? []) as Array<Record<string, unknown>>).map((row) => {
        const activation = normalizeCanonicalContactActivationRow(row);
        return [activation.invitation_id, activation];
      }),
    );
  }

  const linksByContactId = new Map<string, CanonicalContactLinkRow[]>();
  for (const row of ((linksRes.data ?? []) as Array<Record<string, unknown>>).map(normalizeCanonicalContactLinkRow)) {
    const items = linksByContactId.get(row.contact_id) ?? [];
    items.push(row);
    linksByContactId.set(row.contact_id, items);
  }

  const invitationsByContactId = new Map<string, CanonicalContactInvitationRow[]>();
  for (const row of ((invitationsRes.data ?? []) as Array<Record<string, unknown>>).map(normalizeCanonicalContactInvitationRow)) {
    const contactId = String(row.contact_id ?? "").trim();
    if (!contactId) continue;
    const items = invitationsByContactId.get(contactId) ?? [];
    items.push(row);
    invitationsByContactId.set(contactId, items);
  }

  return {
    linksByContactId,
    invitationsByContactId,
    activationsByInvitationId,
  };
}

function hydrateCanonicalContacts(
  contacts: CanonicalContactRow[],
  support: CanonicalContactSupport,
) {
  return contacts.map((contact) => {
    const linkRows = support.linksByContactId.get(contact.id) ?? [];
    const invitationRows = support.invitationsByContactId.get(contact.id) ?? [];
    const authoritativeContexts = linkRows.map(linkRowToContext);
    const normalizedContexts = normalizeCanonicalLinkedContexts(contact.linked_context ?? [], authoritativeContexts);
    const latestInvitation = getLatestCanonicalContactInvitation(invitationRows);
    const latestActivation = latestInvitation ? support.activationsByInvitationId.get(latestInvitation.id) ?? null : null;
    const derivedRole = resolveCanonicalContactDisplayRole(contact, normalizedContexts, latestInvitation, latestActivation);
    const derivedSourceType = resolveCanonicalContactDisplaySourceType(contact, normalizedContexts, latestInvitation, derivedRole);

    return {
      ...contact,
      contact_role: derivedRole ?? contact.contact_role,
      source_type: derivedSourceType,
      linked_context: normalizedContexts,
      invite_status: latestInvitation ? mapInvitationStatusToCanonicalInviteStatus(String(latestInvitation.invitation_status ?? "")) : contact.invite_status,
      verification_status: latestActivation
        ? mapActivationStatusToVerificationStatus(String(latestActivation.activation_status ?? ""))
        : contact.verification_status,
    };
  });
}

function getLatestCanonicalContactInvitation(rows: CanonicalContactInvitationRow[]) {
  return [...rows].sort((left, right) => {
    const leftStamp = Date.parse(left.sent_at || left.invited_at || left.updated_at || "");
    const rightStamp = Date.parse(right.sent_at || right.invited_at || right.updated_at || "");
    return rightStamp - leftStamp;
  })[0] ?? null;
}

export function resolveCanonicalContactDisplayRole(
  contact: CanonicalContactRow,
  contexts: CanonicalContactContext[],
  latestInvitation: CanonicalContactInvitationRow | null,
  latestActivation: CanonicalContactActivationRow | null,
) {
  const contextTerms = contexts.flatMap((item) => [normalizeText(item.role), normalizeText(item.label), normalizeText(item.category_key)]);
  const invitationRole = normalizeText(latestActivation?.assigned_role) || normalizeText(latestInvitation?.assigned_role);
  const directRole = normalizeText(contact.contact_role);
  const directRelationship = normalizeText(contact.relationship);
  const candidates = [...contextTerms, invitationRole, directRole, directRelationship].filter(Boolean);

  const exact = candidates.find((item) => item === "executor" || item === "co_executor" || item === "power_of_attorney" || item === "trustee" || item === "accountant" || item === "lawyer" || item === "financial_advisor" || item === "professional_advisor" || item === "friend_or_family");
  if (exact) return exact === "financial_advisor" ? "professional_advisor" : exact;
  if (candidates.some((item) => item.includes("executor") || item.includes("power of attorney") || item.includes("power_of_attorney"))) return "executor";
  if (candidates.some((item) => item.includes("trustee"))) return "trustee";
  if (candidates.some((item) => item.includes("accountant"))) return "accountant";
  if (candidates.some((item) => item.includes("lawyer") || item.includes("solicitor"))) return "lawyer";
  if (candidates.some((item) => item.includes("financial advisor") || item.includes("financial_advisor") || item.includes("financial adviser"))) return "professional_advisor";
  if (candidates.some((item) => item.includes("advisor") || item.includes("adviser") || item.includes("professional"))) return "professional_advisor";
  if (candidates.some((item) => item.includes("family") || item.includes("spouse") || item.includes("child") || item.includes("parent") || item.includes("sibling") || item.includes("next of kin"))) return "friend_or_family";
  return directRole || invitationRole || null;
}

export function resolveCanonicalContactDisplaySourceType(
  contact: CanonicalContactRow,
  contexts: CanonicalContactContext[],
  latestInvitation: CanonicalContactInvitationRow | null,
  derivedRole: string | null,
): CanonicalContactSourceType {
  if (contexts.some((item) => normalizeText(item.role).includes("executor") || normalizeText(item.category_key) === "executors")) {
    return "executor_asset";
  }
  if (contexts.some((item) => normalizeText(item.label).includes("next of kin") || normalizeText(item.role).includes("next of kin"))) {
    return "next_of_kin";
  }
  if (contact.source_type === "next_of_kin") return "next_of_kin";
  if (latestInvitation || derivedRole === "professional_advisor" || derivedRole === "accountant" || derivedRole === "financial_advisor" || derivedRole === "lawyer") {
    return "invitation";
  }
  return contact.source_type;
}

function normalizeCanonicalContactLinkRow(row: Record<string, unknown>): CanonicalContactLinkRow {
  const sourceKind = normalizeText(row.source_kind);
  return {
    id: String(row.id ?? ""),
    owner_user_id: String(row.owner_user_id ?? ""),
    contact_id: String(row.contact_id ?? ""),
    source_kind: sourceKind === "asset" || sourceKind === "invitation" ? sourceKind : "record",
    source_id: String(row.source_id ?? ""),
    section_key: normalizeText(row.section_key) || null,
    category_key: normalizeText(row.category_key) || null,
    context_label: normalizeText(row.context_label) || null,
    role_label: normalizeText(row.role_label) || null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function normalizeCanonicalContactInvitationRow(row: Record<string, unknown>): CanonicalContactInvitationRow {
  return {
    id: String(row.id ?? ""),
    contact_id: typeof row.contact_id === "string" ? row.contact_id : null,
    contact_name: normalizeText(row.contact_name) || null,
    contact_email: normalizeText(row.contact_email) || null,
    assigned_role: normalizeText(row.assigned_role) || null,
    invitation_status: normalizeText(row.invitation_status) || null,
    invited_at: String(row.invited_at ?? ""),
    sent_at: typeof row.sent_at === "string" ? row.sent_at : null,
    updated_at: String(row.updated_at ?? ""),
  };
}

function normalizeCanonicalContactActivationRow(row: Record<string, unknown>): CanonicalContactActivationRow {
  return {
    invitation_id: String(row.invitation_id ?? ""),
    assigned_role: normalizeText(row.assigned_role) || null,
    activation_status: normalizeText(row.activation_status) || null,
    updated_at: String(row.updated_at ?? ""),
  };
}

function resolveInviteStatus(
  current: CanonicalContactInviteStatus | null,
  incoming: CanonicalContactInviteStatus,
): CanonicalContactInviteStatus {
  if (!current) return incoming;
  const weight: Record<CanonicalContactInviteStatus, number> = {
    not_invited: 0,
    invite_sent: 1,
    accepted: 2,
    rejected: 2,
    revoked: 3,
  };
  return weight[incoming] >= weight[current] ? incoming : current;
}

function resolveVerificationStatus(
  current: CanonicalContactVerificationStatus | null,
  incoming: CanonicalContactVerificationStatus,
): CanonicalContactVerificationStatus {
  if (!current) return incoming;
  const weight: Record<CanonicalContactVerificationStatus, number> = {
    not_verified: 0,
    invited: 1,
    accepted: 2,
    pending_verification: 3,
    verification_submitted: 4,
    verified: 5,
    active: 6,
    rejected: 2,
    revoked: 7,
  };
  return weight[incoming] >= weight[current] ? incoming : current;
}

function normalizeCanonicalContactRow(row: Record<string, unknown>): CanonicalContactRow {
  return {
    id: String(row.id ?? ""),
    owner_user_id: String(row.owner_user_id ?? ""),
    full_name: normalizeText(row.full_name) || "Contact",
    email: normalizeText(row.email) || null,
    email_normalized: normalizeText(row.email_normalized) || null,
    phone: normalizeText(row.phone) || null,
    contact_role: normalizeText(row.contact_role) || null,
    relationship: normalizeText(row.relationship) || null,
    linked_context: readLinkedContexts(row.linked_context),
    invite_status: mapStoredInviteStatus(row.invite_status),
    verification_status: mapStoredVerificationStatus(row.verification_status),
    source_type: mapStoredSourceType(row.source_type),
    validation_overrides: readValidationOverrides(row.validation_overrides),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function readLinkedContexts(value: unknown): CanonicalContactContext[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const sourceKind = normalizeText(record.source_kind);
      const sourceId = normalizeText(record.source_id);
      if (!sourceKind || !sourceId) return null;
      return {
        source_kind:
          sourceKind === "asset" || sourceKind === "invitation" || sourceKind === "record"
            ? sourceKind
            : "record",
        source_id: sourceId,
        section_key: normalizeText(record.section_key) || null,
        category_key: normalizeText(record.category_key) || null,
        label: normalizeText(record.label) || null,
        role: normalizeText(record.role) || null,
      } as CanonicalContactContext;
    })
    .filter(Boolean) as CanonicalContactContext[];
}

function mapStoredInviteStatus(value: unknown): CanonicalContactInviteStatus {
  const normalized = normalizeText(value);
  if (
    normalized === "not_invited"
    || normalized === "invite_sent"
    || normalized === "accepted"
    || normalized === "rejected"
    || normalized === "revoked"
  ) {
    return normalized;
  }
  return "not_invited";
}

function mapStoredVerificationStatus(value: unknown): CanonicalContactVerificationStatus {
  const normalized = normalizeText(value);
  if (
    normalized === "not_verified"
    || normalized === "invited"
    || normalized === "accepted"
    || normalized === "pending_verification"
    || normalized === "verification_submitted"
    || normalized === "verified"
    || normalized === "active"
    || normalized === "rejected"
    || normalized === "revoked"
  ) {
    return normalized;
  }
  return "not_verified";
}

function mapStoredSourceType(value: unknown): CanonicalContactSourceType {
  const normalized = normalizeText(value);
  if (
    normalized === "next_of_kin"
    || normalized === "executor_asset"
    || normalized === "trusted_contact"
    || normalized === "invitation"
    || normalized === "record_contact"
    || normalized === "manual"
  ) {
    return normalized;
  }
  return "manual";
}

function readValidationOverrides(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, { manually_confirmed?: boolean; updated_at?: string }>>((acc, [key, entry]) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return acc;
    const source = entry as Record<string, unknown>;
    acc[key] = {
      manually_confirmed: source.manually_confirmed === true,
      updated_at: typeof source.updated_at === "string" ? source.updated_at : undefined,
    };
    return acc;
  }, {});
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const CONTACT_SELECT =
  "id,owner_user_id,full_name,email,email_normalized,phone,contact_role,relationship,linked_context,invite_status,verification_status,source_type,validation_overrides,created_at,updated_at";
