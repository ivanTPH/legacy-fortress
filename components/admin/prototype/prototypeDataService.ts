import {
  adminCases,
  adminUsers,
  auditEvents,
  getLicenceSeatMetrics,
  licencePlans,
  organisationClients,
  organisations,
  type LicencePlan,
  type LicencePlanTier,
} from "./mockData";
import { buildAuditPreviewEvents, buildConsentGovernanceSummary } from "./complianceGovernance";
import {
  buildClientInsights,
  buildClientOpportunityScores,
  buildReportMetrics,
  filterOrganisationClients,
  getActiveFilterChips,
  getConsentBlockedCount,
  getReportableClients,
  type ReportFilters,
} from "./reportInsights";
import { canIncludeInOutreachAudience } from "./complianceGovernance";
import { getRoleManagementData } from "./roleManagementService.ts";

export type VerificationQueueGroup = {
  title: string;
  icon: string;
  detail: string;
  rows: typeof adminCases;
};

export type OperationalTimelineEvent = {
  id: string;
  label: string;
  detail: string;
  time: string;
  tone: "default" | "success" | "warning" | "danger";
};

export type EnterpriseCommandCentreData = ReturnType<typeof getEnterpriseCommandCentreData>;
export type AdminOverviewData = ReturnType<typeof getAdminOverviewData>;
export type CaseListData = ReturnType<typeof getCaseListData>;
export type UserDirectoryData = ReturnType<typeof getUserDirectoryData>;
export type LicenceManagementData = ReturnType<typeof getLicenceManagementData>;
export type ReportPrototypeData = ReturnType<typeof getReportPrototypeData>;
export type CampaignPrototypeData = ReturnType<typeof getCampaignPrototypeData>;
export type RoleManagementData = ReturnType<typeof getRoleManagementData>;

export type PrototypeDataAdapter = {
  getAdminOverviewData: typeof getAdminOverviewData;
  getCaseListData: typeof getCaseListData;
  getUserDirectoryData: typeof getUserDirectoryData;
  getEnterpriseCommandCentreData: typeof getEnterpriseCommandCentreData;
  getVerificationQueueData: typeof getVerificationQueueData;
  getLicenceManagementData: typeof getLicenceManagementData;
  getReportPrototypeData: typeof getReportPrototypeData;
  getCampaignPrototypeData: typeof getCampaignPrototypeData;
  getRoleManagementData: typeof getRoleManagementData;
};

export const prototypeDataServiceBoundary = {
  currentAdapter: "static_mock_data",
  futureAdapter: "api_backed_repository",
  rule: "UI pages should request shaped prototype data from this service boundary instead of deriving business state directly from mockData.",
  mustNotDoYet: [
    "No live API calls",
    "No server mutations",
    "No unrestricted exports",
    "No billing, campaign, or outreach enablement",
  ],
} as const;

export function getAdminOverviewData() {
  const awaitingReview = adminCases.filter((item) => item.status === "Pending" || item.status === "Under Review").length;
  const unlockPending = adminCases.filter((item) => item.status === "Access Unlock Pending").length;
  return {
    openCases: adminCases.filter((item) => item.status !== "Closed").length,
    awaitingReview,
    unlockPending,
    usersInReview: adminUsers.filter((item) => item.vaultStatus !== "Active").length,
    priorityCases: adminCases.slice(0, 3),
    recentAuditEvents: auditEvents.slice(0, 3),
    operationalTimeline: buildOperationalTimeline("admin_overview"),
  };
}

export function getCaseListData() {
  const lifecycleCounts = adminCases.reduce<Record<string, number>>((acc, item) => {
    acc[item.lifecycleStage] = (acc[item.lifecycleStage] ?? 0) + 1;
    return acc;
  }, {});
  return {
    cases: adminCases,
    statusCounts: {
      pendingReview: adminCases.filter((item) => item.status === "Pending").length,
      underReview: adminCases.filter((item) => item.status === "Under Review").length,
      unlockPending: adminCases.filter((item) => item.status === "Access Unlock Pending").length,
    },
    lifecycleCounts,
    urgentCases: adminCases.filter((item) => item.priority === "Urgent" || item.priority === "High").length,
    executorRestrictedCases: adminCases.filter((item) => item.executorStatus === "Restricted").length,
    operationalTimeline: buildOperationalTimeline("probate_cases"),
    filters: ["All statuses", "Pending", "Under Review", "Access Unlock Pending", "Closed"],
  };
}

export function getUserDirectoryData() {
  return {
    users: adminUsers,
    nonActiveUsers: adminUsers.filter((item) => item.vaultStatus !== "Active").length,
    totalDocuments: adminUsers.reduce((sum, user) => sum + user.documents, 0),
    totalRecords: adminUsers.reduce((sum, user) => sum + user.records, 0),
  };
}

export function getEnterpriseCommandCentreData() {
  const licenceMetrics = getLicenceSeatMetrics();
  const reportableClients = organisationClients.filter((client) => client.consent.adviserInsights);
  const insightConsentedClients = reportableClients.length;
  const consentGatedClients = organisationClients.length - insightConsentedClients;
  const opportunityScores = buildClientOpportunityScores(organisationClients);
  const opportunityMetrics = buildReportMetrics(organisationClients);
  const complianceGovernance = buildConsentGovernanceSummary(organisationClients, "enterprise_dashboard");
  const reviewDueClients = reportableClients.filter((client) => /overdue|now/i.test(client.nextReviewDue)).length;
  const missingExecutorClients = reportableClients.filter((client) => !client.executorAppointed).length;
  const outdatedWillClients = reportableClients.filter((client) => client.willStatus === "Review needed").length;
  const pendingSetupTasks = organisations.reduce((sum, org) => sum + org.pendingInvitations, 0);
  const organisationHealth = {
    healthy: organisations.filter((org) => org.healthState === "Healthy").length,
    watch: organisations.filter((org) => org.healthState === "Watch").length,
    atRisk: organisations.filter((org) => org.healthState === "At risk").length,
    restricted: organisations.filter((org) => org.healthState === "Restricted").length,
  };
  const rolloutStates = {
    ready: organisations.filter((org) => org.onboardingState === "Ready").length,
    inRollout: organisations.filter((org) => org.onboardingState === "In rollout").length,
    needsSetup: organisations.filter((org) => org.onboardingState === "Needs setup").length,
    restricted: organisations.filter((org) => org.onboardingState === "Restricted").length,
  };

  return {
    licenceMetrics,
    totalSeats: licenceMetrics.includedSeats,
    seatsUsed: licenceMetrics.usedSeats,
    seatsAvailable: licenceMetrics.seatsAvailable,
    activeLicences: licenceMetrics.activeLicences,
    renewalWarnings: licenceMetrics.renewalsDueSoon,
    totalLicensedOrganisations: licencePlans.length,
    pendingSetupTasks,
    insightConsentedClients,
    consentGatedClients,
    opportunityScores,
    opportunityMetrics,
    complianceGovernance,
    auditPreviewEvents: buildAuditPreviewEvents("enterprise_dashboard"),
    reviewDueClients,
    missingExecutorClients,
    outdatedWillClients,
    organisationHealth,
    rolloutStates,
    organisations,
    recentActivity: buildOperationalTimeline("enterprise_dashboard"),
  };
}

export function getVerificationQueueData() {
  const groups: VerificationQueueGroup[] = [
    {
      title: "Pending evidence review",
      icon: "upload_file",
      detail: `${countByStatus("Pending")} certificate or evidence item(s) waiting for first review.`,
      rows: adminCases.filter((item) => item.status === "Pending"),
    },
    {
      title: "Under review",
      icon: "rule",
      detail: `${countByStatus("Under Review")} case(s) currently being checked by a reviewer.`,
      rows: adminCases.filter((item) => item.status === "Under Review"),
    },
    {
      title: "Approved, unlock pending",
      icon: "lock_open",
      detail: `${countByStatus("Access Unlock Pending")} approved case(s) waiting for controlled access handling.`,
      rows: adminCases.filter((item) => item.status === "Access Unlock Pending"),
    },
  ];

  return {
    workflowSteps: [
      "Executor submits certificate",
      "Reviewer checks evidence",
      "Approve / reject",
      "Access unlock queued",
    ],
    groups,
    lifecycleCounts: adminCases.reduce<Record<string, number>>((acc, item) => {
      acc[item.lifecycleStage] = (acc[item.lifecycleStage] ?? 0) + 1;
      return acc;
    }, {}),
    operationalTimeline: buildOperationalTimeline("verification_queue"),
  };
}

export function getLicenceManagementData(orgId: string | null) {
  const selectedOrganisation = orgId ? organisations.find((org) => org.id === orgId) ?? null : null;
  const scopedPlans = orgId && !selectedOrganisation
    ? []
    : selectedOrganisation
      ? licencePlans.filter((plan) => plan.organisationId === selectedOrganisation.id)
      : licencePlans;
  const metrics = getLicenceSeatMetrics();
  const plansByTier = countPlansByTier(licencePlans);
  const expiringRenewals = licencePlans.filter((plan) => isRenewalWarning(plan));
  const seatWarnings = licencePlans.filter((plan) => plan.includedSeats > 0 && plan.usedSeats / plan.includedSeats >= 0.75);

  return {
    selectedOrganisation,
    scopedPlans,
    metrics,
    plansByTier,
    expiringRenewals,
    seatWarnings,
    totalLicencePlans: licencePlans.length,
    organisations,
    billingDisabledReason: "Prototype only — billing not connected",
  };
}

export function getReportPrototypeData(filters: ReportFilters, surface: "reports" | "client_insights") {
  const orgId = filters.orgId;
  const selectedOrganisation = orgId ? organisations.find((org) => org.id === orgId) ?? null : null;
  const invalidOrganisationFilter = Boolean(orgId && !selectedOrganisation);
  const organisationScopedClients = selectedOrganisation
    ? organisationClients.filter((client) => client.organisationId === selectedOrganisation.id)
    : orgId
      ? []
      : organisationClients;
  const filteredClients = invalidOrganisationFilter
    ? []
    : filterOrganisationClients(organisationScopedClients, filters);
  const reportableClients = getReportableClients(filteredClients);
  const consentBlocked = getConsentBlockedCount(filteredClients);
  const insights = buildClientInsights(filteredClients);
  const opportunityScores = buildClientOpportunityScores(filteredClients);
  const reportMetrics = buildReportMetrics(filteredClients, insights, consentBlocked);

  return {
    selectedOrganisation,
    invalidOrganisationFilter,
    organisationScopedClients,
    filteredClients,
    reportableClients,
    consentBlocked,
    insights,
    opportunityScores,
    reportMetrics,
    governance: buildConsentGovernanceSummary(filteredClients, surface),
    auditPreviewEvents: buildAuditPreviewEvents(surface),
    operationalTimeline: buildOperationalTimeline(surface),
    activeChips: getActiveFilterChips(filters, selectedOrganisation?.name),
    organisations,
  };
}

export function getCampaignPrototypeData() {
  const eligibleClients = organisationClients.filter(canIncludeInOutreachAudience);
  const excludedByConsent = organisationClients.length - eligibleClients.length;
  const eligibleInsights = buildClientInsights(eligibleClients);
  const eligibleMetrics = buildReportMetrics(eligibleClients, eligibleInsights, getConsentBlockedCount(eligibleClients));
  const audience = {
    reviewDue: eligibleInsights.filter((insight) => insight.insightType === "review_due").length,
    willUpdate: eligibleInsights.filter((insight) => insight.insightType === "will_outdated").length,
    executorMissing: eligibleInsights.filter((insight) => insight.insightType === "missing_executor").length,
    incompleteVault: eligibleInsights.filter((insight) => insight.insightType === "incomplete_vault").length,
  };

  return {
    eligibleClients,
    excludedByConsent,
    eligibleMetrics,
    audience,
    governance: buildConsentGovernanceSummary(organisationClients, "campaigns"),
    auditPreviewEvents: buildAuditPreviewEvents("campaigns"),
    disabledReason: "Disabled — requires consent enforcement and outreach approval",
  };
}

export function buildOperationalTimeline(surface: string): OperationalTimelineEvent[] {
  const base: OperationalTimelineEvent[] = [
    {
      id: `${surface}-audit-blocked-export`,
      label: "Export attempt blocked",
      detail: "Governance controls kept report export disabled until audit persistence and permissions are production-ready.",
      time: "Today, 09:40",
      tone: "warning",
    },
    {
      id: `${surface}-consent-refresh`,
      label: "Consent readiness checked",
      detail: "Insight details were generated only for clients with adviser insight consent.",
      time: "Today, 09:12",
      tone: "success",
    },
    {
      id: `${surface}-licence-review`,
      label: "Licence renewal review opened",
      detail: "One pilot organisation is flagged for renewal and rollout setup review.",
      time: "Yesterday, 16:20",
      tone: "default",
    },
    {
      id: `${surface}-probate-unlock`,
      label: "Executor access unlock queued",
      detail: "Approved probate verification is waiting for a final manual audit check.",
      time: "29 Apr, 16:05",
      tone: "warning",
    },
  ];

  if (surface === "verification_queue" || surface === "probate_cases") {
    return [
      {
        id: `${surface}-evidence-received`,
        label: "Evidence received",
        detail: "Executor certificate evidence entered manual triage.",
        time: "Today, 10:18",
        tone: "default",
      },
      {
        id: `${surface}-manual-review`,
        label: "Manual review in progress",
        detail: "Reviewer is checking certificate details before a controlled access decision.",
        time: "Today, 13:42",
        tone: "warning",
      },
      {
        id: `${surface}-decision-recorded`,
        label: "Decision recorded",
        detail: "Approved verification remains audit-gated until access unlock is completed.",
        time: "29 Apr, 16:05",
        tone: "success",
      },
    ];
  }

  return base;
}

export function countPlansByTier(plans: LicencePlan[]): Record<LicencePlanTier, number> {
  return plans.reduce<Record<LicencePlanTier, number>>(
    (acc, plan) => {
      acc[plan.planTier] += 1;
      return acc;
    },
    { Starter: 0, Professional: 0, Enterprise: 0 },
  );
}

export function isRenewalWarning(plan: LicencePlan) {
  return plan.billingStatus === "Renewal due" || plan.licenceStatus === "Review" || plan.licenceStatus === "Pending";
}

function countByStatus(status: (typeof adminCases)[number]["status"]) {
  return adminCases.filter((item) => item.status === status).length;
}
