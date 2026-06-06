import type { PlatformRole } from "../auth/platformRoles.ts";
import type { PeopleContactEntity } from "../contacts/contactRepository.ts";
import type { AuditGovernanceMetadata, PlatformAuditEvent } from "../audit/auditEvents.ts";

export type DomainEntityName =
  | "user_profile"
  | "vault_record"
  | "asset"
  | "document"
  | "attachment"
  | "people_contact"
  | "invitation"
  | "access_grant"
  | "role_assignment"
  | "permission_template"
  | "workspace_context"
  | "organisation"
  | "licence"
  | "report"
  | "audit_event"
  | "background_job";

export type EntityVisibility = "owner_private" | "role_shared" | "admin_operational" | "enterprise_banded" | "system_only";

export type DomainEntityContract = {
  name: DomainEntityName;
  canonicalStore: string;
  compatibilityStores: string[];
  visibility: EntityVisibility;
  ownerScoped: boolean;
  governanceRequired: boolean;
  notes: string;
};

export type PlatformSessionPrincipal = {
  userId: string;
  email: string | null;
  roles: PlatformRole[];
  trustedRoleClaims: boolean;
  sessionId?: string | null;
};

export type ApiRequestContext = {
  requestId: string;
  principal: PlatformSessionPrincipal | null;
  route: string;
  environment: "development" | "preview" | "staging" | "production" | "test";
  governance?: AuditGovernanceMetadata;
};

export type ApiResult<T> =
  | { ok: true; data: T; audit?: PlatformAuditEvent[] }
  | { ok: false; status: number; error: { code: string; message: string }; audit?: PlatformAuditEvent[] };

export type RepositoryListOptions = {
  ownerUserId?: string | null;
  organisationId?: string | null;
  limit?: number;
  cursor?: string | null;
};

export type RepositoryMutationOptions = {
  context: ApiRequestContext;
  audit?: boolean;
};

export type DomainRepository<TRecord, TCreate = Partial<TRecord>, TUpdate = Partial<TRecord>> = {
  entity: DomainEntityName;
  list(options: RepositoryListOptions): Promise<TRecord[]>;
  get(id: string, options: RepositoryListOptions): Promise<TRecord | null>;
  create(input: TCreate, options: RepositoryMutationOptions): Promise<TRecord>;
  update(id: string, input: TUpdate, options: RepositoryMutationOptions): Promise<TRecord>;
  remove(id: string, options: RepositoryMutationOptions): Promise<{ removed: boolean }>;
};

export type DocumentAttachmentEntity = {
  id: string;
  ownerUserId: string;
  parentType: "asset" | "record" | "profile" | "case";
  parentId: string;
  fileName: string;
  mimeType: string | null;
  storageBucket: string;
  storagePath: string;
  sizeBytes?: number | null;
  createdAt: string;
};

export type AccessGrantEntity = {
  id: string;
  ownerUserId: string;
  linkedUserId: string;
  contactId: string | null;
  assignedRole: string;
  activationStatus: string;
  permissionsOverride?: Record<string, unknown> | null;
};

export type OrganisationEntity = {
  id: string;
  name: string;
  status: "active" | "setup" | "suspended" | "expired";
  ownerContactId?: string | null;
  consentGoverned: boolean;
};

export type LicenceEntity = {
  id: string;
  organisationId: string;
  planTier: "Starter" | "Professional" | "Enterprise";
  billingStatus: "active" | "trial" | "past_due" | "suspended" | "prototype";
  licenceStatus: "active" | "pending" | "suspended" | "expired";
  includedSeats: number;
  usedSeats: number;
  renewalDate: string;
};

export type BackgroundJobEntity = {
  id: string;
  type: string;
  status: "queued" | "running" | "succeeded" | "failed" | "blocked";
  payload: Record<string, unknown>;
  createdAt: string;
  runAfter?: string | null;
};

export type CanonicalDomainEntityMap = {
  people_contact: PeopleContactEntity;
  document: DocumentAttachmentEntity;
  attachment: DocumentAttachmentEntity;
  access_grant: AccessGrantEntity;
  role_assignment: AccessGrantEntity;
  permission_template: Record<string, unknown>;
  workspace_context: Record<string, unknown>;
  organisation: OrganisationEntity;
  licence: LicenceEntity;
  audit_event: PlatformAuditEvent;
  background_job: BackgroundJobEntity;
};

export const DOMAIN_ENTITY_CONTRACTS: DomainEntityContract[] = [
  {
    name: "people_contact",
    canonicalStore: "contacts/contact_links/contact_invitations",
    compatibilityStores: ["record_contacts", "role_assignments", "account_access_grants", "section_entries"],
    visibility: "role_shared",
    ownerScoped: true,
    governanceRequired: true,
    notes: "Executors, next of kin, trusted contacts, invitees, and linked users share the canonical People/Contacts repository boundary.",
  },
  {
    name: "document",
    canonicalStore: "asset_documents + Supabase storage",
    compatibilityStores: ["record_attachments"],
    visibility: "owner_private",
    ownerScoped: true,
    governanceRequired: true,
    notes: "AttachmentGallery remains the canonical document presentation surface; storage access must use signed URLs.",
  },
  {
    name: "audit_event",
    canonicalStore: "future append-only audit_events",
    compatibilityStores: ["prototype audit previews"],
    visibility: "system_only",
    ownerScoped: false,
    governanceRequired: true,
    notes: "Prototype previews are not persisted compliance logs until the audit adapter is replaced.",
  },
  {
    name: "role_assignment",
    canonicalStore: "future role_assignments",
    compatibilityStores: ["prototype roleManagementService"],
    visibility: "admin_operational",
    ownerScoped: true,
    governanceRequired: true,
    notes: "Account and platform role changes must pass the role permission API contract and emit audit events before persistence.",
  },
  {
    name: "permission_template",
    canonicalStore: "future permissions + role_permission_templates",
    compatibilityStores: ["rolePermissions.ts templates"],
    visibility: "admin_operational",
    ownerScoped: false,
    governanceRequired: true,
    notes: "Permission templates centralise role toggles and prevent page-level permission logic.",
  },
  {
    name: "workspace_context",
    canonicalStore: "future workspace_contexts",
    compatibilityStores: ["workspaces.ts"],
    visibility: "role_shared",
    ownerScoped: false,
    governanceRequired: true,
    notes: "Workspace context resolution remains role and trusted-claim controlled.",
  },
  {
    name: "organisation",
    canonicalStore: "future organisations API",
    compatibilityStores: ["enterprise mockData"],
    visibility: "enterprise_banded",
    ownerScoped: false,
    governanceRequired: true,
    notes: "Enterprise data remains banded/mock until organisation provisioning and consent enforcement are backend-backed.",
  },
  {
    name: "licence",
    canonicalStore: "future licence/billing service",
    compatibilityStores: ["enterprise mockData"],
    visibility: "admin_operational",
    ownerScoped: false,
    governanceRequired: true,
    notes: "Stripe/payment details must stay behind server-side billing services.",
  },
  {
    name: "background_job",
    canonicalStore: "future job queue",
    compatibilityStores: ["in-process disabled placeholders"],
    visibility: "system_only",
    ownerScoped: false,
    governanceRequired: true,
    notes: "Exports, campaigns, and audit persistence should enqueue jobs only after production governance checks pass.",
  },
];

export function getDomainEntityContract(name: DomainEntityName) {
  return DOMAIN_ENTITY_CONTRACTS.find((entity) => entity.name === name) ?? null;
}
