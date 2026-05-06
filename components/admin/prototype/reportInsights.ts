import type { OrganisationClient } from "./mockData";

export type ReportFilterValue = string | undefined;

export type ReportFilters = {
  orgId?: ReportFilterValue;
  willAge?: ReportFilterValue;
  estateValue?: ReportFilterValue;
  possessionsValue?: ReportFilterValue;
  reviewStatus?: ReportFilterValue;
  executorStatus?: ReportFilterValue;
  adviserStatus?: ReportFilterValue;
  consentStatus?: ReportFilterValue;
  vaultCompleteness?: ReportFilterValue;
  opportunityLevel?: ReportFilterValue;
  outreachReady?: ReportFilterValue;
  consentBlocked?: ReportFilterValue;
};

export type ClientInsightType =
  | "missing_executor"
  | "will_outdated"
  | "review_due"
  | "incomplete_vault"
  | "no_adviser"
  | "consent_missing";

export type ClientInsightSeverity = "critical" | "high" | "medium";

export type ClientInsight = {
  clientId: string;
  insightType: ClientInsightType;
  severity: ClientInsightSeverity;
  message: string;
};

export type ClientOpportunityReason =
  | "review_due"
  | "will_outdated"
  | "missing_executor"
  | "incomplete_vault"
  | "no_adviser_assigned"
  | "high_value_band"
  | "consent_missing";

export type ClientOpportunityScoreLevel = "blocked" | "low" | "medium" | "high";

export type ClientOpportunityScore = {
  clientId: string;
  scoreLevel: ClientOpportunityScoreLevel;
  reasons: ClientOpportunityReason[];
  blockers: string[];
  outreachReady: boolean;
  recommendedNextStep: string;
};

const REVIEW_REFERENCE_DATE = new Date("2026-05-02T00:00:00.000Z");

export const reportFilterDefinitions = [
  {
    key: "willAge",
    label: "Will age",
    options: [
      { value: "lt3", label: "< 3 years" },
      { value: "3to5", label: "3-5 years" },
      { value: "5plus", label: "5+ years" },
    ],
  },
  {
    key: "estateValue",
    label: "Estate value band",
    options: [
      { value: "under250", label: "< £250k" },
      { value: "250to1m", label: "£250k-£1m" },
      { value: "1mplus", label: "£1m+" },
    ],
  },
  {
    key: "possessionsValue",
    label: "Possessions value band",
    options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
  },
  {
    key: "reviewStatus",
    label: "Review status",
    options: [
      { value: "due", label: "Due" },
      { value: "not_due", label: "Not due" },
    ],
  },
  {
    key: "executorStatus",
    label: "Executor status",
    options: [
      { value: "assigned", label: "Assigned" },
      { value: "missing", label: "Missing" },
    ],
  },
  {
    key: "adviserStatus",
    label: "Adviser status",
    options: [
      { value: "assigned", label: "Assigned" },
      { value: "unassigned", label: "Unassigned" },
    ],
  },
  {
    key: "consentStatus",
    label: "Consent status",
    options: [
      { value: "allowed", label: "Allowed" },
      { value: "not_allowed", label: "Not allowed" },
    ],
  },
  {
    key: "vaultCompleteness",
    label: "Vault completeness",
    options: [
      { value: "complete", label: "Complete" },
      { value: "incomplete", label: "Incomplete" },
    ],
  },
  {
    key: "opportunityLevel",
    label: "Opportunity level",
    options: [
      { value: "high", label: "High" },
      { value: "medium", label: "Medium" },
      { value: "low", label: "Low" },
      { value: "blocked", label: "Blocked" },
    ],
  },
  {
    key: "outreachReady",
    label: "Outreach readiness",
    options: [
      { value: "ready", label: "Ready" },
      { value: "not_ready", label: "Not ready" },
    ],
  },
  {
    key: "consentBlocked",
    label: "Consent blocked",
    options: [
      { value: "yes", label: "Blocked by consent" },
      { value: "no", label: "Not blocked" },
    ],
  },
] as const;

export function filterOrganisationClients(clients: OrganisationClient[], filters: ReportFilters) {
  return clients.filter((client) => {
    const opportunity = buildClientOpportunityScore(client);
    if (filters.willAge && getWillAgeBucket(client) !== filters.willAge) return false;
    if (filters.estateValue && getEstateValueBucket(client) !== filters.estateValue) return false;
    if (filters.possessionsValue && getPossessionsValueBucket(client) !== filters.possessionsValue) return false;
    if (filters.reviewStatus && getReviewStatusBucket(client) !== filters.reviewStatus) return false;
    if (filters.executorStatus && getExecutorStatusBucket(client) !== filters.executorStatus) return false;
    if (filters.adviserStatus && getAdviserStatusBucket(client) !== filters.adviserStatus) return false;
    if (filters.consentStatus && getConsentStatusBucket(client) !== filters.consentStatus) return false;
    if (filters.vaultCompleteness && getVaultCompletenessBucket(client) !== filters.vaultCompleteness) return false;
    if (filters.opportunityLevel && opportunity.scoreLevel !== filters.opportunityLevel) return false;
    if (filters.outreachReady && getOutreachReadyBucket(opportunity) !== filters.outreachReady) return false;
    if (filters.consentBlocked && getConsentBlockedBucket(client) !== filters.consentBlocked) return false;
    return true;
  });
}

export function getReportableClients(clients: OrganisationClient[]) {
  return clients.filter((client) => hasAdviserInsightConsent(client));
}

export function getConsentBlockedCount(clients: OrganisationClient[]) {
  return clients.filter((client) => !hasAdviserInsightConsent(client)).length;
}

export function buildClientInsights(clients: OrganisationClient[]): ClientInsight[] {
  return clients.flatMap((client) => {
    if (!hasAdviserInsightConsent(client)) {
      return [
        {
          clientId: client.id,
          insightType: "consent_missing" as const,
          severity: "medium" as const,
          message: "Client has not granted adviser insight access",
        },
      ];
    }

    const insights: ClientInsight[] = [];

    if (!client.executorAppointed) {
      insights.push({
        clientId: client.id,
        insightType: "missing_executor",
        severity: "critical",
        message: "Executor not recorded",
      });
    }

    if (isWillOutdated(client) || client.willStatus === "Missing") {
      insights.push({
        clientId: client.id,
        insightType: "will_outdated",
        severity: client.willStatus === "Missing" ? "critical" : "high",
        message: client.willStatus === "Missing" ? "Will not uploaded" : "Will may need review",
      });
    }

    if (isReviewDue(client)) {
      insights.push({
        clientId: client.id,
        insightType: "review_due",
        severity: "high",
        message: "Review is due",
      });
    }

    if (client.vaultCompletion < 70) {
      insights.push({
        clientId: client.id,
        insightType: "incomplete_vault",
        severity: "medium",
        message: "Vault completion is below 70%",
      });
    }

    if (!client.adviserAppointed) {
      insights.push({
        clientId: client.id,
        insightType: "no_adviser",
        severity: "medium",
        message: "No professional adviser recorded",
      });
    }

    if (!hasMarketingConsent(client)) {
      insights.push({
        clientId: client.id,
        insightType: "consent_missing",
        severity: "medium",
        message: "Outreach consent not available",
      });
    }

    return insights;
  });
}

export function buildReportMetrics(clients: OrganisationClient[], insights = buildClientInsights(clients), consentBlocked = getConsentBlockedCount(clients)) {
  const reportableClients = getReportableClients(clients);
  const opportunityScores = buildClientOpportunityScores(clients);
  return {
    clientsInScope: clients.length,
    consentBlocked,
    adviserInsightConsent: reportableClients.length,
    marketingPermission: reportableClients.filter((client) => hasMarketingConsent(client)).length,
    reviewDue: insights.filter((insight) => insight.insightType === "review_due").length,
    executorMissing: insights.filter((insight) => insight.insightType === "missing_executor").length,
    willOutdated: insights.filter((insight) => insight.insightType === "will_outdated").length,
    adviserMissing: insights.filter((insight) => insight.insightType === "no_adviser").length,
    incompleteVaults: insights.filter((insight) => insight.insightType === "incomplete_vault").length,
    consentMissing: clients.filter((client) => !hasAdviserInsightConsent(client)).length,
    criticalInsights: insights.filter((insight) => insight.severity === "critical").length,
    highInsights: insights.filter((insight) => insight.severity === "high").length,
    mediumInsights: insights.filter((insight) => insight.severity === "medium").length,
    reviewOpportunities: reportableClients.filter((client) => isWillOutdated(client) && hasMarketingConsent(client)).length,
    highOpportunity: opportunityScores.filter((score) => score.scoreLevel === "high").length,
    mediumOpportunity: opportunityScores.filter((score) => score.scoreLevel === "medium").length,
    blockedOpportunity: opportunityScores.filter((score) => score.scoreLevel === "blocked").length,
    outreachReady: opportunityScores.filter((score) => score.outreachReady).length,
  };
}

export function buildClientOpportunityScores(clients: OrganisationClient[]) {
  return clients.map((client) => buildClientOpportunityScore(client));
}

export function buildClientOpportunityScore(client: OrganisationClient): ClientOpportunityScore {
  if (!hasAdviserInsightConsent(client)) {
    return {
      clientId: client.id,
      scoreLevel: "blocked",
      reasons: ["consent_missing"],
      blockers: ["Adviser insight consent required"],
      outreachReady: false,
      recommendedNextStep: "Consent required before adviser insight",
    };
  }

  const reasons: ClientOpportunityReason[] = [];
  const blockers: string[] = [];

  if (isReviewDue(client)) reasons.push("review_due");
  if (isWillOutdated(client) || client.willStatus === "Missing") reasons.push("will_outdated");
  if (!client.executorAppointed) reasons.push("missing_executor");
  if (client.vaultCompletion < 70) reasons.push("incomplete_vault");
  if (!client.adviserAppointed) reasons.push("no_adviser_assigned");
  if (isHighValueBand(client)) reasons.push("high_value_band");
  if (!hasMarketingConsent(client)) blockers.push("Marketing permission required");

  const scoreLevel = getOpportunityScoreLevel(reasons);

  return {
    clientId: client.id,
    scoreLevel,
    reasons,
    blockers,
    outreachReady: scoreLevel !== "blocked" && hasMarketingConsent(client),
    recommendedNextStep: getOpportunityNextStep(reasons, blockers),
  };
}

export function getClientOpportunityScore(client: OrganisationClient, scores: ClientOpportunityScore[]) {
  return scores.find((score) => score.clientId === client.id) ?? buildClientOpportunityScore(client);
}

export function getActiveFilterChips(filters: ReportFilters, organisationName?: string) {
  const chips: Array<{ key: keyof ReportFilters; label: string }> = [];

  if (filters.orgId && organisationName) {
    chips.push({ key: "orgId", label: `Organisation: ${organisationName}` });
  }

  for (const definition of reportFilterDefinitions) {
    const value = filters[definition.key];
    const option = definition.options.find((item) => item.value === value);
    if (option) chips.push({ key: definition.key, label: `${definition.label}: ${option.label}` });
  }

  return chips;
}

export function getClientInsightSummary(client: OrganisationClient, insights: ClientInsight[]) {
  if (!hasAdviserInsightConsent(client)) return "Consent required";
  return insights
    .filter((insight) => insight.clientId === client.id)
    .map((insight) => insight.message)
    .join(", ") || "No report signal";
}

function getWillAgeBucket(client: OrganisationClient) {
  const years = getWillAgeYears(client);
  if (years === null) return "5plus";
  if (years < 3) return "lt3";
  if (years <= 5) return "3to5";
  return "5plus";
}

function getEstateValueBucket(client: OrganisationClient) {
  if (/^under|<\s*£?250/i.test(client.estateValueBand)) return "under250";
  if (/250k|500k|£500k–£1m/i.test(client.estateValueBand)) return "250to1m";
  return "1mplus";
}

function getPossessionsValueBucket(client: OrganisationClient) {
  if (/under|<|low/i.test(client.possessionsValueBand)) return "low";
  if (/25k–£75k/i.test(client.possessionsValueBand)) return "medium";
  return "high";
}

function getReviewStatusBucket(client: OrganisationClient) {
  return isReviewDue(client) ? "due" : "not_due";
}

function getExecutorStatusBucket(client: OrganisationClient) {
  return client.executorAppointed ? "assigned" : "missing";
}

function getAdviserStatusBucket(client: OrganisationClient) {
  return client.adviserAppointed ? "assigned" : "unassigned";
}

function getConsentStatusBucket(client: OrganisationClient) {
  return hasAdviserInsightConsent(client) ? "allowed" : "not_allowed";
}

function getVaultCompletenessBucket(client: OrganisationClient) {
  return client.vaultCompletion >= 70 ? "complete" : "incomplete";
}

function getOutreachReadyBucket(score: ClientOpportunityScore) {
  return score.outreachReady ? "ready" : "not_ready";
}

function getConsentBlockedBucket(client: OrganisationClient) {
  return hasAdviserInsightConsent(client) ? "no" : "yes";
}

function getOpportunityScoreLevel(reasons: ClientOpportunityReason[]): ClientOpportunityScoreLevel {
  const reasonWeight = reasons.reduce((sum, reason) => {
    if (reason === "review_due" || reason === "will_outdated" || reason === "missing_executor" || reason === "high_value_band") return sum + 2;
    return sum + 1;
  }, 0);
  if (reasonWeight >= 5 || (reasons.includes("high_value_band") && (reasons.includes("review_due") || reasons.includes("will_outdated")))) return "high";
  if (reasonWeight >= 2) return "medium";
  return "low";
}

function getOpportunityNextStep(reasons: ClientOpportunityReason[], blockers: string[]) {
  if (blockers.includes("Marketing permission required")) return "Marketing permission required";
  if (reasons.includes("review_due")) return "Review recommended";
  if (reasons.includes("missing_executor")) return "Executor information missing";
  if (reasons.includes("will_outdated")) return "Will review recommended";
  if (reasons.includes("incomplete_vault")) return "Vault completion review recommended";
  if (reasons.includes("no_adviser_assigned")) return "Adviser assignment review recommended";
  return "No immediate planning action";
}

function isHighValueBand(client: OrganisationClient) {
  return getEstateValueBucket(client) === "1mplus" || getPossessionsValueBucket(client) === "high";
}

function isWillOutdated(client: OrganisationClient) {
  const years = getWillAgeYears(client);
  return years === null || years >= 5 || client.willStatus === "Review needed";
}

function getWillAgeYears(client: OrganisationClient) {
  const match = client.willAge.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function isReviewDue(client: OrganisationClient) {
  if (/overdue|now/i.test(client.nextReviewDue)) return true;
  const timestamp = Date.parse(client.nextReviewDue);
  if (Number.isNaN(timestamp)) return false;
  return timestamp <= REVIEW_REFERENCE_DATE.getTime();
}

function hasAdviserInsightConsent(client: OrganisationClient) {
  return client.consent.adviserInsights === true;
}

function hasMarketingConsent(client: OrganisationClient) {
  return client.consent.adviserInsights === true && client.consent.marketing === true;
}
