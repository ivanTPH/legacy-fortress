import type { ApiRequestContext, ApiResult, DocumentAttachmentEntity, LicenceEntity, OrganisationEntity } from "./domainEntities.ts";
import type { PeopleContactEntity } from "../contacts/contactRepository.ts";
import type { PlatformAuditEvent } from "../audit/auditEvents.ts";
import { ROLE_PERMISSION_API_CONTRACTS } from "./rolePermissionContracts.ts";

export type ApiContractMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type ApiContractAuthMode = "public" | "authenticated" | "role_required" | "system_internal";

export type ApiContract = {
  id: string;
  route: string;
  method: ApiContractMethod;
  authMode: ApiContractAuthMode;
  requiredCapabilities: string[];
  requestEntity: string;
  responseEntity: string;
  auditCategory?: string;
  governance: {
    consentRequired: boolean;
    bandedOnly: boolean;
    exportDisabled: boolean;
  };
  futureAdapter: "supabase_rpc" | "rest_repository" | "stripe_server" | "auth_provider" | "queue_worker";
};

export type ContactsApi = {
  listContacts(context: ApiRequestContext, ownerUserId: string): Promise<ApiResult<PeopleContactEntity[]>>;
  saveContact(context: ApiRequestContext, contact: Partial<PeopleContactEntity>): Promise<ApiResult<PeopleContactEntity>>;
};

export type DocumentsApi = {
  listDocuments(context: ApiRequestContext, ownerUserId: string): Promise<ApiResult<DocumentAttachmentEntity[]>>;
  createSignedUpload(context: ApiRequestContext, file: Pick<DocumentAttachmentEntity, "fileName" | "mimeType" | "parentType" | "parentId">): Promise<ApiResult<{ uploadUrl: string; storagePath: string }>>;
};

export type EnterpriseApi = {
  listOrganisations(context: ApiRequestContext): Promise<ApiResult<OrganisationEntity[]>>;
  listLicences(context: ApiRequestContext, organisationId?: string | null): Promise<ApiResult<LicenceEntity[]>>;
};

export type AuditApi = {
  record(event: PlatformAuditEvent, context: ApiRequestContext): Promise<ApiResult<{ stored: boolean; eventId: string }>>;
};

export type PlatformApiContracts = {
  contacts: ContactsApi;
  documents: DocumentsApi;
  enterprise: EnterpriseApi;
  audit: AuditApi;
};

export const PLATFORM_API_CONTRACTS: ApiContract[] = [
  {
    id: "contacts.list",
    route: "/api/contacts",
    method: "GET",
    authMode: "authenticated",
    requiredCapabilities: ["consumer_app", "executor_view"],
    requestEntity: "ApiRequestContext",
    responseEntity: "PeopleContactEntity[]",
    auditCategory: "report_access",
    governance: { consentRequired: false, bandedOnly: false, exportDisabled: true },
    futureAdapter: "rest_repository",
  },
  {
    id: "documents.signed_upload",
    route: "/api/documents/upload",
    method: "POST",
    authMode: "authenticated",
    requiredCapabilities: ["consumer_app"],
    requestEntity: "DocumentUploadRequest",
    responseEntity: "SignedUploadIntent",
    auditCategory: "document_upload",
    governance: { consentRequired: false, bandedOnly: false, exportDisabled: true },
    futureAdapter: "supabase_rpc",
  },
  {
    id: "enterprise.reports",
    route: "/api/enterprise/reports",
    method: "GET",
    authMode: "role_required",
    requiredCapabilities: ["enterprise_reports"],
    requestEntity: "ReportFilters",
    responseEntity: "ConsentBandedReport",
    auditCategory: "report_access",
    governance: { consentRequired: true, bandedOnly: true, exportDisabled: true },
    futureAdapter: "rest_repository",
  },
  {
    id: "billing.portal",
    route: "/api/billing/portal",
    method: "POST",
    authMode: "authenticated",
    requiredCapabilities: ["consumer_app", "enterprise_licensing"],
    requestEntity: "BillingPortalRequest",
    responseEntity: "BillingPortalSession",
    auditCategory: "billing_licence_placeholder",
    governance: { consentRequired: false, bandedOnly: false, exportDisabled: true },
    futureAdapter: "stripe_server",
  },
  {
    id: "audit.record",
    route: "/api/audit/events",
    method: "POST",
    authMode: "system_internal",
    requiredCapabilities: ["support_operations"],
    requestEntity: "PlatformAuditEvent",
    responseEntity: "AuditWriteResult",
    auditCategory: "restricted_action_blocked",
    governance: { consentRequired: true, bandedOnly: false, exportDisabled: true },
    futureAdapter: "queue_worker",
  },
];

export const PLATFORM_ROLE_PERMISSION_API_CONTRACTS = ROLE_PERMISSION_API_CONTRACTS;

export function getApiContract(id: string) {
  return PLATFORM_API_CONTRACTS.find((contract) => contract.id === id) ?? null;
}

export function listApiContractsForCapability(capability: string) {
  return PLATFORM_API_CONTRACTS.filter((contract) => contract.requiredCapabilities.includes(capability));
}
