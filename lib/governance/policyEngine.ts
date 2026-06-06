import {
  canAccessAnyAdminArea,
  getPlatformRoleCapabilities,
  hasPlatformCapability,
  type PlatformCapability,
  type PlatformRole,
} from "../auth/platformRoles.ts";
import type { PeopleContactEntity } from "../contacts/contactRepository.ts";
import type { PeopleRelationship } from "../contacts/relationships.ts";
import type { AuditGovernanceMetadata, PlatformAuditEvent } from "../audit/auditEvents.ts";

export type GovernanceAction =
  | "view_consumer_record"
  | "manage_executor"
  | "view_enterprise_report"
  | "export_report"
  | "send_campaign"
  | "view_admin_route"
  | "manage_licence"
  | "view_prototype";

export type GovernanceDecisionReason =
  | "allowed"
  | "role_required"
  | "trusted_claim_required"
  | "consent_required"
  | "marketing_consent_required"
  | "export_disabled"
  | "workflow_blocked"
  | "organisation_restricted"
  | "prototype_isolated";

export type GovernanceDecision = {
  allowed: boolean;
  action: GovernanceAction;
  reason: GovernanceDecisionReason;
  requiredCapabilities: PlatformCapability[];
  capabilities: PlatformCapability[];
  restrictedState: {
    title: string;
    detail: string;
    status: 403 | 404 | 423;
  } | null;
  consentContext: {
    adviserInsights: boolean | null;
    marketing: boolean | null;
    inherited: boolean;
  };
  targetEntity: {
    type: string;
    id: string | null;
  };
  audit: Pick<PlatformAuditEvent, "action" | "result" | "resource"> & {
    policyDecision: GovernanceDecisionReason;
    governance: AuditGovernanceMetadata;
  };
};

export type GovernanceEvaluationInput = {
  action: GovernanceAction;
  roles: readonly PlatformRole[];
  trustedRoleClaims?: boolean;
  targetEntity?: { type: string; id?: string | null };
  consent?: { adviserInsights?: boolean | null; marketing?: boolean | null; inherited?: boolean };
  relationship?: PeopleRelationship | null;
  peopleContact?: PeopleContactEntity | null;
  organisationState?: "active" | "setup" | "suspended" | "expired" | "prototype" | "restricted";
  prototypeOnly?: boolean;
};

export const GOVERNANCE_ACTION_REQUIREMENTS: Record<GovernanceAction, PlatformCapability[]> = {
  view_consumer_record: ["consumer_app"],
  manage_executor: ["consumer_app", "executor_view"],
  view_enterprise_report: ["enterprise_reports"],
  export_report: ["enterprise_reports"],
  send_campaign: ["enterprise_reports"],
  view_admin_route: ["probate_operations", "enterprise_dashboard", "enterprise_licensing", "support_operations"],
  manage_licence: ["enterprise_licensing"],
  view_prototype: ["enterprise_dashboard", "probate_operations"],
};

export const governanceEngineReadiness = {
  currentMode: "shared_policy_decision_preview",
  futureAdapter: "server_side_policy_engine",
  rule: "Route guards, report visibility, exports, campaigns, organisation restrictions, and People relationships should evaluate through this decision structure before production enablement.",
  deniedStateRule: "Denied access returns explicit restricted-state metadata and an audit-compatible policy decision.",
} as const;

export function evaluateGovernanceAccess(input: GovernanceEvaluationInput): GovernanceDecision {
  const capabilities = getPlatformRoleCapabilities(input.roles);
  const requiredCapabilities = GOVERNANCE_ACTION_REQUIREMENTS[input.action];
  const targetEntity = {
    type: input.targetEntity?.type ?? "access_policy",
    id: input.targetEntity?.id ?? input.peopleContact?.id ?? null,
  };
  const consentContext = {
    adviserInsights: input.consent?.adviserInsights ?? null,
    marketing: input.consent?.marketing ?? null,
    inherited: input.consent?.inherited ?? input.relationship?.inheritedConsent ?? false,
  };

  const deny = (reason: GovernanceDecisionReason, detail: string, status: 403 | 404 | 423 = 403): GovernanceDecision => ({
    allowed: false,
    action: input.action,
    reason,
    requiredCapabilities,
    capabilities,
    restrictedState: {
      title: "Access restricted",
      detail,
      status,
    },
    consentContext,
    targetEntity,
    audit: {
      action: `Governance decision: ${input.action}`,
      result: reason === "prototype_isolated" ? "disabled" : "blocked",
      resource: { type: "access_policy", id: targetEntity.id, label: targetEntity.type },
      policyDecision: reason,
      governance: buildGovernanceMetadata(reason, consentContext, input.prototypeOnly),
    },
  });

  if (input.action === "view_admin_route" && !canAccessAnyAdminArea(input.roles)) {
    return deny("role_required", "Admin or enterprise capability is required for this route.");
  }

  if (input.action === "view_admin_route" && input.trustedRoleClaims === false && process.env.NODE_ENV === "production") {
    return deny("trusted_claim_required", "Production admin access requires trusted provider role claims.");
  }

  if (input.action === "export_report") {
    return deny("export_disabled", "Exports are disabled until audit persistence, consent checks, and permission review are live.", 423);
  }

  if (input.organisationState === "suspended" || input.organisationState === "expired" || input.organisationState === "restricted") {
    return deny("organisation_restricted", "Organisation access is restricted by licence or governance state.");
  }

  if (input.action === "view_enterprise_report" && consentContext.adviserInsights === false) {
    return deny("consent_required", "Adviser insight consent is required before insight details are shown.");
  }

  if (input.action === "send_campaign" && consentContext.marketing === false) {
    return deny("marketing_consent_required", "Marketing consent is required before outreach can be considered.", 423);
  }

  if (input.action === "send_campaign") {
    return deny("workflow_blocked", "Campaigns are disabled until consent enforcement and outreach approval are live.", 423);
  }

  const hasAnyRequiredCapability = requiredCapabilities.some((capability) => hasPlatformCapability(input.roles, capability));
  if (!hasAnyRequiredCapability && requiredCapabilities.length > 0) {
    return deny("role_required", "This action requires a role with the appropriate platform capability.");
  }

  return {
    allowed: true,
    action: input.action,
    reason: "allowed",
    requiredCapabilities,
    capabilities,
    restrictedState: null,
    consentContext,
    targetEntity,
    audit: {
      action: `Governance decision: ${input.action}`,
      result: "success",
      resource: { type: targetEntity.type as PlatformAuditEvent["resource"]["type"], id: targetEntity.id, label: targetEntity.type },
      policyDecision: "allowed",
      governance: buildGovernanceMetadata("allowed", consentContext, input.prototypeOnly),
    },
  };
}

function buildGovernanceMetadata(
  reason: GovernanceDecisionReason,
  consent: GovernanceDecision["consentContext"],
  prototypeOnly = false,
): AuditGovernanceMetadata {
  return {
    consentChecked: consent.adviserInsights !== null || consent.marketing !== null,
    adviserInsightConsent: consent.adviserInsights ?? undefined,
    marketingConsent: consent.marketing ?? undefined,
    exportEnabled: false,
    prototypeOnly,
    restrictedReason: reason === "allowed" ? undefined : reason,
    policyDecision: reason,
  };
}
