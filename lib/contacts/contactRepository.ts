import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCanonicalSharedContactEntity,
  deleteCanonicalContact,
  hydrateProjectionRowsWithCanonicalContacts,
  inferCanonicalContactPermissionScope,
  loadCanonicalContactInvitationsForOwner,
  loadCanonicalContactsByIds,
  loadCanonicalContactsForOwner,
  mapActivationStatusToVerificationStatus,
  mapInvitationStatusToCanonicalInviteStatus,
  replaceCanonicalRecordContactProjection,
  syncCanonicalContact,
  unlinkCanonicalContactSource,
  upsertCanonicalContactInvitationProjection,
  type CanonicalContactContext,
  type CanonicalContactInviteProjectionRow,
  type CanonicalContactInviteStatus,
  type CanonicalContactPermissionScope,
  type CanonicalContactRow,
  type CanonicalContactVerificationStatus,
  type CanonicalSharedContactEntity,
  type SyncCanonicalContactInput,
} from "./canonicalContacts.ts";
import { buildPeopleRelationship, type PeopleRelationship } from "./relationships.ts";

type AnySupabaseClient = SupabaseClient;

export type PeopleContactRelationshipType =
  | "executor"
  | "trusted_contact"
  | "next_of_kin"
  | "invitee"
  | "linked_user"
  | "adviser"
  | "beneficiary"
  | "probate_contact"
  | "enterprise_contact"
  | "organisation_user"
  | "support_contact"
  | "record_contact";

export type PeopleContactEntity = CanonicalSharedContactEntity & {
  relationship_type: PeopleContactRelationshipType;
  invitation_state: CanonicalContactInviteStatus;
  verification_state: CanonicalContactVerificationStatus;
  permission_scope: CanonicalContactPermissionScope[];
  consent_scope: PeopleConsentScope;
  governance_flags: PeopleGovernanceFlags;
  audit_metadata: PeopleAuditMetadata;
  relationships: PeopleRelationship[];
};

export type PeopleConsentScope = {
  adviserInsights: boolean | null;
  marketing: boolean | null;
  explicitDelegation: boolean;
  inheritedFromContext: boolean;
};

export type PeopleGovernanceFlags = {
  exportRestricted: boolean;
  requiresConsentReview: boolean;
  requiresVerification: boolean;
  prototypeOnly: boolean;
  organisationRestricted: boolean;
};

export type PeopleAuditMetadata = {
  sourceModule: "contacts" | "dashboard" | "records" | "probate" | "enterprise" | "demo" | "unknown";
  lastDecision: "allowed" | "restricted" | "pending_review";
  auditReady: boolean;
  compatibilitySurface: boolean;
};

export type PeopleScopeSourceRow = {
  source_kind: "asset" | "record";
  id: string;
  section_key: string | null;
  category_key: string | null;
  title: string | null;
  summary?: string | null;
  provider_name?: string | null;
};

export type PeopleContactRepository = {
  list(ownerUserId: string): Promise<PeopleContactEntity[]>;
  getByIds(ownerUserId: string, ids: string[]): Promise<PeopleContactEntity[]>;
  upsert(input: SyncCanonicalContactInput): Promise<CanonicalContactRow>;
  delete(input: { ownerUserId: string; contactId: string }): Promise<void>;
  invitations(ownerUserId: string): Promise<CanonicalContactInviteProjectionRow[]>;
  upsertInvitationProjection(input: SavePeopleInvitationProjectionInput): ReturnType<typeof upsertCanonicalContactInvitationProjection>;
  unlinkSource(input: UnlinkPeopleContactSourceInput): ReturnType<typeof unlinkCanonicalContactSource>;
  replaceRecordProjection(input: ReplacePeopleRecordProjectionInput): ReturnType<typeof replaceCanonicalRecordContactProjection>;
  hydrateProjectionRows<T extends PeopleProjectionHydratableRow>(ownerUserId: string, rows: T[]): Promise<T[]>;
  scopeResources(ownerUserId: string): Promise<PeopleScopeSourceRow[]>;
};

export type SavePeopleInvitationProjectionInput = Parameters<typeof upsertCanonicalContactInvitationProjection>[1];
export type UnlinkPeopleContactSourceInput = Parameters<typeof unlinkCanonicalContactSource>[1];
export type ReplacePeopleRecordProjectionInput = Parameters<typeof replaceCanonicalRecordContactProjection>[1];
export type PeopleProjectionHydratableRow = Parameters<typeof hydrateProjectionRowsWithCanonicalContacts>[2][number];

export const PEOPLE_CONTACT_REPOSITORY_CONTRACT = {
  entityName: "PeopleContactEntity",
  canonicalTables: ["contacts", "contact_links", "contact_invitations"],
  compatibilityTables: ["record_contacts", "role_assignments", "account_access_grants", "section_entries"],
  canonicalFields: [
    "id",
    "full_name",
    "email",
    "phone",
    "relationship_type",
    "contact_role",
    "linked_context",
    "verification_status",
    "invite_status",
    "consent_scope",
    "governance_flags",
    "source_type",
    "audit_metadata",
  ],
  unifiedFlows: [
    "executors",
    "trusted_contacts",
    "next_of_kin",
    "invitees",
    "linked_users",
    "admin_prototype_contacts",
    "enterprise_organisation_contacts",
  ],
  rule: "Executors, trusted contacts, next of kin, invitees, and linked users must use this repository boundary before adding people/contact persistence.",
  migrationState: "compatibility_preserved",
} as const;

export const PEOPLE_CONTACT_MIGRATION_STRATEGY = {
  currentAdapter: "mock/frontend Supabase adapter over canonical contact tables",
  canonicalFirst: [
    "Write contacts to contacts.",
    "Store relationships in contact_links.",
    "Project invitations through contact_invitations and role_assignments for legacy compatibility.",
  ],
  compatibility: [
    "SectionWorkspace and record_contacts reads remain supported while linked records migrate.",
    "Legacy section_entries contact data must not be expanded for new people features.",
    "Invitation and executor access tables remain compatibility projections until a backend migration backfills canonical links.",
  ],
  futureMigration: [
    "Backfill section_entries and record_contacts into contacts/contact_links.",
    "Attach production role claims and permission scopes to canonical contacts.",
    "Retire compatibility projections only after invitation, executor, and linked-record regression checks pass.",
  ],
} as const;

function normalizeContactTerm(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function contextTerms(contexts: CanonicalContactContext[]) {
  return contexts.flatMap((context) => [
    normalizeContactTerm(context.role),
    normalizeContactTerm(context.label),
    normalizeContactTerm(context.section_key),
    normalizeContactTerm(context.category_key),
  ]);
}

export function getCanonicalPeopleRelationshipType(
  contact: Pick<CanonicalContactRow, "contact_role" | "relationship" | "source_type" | "linked_context">,
): PeopleContactRelationshipType {
  const terms = [
    normalizeContactTerm(contact.contact_role),
    normalizeContactTerm(contact.relationship),
    normalizeContactTerm(contact.source_type),
    ...contextTerms(contact.linked_context ?? []),
  ].filter(Boolean);

  if (terms.some((term) => term.includes("executor"))) return "executor";
  if (terms.some((term) => term.includes("next_of_kin") || term.includes("emergency_contact"))) return "next_of_kin";
  if (terms.some((term) => term.includes("trusted_contact") || term.includes("trusted"))) return "trusted_contact";
  if (terms.some((term) => term.includes("invitation") || term.includes("invite"))) return "invitee";
  if (terms.some((term) => term.includes("adviser") || term.includes("advisor"))) return "adviser";
  if (terms.some((term) => term.includes("beneficiary"))) return "beneficiary";
  if (terms.some((term) => term.includes("probate"))) return "probate_contact";
  if (terms.some((term) => term.includes("enterprise"))) return "enterprise_contact";
  if (terms.some((term) => term.includes("organisation") || term.includes("organization"))) return "organisation_user";
  if (terms.some((term) => term.includes("support"))) return "support_contact";
  if ((contact.linked_context ?? []).some((context) => context.source_kind === "record" || context.source_kind === "asset")) return "linked_user";
  return "record_contact";
}

export function buildPeopleContactEntity(contact: CanonicalContactRow): PeopleContactEntity {
  const shared = buildCanonicalSharedContactEntity(contact);
  const permissionScope = shared.permission_scope?.length
    ? shared.permission_scope
    : inferCanonicalContactPermissionScope(contact);
  const relationshipType = getCanonicalPeopleRelationshipType(contact);

  return {
    ...shared,
    relationship_type: relationshipType,
    invitation_state: contact.invite_status,
    verification_state: contact.verification_status,
    permission_scope: permissionScope,
    consent_scope: inferPeopleConsentScope(contact, permissionScope),
    governance_flags: buildPeopleGovernanceFlags(contact, permissionScope),
    audit_metadata: buildPeopleAuditMetadata(contact),
    relationships: [
      buildPeopleRelationship({
        contactId: contact.id,
        relationshipType,
        linkedContext: contact.linked_context ?? [],
        inheritedConsent: permissionScope.includes("enterprise_reporting"),
      }),
    ],
  };
}

export function inferPeopleConsentScope(
  contact: Pick<CanonicalContactRow, "invite_status" | "verification_status" | "source_type" | "linked_context">,
  permissionScope = inferCanonicalContactPermissionScope(contact as CanonicalContactRow),
): PeopleConsentScope {
  const isEnterprise = permissionScope.includes("enterprise_reporting") || contact.source_type === "enterprise_contact";
  const isDelegated = contact.invite_status === "accepted" || contact.verification_status === "verified" || contact.verification_status === "active";
  return {
    adviserInsights: isEnterprise ? null : false,
    marketing: null,
    explicitDelegation: isDelegated,
    inheritedFromContext: isEnterprise || (contact.linked_context ?? []).some((context) => context.source_kind === "invitation"),
  };
}

export function buildPeopleGovernanceFlags(
  contact: Pick<CanonicalContactRow, "invite_status" | "verification_status" | "source_type" | "linked_context">,
  permissionScope = inferCanonicalContactPermissionScope(contact as CanonicalContactRow),
): PeopleGovernanceFlags {
  const requiresVerification = !["accepted", "verified", "active"].includes(contact.verification_status);
  return {
    exportRestricted: true,
    requiresConsentReview: permissionScope.includes("enterprise_reporting"),
    requiresVerification,
    prototypeOnly: contact.source_type === "enterprise_contact" || contact.source_type === "probate_contact",
    organisationRestricted: permissionScope.includes("organisation_admin") && requiresVerification,
  };
}

export function buildPeopleAuditMetadata(
  contact: Pick<CanonicalContactRow, "source_type" | "verification_status">,
): PeopleAuditMetadata {
  const sourceModule = contact.source_type === "executor_asset"
    ? "records"
    : contact.source_type === "probate_contact"
      ? "probate"
      : contact.source_type === "enterprise_contact"
        ? "enterprise"
        : contact.source_type === "invitation"
          ? "dashboard"
          : contact.source_type === "record_contact"
            ? "records"
            : "contacts";
  const verified = ["accepted", "verified", "active"].includes(contact.verification_status);
  return {
    sourceModule,
    lastDecision: verified ? "allowed" : "pending_review",
    auditReady: false,
    compatibilitySurface: contact.source_type === "invitation" || contact.source_type === "record_contact",
  };
}

export async function listPeopleContactsForOwner(client: AnySupabaseClient, ownerUserId: string) {
  const rows = await loadCanonicalContactsForOwner(client, ownerUserId);
  return rows.map(buildPeopleContactEntity);
}

export async function loadPeopleContactsByIds(client: AnySupabaseClient, ownerUserId: string, ids: string[]) {
  const rows = await loadCanonicalContactsByIds(client, ownerUserId, ids);
  return rows.map(buildPeopleContactEntity);
}

export function savePeopleContact(client: AnySupabaseClient, input: SyncCanonicalContactInput) {
  return syncCanonicalContact(client, input);
}

export function removePeopleContact(client: AnySupabaseClient, input: { ownerUserId: string; contactId: string }) {
  return deleteCanonicalContact(client, input);
}

export function loadPeopleInvitationsForOwner(client: AnySupabaseClient, ownerUserId: string) {
  return loadCanonicalContactInvitationsForOwner(client, ownerUserId);
}

export function savePeopleInvitationProjection(client: AnySupabaseClient, input: SavePeopleInvitationProjectionInput) {
  return upsertCanonicalContactInvitationProjection(client, input);
}

export function unlinkPeopleContactSource(client: AnySupabaseClient, input: UnlinkPeopleContactSourceInput) {
  return unlinkCanonicalContactSource(client, input);
}

export function replacePeopleRecordContactProjection(client: AnySupabaseClient, input: ReplacePeopleRecordProjectionInput) {
  return replaceCanonicalRecordContactProjection(client, input);
}

export function hydratePeopleProjectionRows<T extends PeopleProjectionHydratableRow>(
  client: AnySupabaseClient,
  ownerUserId: string,
  rows: T[],
) {
  return hydrateProjectionRowsWithCanonicalContacts(client, ownerUserId, rows);
}

export async function loadPeopleScopeResourcesForOwner(client: AnySupabaseClient, ownerUserId: string) {
  const [assetsRes, recordsRes] = await Promise.all([
    client
      .from("assets")
      .select("id,section_key,category_key,title,provider_name")
      .eq("owner_user_id", ownerUserId)
      .is("deleted_at", null)
      .is("archived_at", null),
    client
      .from("section_entries")
      .select("id,section_key,category_key,title,summary")
      .eq("user_id", ownerUserId),
  ]);

  const assets = ((assetsRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    source_kind: "asset" as const,
    id: String(row.id ?? ""),
    section_key: String(row.section_key ?? "") || null,
    category_key: String(row.category_key ?? "") || null,
    title: String(row.title ?? "") || null,
    provider_name: String(row.provider_name ?? "") || null,
  }));
  const records = ((recordsRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    source_kind: "record" as const,
    id: String(row.id ?? ""),
    section_key: String(row.section_key ?? "") || null,
    category_key: String(row.category_key ?? "") || null,
    title: String(row.title ?? "") || null,
    summary: String(row.summary ?? "") || null,
  }));

  return [...assets, ...records] satisfies PeopleScopeSourceRow[];
}

export function createPeopleContactRepository(client: AnySupabaseClient): PeopleContactRepository {
  return {
    list(ownerUserId) {
      return listPeopleContactsForOwner(client, ownerUserId);
    },
    getByIds(ownerUserId, ids) {
      return loadPeopleContactsByIds(client, ownerUserId, ids);
    },
    upsert(input) {
      return savePeopleContact(client, input);
    },
    async delete(input) {
      await removePeopleContact(client, input);
    },
    invitations(ownerUserId) {
      return loadPeopleInvitationsForOwner(client, ownerUserId);
    },
    upsertInvitationProjection(input) {
      return savePeopleInvitationProjection(client, input);
    },
    unlinkSource(input) {
      return unlinkPeopleContactSource(client, input);
    },
    replaceRecordProjection(input) {
      return replacePeopleRecordContactProjection(client, input);
    },
    hydrateProjectionRows(ownerUserId, rows) {
      return hydratePeopleProjectionRows(client, ownerUserId, rows);
    },
    scopeResources(ownerUserId) {
      return loadPeopleScopeResourcesForOwner(client, ownerUserId);
    },
  };
}

export {
  mapActivationStatusToVerificationStatus,
  mapInvitationStatusToCanonicalInviteStatus,
};

export type {
  CanonicalContactContext,
  CanonicalContactInviteProjectionRow,
  CanonicalContactInviteStatus,
  CanonicalContactPermissionScope,
  CanonicalContactRow,
  CanonicalContactVerificationStatus,
  CanonicalSharedContactEntity,
  SyncCanonicalContactInput,
  PeopleRelationship,
};
