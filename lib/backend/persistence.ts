import type { SupabaseClient } from "@supabase/supabase-js";
import type { DomainEntityName, DomainRepository } from "./domainEntities.ts";
import { buildPeopleContactEntity, createPeopleContactRepository, type PeopleContactEntity } from "../contacts/contactRepository.ts";

type AnySupabaseClient = SupabaseClient;

export type PersistenceAdapterMode = "mock_static" | "supabase_client" | "api_repository" | "disabled";

export type PersistenceAdapterDescriptor = {
  entity: DomainEntityName;
  mode: PersistenceAdapterMode;
  canonicalStore: string;
  compatibilityStores: string[];
  futureAdapter: "api_repository" | "supabase_rpc" | "background_worker";
  notes: string;
};

export const PERSISTENCE_ADAPTERS: PersistenceAdapterDescriptor[] = [
  {
    entity: "people_contact",
    mode: "supabase_client",
    canonicalStore: "contacts/contact_links/contact_invitations",
    compatibilityStores: ["record_contacts", "role_assignments", "account_access_grants"],
    futureAdapter: "api_repository",
    notes: "People/Contacts already has a repository wrapper and keeps compatibility projections isolated.",
  },
  {
    entity: "document",
    mode: "supabase_client",
    canonicalStore: "asset_documents + vault-docs storage",
    compatibilityStores: ["record_attachments"],
    futureAdapter: "supabase_rpc",
    notes: "Document metadata and signed storage actions should remain behind shared document helpers and AttachmentGallery.",
  },
  {
    entity: "organisation",
    mode: "mock_static",
    canonicalStore: "future organisations API",
    compatibilityStores: ["components/admin/prototype/mockData"],
    futureAdapter: "api_repository",
    notes: "Enterprise organisation data is intentionally mock/static until backend provisioning exists.",
  },
  {
    entity: "audit_event",
    mode: "disabled",
    canonicalStore: "future append-only audit_events",
    compatibilityStores: ["prototype preview events"],
    futureAdapter: "background_worker",
    notes: "Audit preview data must not be treated as persisted compliance evidence.",
  },
];

export type PlatformRepositoryRegistry = {
  peopleContacts(client: AnySupabaseClient): Pick<DomainRepository<PeopleContactEntity>, "entity" | "list" | "get" | "create" | "update" | "remove">;
};

export function createPlatformRepositoryRegistry(): PlatformRepositoryRegistry {
  return {
    peopleContacts(client) {
      const repository = createPeopleContactRepository(client);
      return {
        entity: "people_contact",
        list({ ownerUserId }) {
          return repository.list(String(ownerUserId ?? ""));
        },
        async get(id, { ownerUserId }) {
          const rows = await repository.getByIds(String(ownerUserId ?? ""), [id]);
          return rows[0] ?? null;
        },
        async create(input, { context }) {
          const row = await repository.upsert({
            ownerUserId: input.id ? context.principal?.userId ?? "" : context.principal?.userId ?? "",
            fullName: input.full_name ?? "Contact",
            email: input.email ?? null,
            phone: input.phone ?? null,
            contactRole: input.contact_role ?? null,
            relationship: input.relationship ?? null,
            sourceType: input.source_type ?? "manual",
            inviteStatus: input.invite_status ?? "not_invited",
            verificationStatus: input.verification_status ?? "not_verified",
          });
          return buildPeopleContactEntity(row);
        },
        async update(id, input, { context }) {
          const row = await repository.upsert({
            ownerUserId: context.principal?.userId ?? "",
            existingContactId: id,
            fullName: input.full_name ?? "Contact",
            email: input.email ?? null,
            phone: input.phone ?? null,
            contactRole: input.contact_role ?? null,
            relationship: input.relationship ?? null,
            sourceType: input.source_type ?? "manual",
            inviteStatus: input.invite_status ?? "not_invited",
            verificationStatus: input.verification_status ?? "not_verified",
          });
          return buildPeopleContactEntity(row);
        },
        remove(id, { context }) {
          return repository.delete({ ownerUserId: context.principal?.userId ?? "", contactId: id }).then(() => ({ removed: true }));
        },
      };
    },
  };
}

export function getPersistenceAdapter(entity: DomainEntityName) {
  return PERSISTENCE_ADAPTERS.find((adapter) => adapter.entity === entity) ?? null;
}
