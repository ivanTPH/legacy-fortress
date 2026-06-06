import type { CanonicalContactContext } from "./canonicalContacts.ts";
import type { PeopleContactRelationshipType } from "./contactRepository.ts";

export type PeopleRelationshipKind =
  | "executor_assignment"
  | "organisation_membership"
  | "trust_delegation"
  | "probate_linkage"
  | "reporting_visibility"
  | "consent_inheritance";

export type PeopleRelationshipPolicy = {
  kind: PeopleRelationshipKind;
  relationshipType: PeopleContactRelationshipType;
  requiredConsent: "none" | "adviser_insights" | "marketing" | "explicit_delegation";
  requiredVerification: "not_verified_allowed" | "invited_or_better" | "verified_only";
  permissionScope: string;
  auditCategory: "executor_invitation" | "admin_review" | "report_access" | "consent_grant";
  restrictedReason: string;
};

export type PeopleRelationship = PeopleRelationshipPolicy & {
  contactId: string;
  linkedContext: CanonicalContactContext[];
  inheritedConsent: boolean;
};

export const PEOPLE_RELATIONSHIP_POLICIES: PeopleRelationshipPolicy[] = [
  {
    kind: "executor_assignment",
    relationshipType: "executor",
    requiredConsent: "explicit_delegation",
    requiredVerification: "invited_or_better",
    permissionScope: "executor_access",
    auditCategory: "executor_invitation",
    restrictedReason: "Executor access requires invitation state, verification state, and explicit shared scope.",
  },
  {
    kind: "organisation_membership",
    relationshipType: "organisation_user",
    requiredConsent: "none",
    requiredVerification: "verified_only",
    permissionScope: "organisation_admin",
    auditCategory: "admin_review",
    restrictedReason: "Organisation membership requires verified role claims before operational access.",
  },
  {
    kind: "trust_delegation",
    relationshipType: "trusted_contact",
    requiredConsent: "explicit_delegation",
    requiredVerification: "invited_or_better",
    permissionScope: "consumer_record",
    auditCategory: "executor_invitation",
    restrictedReason: "Trusted-contact delegation requires explicit shared record scope.",
  },
  {
    kind: "probate_linkage",
    relationshipType: "probate_contact",
    requiredConsent: "none",
    requiredVerification: "verified_only",
    permissionScope: "probate_operations",
    auditCategory: "admin_review",
    restrictedReason: "Probate-linked parties remain operational-only and must not grant consumer vault visibility.",
  },
  {
    kind: "reporting_visibility",
    relationshipType: "enterprise_contact",
    requiredConsent: "adviser_insights",
    requiredVerification: "verified_only",
    permissionScope: "enterprise_reporting",
    auditCategory: "report_access",
    restrictedReason: "Reporting visibility requires consent-cleared, banded enterprise scope.",
  },
  {
    kind: "consent_inheritance",
    relationshipType: "adviser",
    requiredConsent: "adviser_insights",
    requiredVerification: "verified_only",
    permissionScope: "enterprise_reporting",
    auditCategory: "consent_grant",
    restrictedReason: "Consent inheritance requires explicit client consent and verified adviser relationship.",
  },
];

export function getPeopleRelationshipPolicy(kind: PeopleRelationshipKind) {
  return PEOPLE_RELATIONSHIP_POLICIES.find((policy) => policy.kind === kind) ?? null;
}

export function inferPeopleRelationshipKind(relationshipType: PeopleContactRelationshipType): PeopleRelationshipKind {
  if (relationshipType === "executor") return "executor_assignment";
  if (relationshipType === "organisation_user") return "organisation_membership";
  if (relationshipType === "trusted_contact" || relationshipType === "next_of_kin") return "trust_delegation";
  if (relationshipType === "probate_contact") return "probate_linkage";
  if (relationshipType === "enterprise_contact") return "reporting_visibility";
  if (relationshipType === "adviser") return "consent_inheritance";
  return "trust_delegation";
}

export function buildPeopleRelationship({
  contactId,
  relationshipType,
  linkedContext,
  inheritedConsent = false,
}: {
  contactId: string;
  relationshipType: PeopleContactRelationshipType;
  linkedContext: CanonicalContactContext[];
  inheritedConsent?: boolean;
}): PeopleRelationship {
  const kind = inferPeopleRelationshipKind(relationshipType);
  const policy = getPeopleRelationshipPolicy(kind) ?? PEOPLE_RELATIONSHIP_POLICIES[0];
  return {
    ...policy,
    contactId,
    relationshipType,
    linkedContext,
    inheritedConsent,
  };
}
