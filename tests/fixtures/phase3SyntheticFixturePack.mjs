export const phase3SyntheticFixturePack = {
  version: "phase3-local-uat-2026-07-13",
  scope: "local-only",
  domains: ["legacyfortress.test", "example.invalid"],
  customerStates: [
    { key: "empty_owner", email: "phase3-empty-owner@legacyfortress.test", expected: { records: 0, invitations: 0, staleWill: false } },
    { key: "partial_owner", email: "phase3-partial-owner@legacyfortress.test", expected: { records: 6, invitations: 1, missingExecutor: true } },
    { key: "complete_owner", email: "phase3-complete-owner@legacyfortress.test", expected: { records: 18, invitations: 2, missingExecutor: false } },
    { key: "stale_will_owner", email: "phase3-stale-will-owner@legacyfortress.test", expected: { staleWill: true, willAgeYears: 6 } },
    { key: "pending_executor_owner", email: "phase3-pending-executor-owner@legacyfortress.test", expected: { invitations: 1, acceptedExecutor: false } },
    { key: "accepted_executor_owner", email: "phase3-accepted-executor-owner@legacyfortress.test", expected: { invitations: 1, acceptedExecutor: true } },
    { key: "document_rich_owner", email: "phase3-documents-owner@legacyfortress.test", expected: { documents: 9, failedUploads: 1 } },
  ],
  adminOperations: [
    { key: "failed_email", source: "invitation_events", expectedCount: 1 },
    { key: "pending_probate_review", source: "probate_cases", expectedCount: 1 },
    { key: "approved_probate_case", source: "probate_cases", expectedCount: 1 },
    { key: "rejected_probate_case", source: "probate_cases", expectedCount: 1 },
    { key: "revoked_access", source: "access_grants", expectedCount: 1 },
    { key: "support_issue", source: "support_cases", expectedCount: 1 },
    { key: "risk_flag", source: "derived_metrics", expectedCount: 1 },
    { key: "old_document", source: "documents", expectedCount: 1 },
    { key: "missing_profile_data", source: "user_profiles", expectedCount: 1 },
  ],
  enterpriseStates: [
    {
      key: "enterprise_alpha",
      organisation: "Phase 3 Alpha Benefits Ltd",
      adminEmail: "phase3-alpha-admin@legacyfortress.test",
      expected: { licensedSeats: 25, invitedUsers: 7, activatedUsers: 3 },
    },
    {
      key: "enterprise_beta",
      organisation: "Phase 3 Beta Care Co",
      adminEmail: "phase3-beta-admin@legacyfortress.test",
      expected: { licensedSeats: 10, invitedUsers: 4, activatedUsers: 1 },
    },
  ],
  deterministicMetrics: {
    totalSyntheticCustomers: 7,
    customerRecords: 24,
    pendingInvitations: 2,
    failedEmails: 1,
    pendingProbateReviews: 1,
    revokedAccessGrants: 1,
    enterpriseOrganisations: 2,
  },
};

export function assertPhase3FixturePackIsLocalOnly(pack = phase3SyntheticFixturePack) {
  const serialized = JSON.stringify(pack);
  if (/gmail\.com|me\.com|icloud\.com|hotmail\.com|outlook\.com/i.test(serialized)) {
    throw new Error("Phase 3 fixture pack contains a real consumer email domain.");
  }
  if (/https:\/\/|supabase\.co|vercel\.app|stripe/i.test(serialized)) {
    throw new Error("Phase 3 fixture pack contains hosted-service references.");
  }
  if (pack.scope !== "local-only") {
    throw new Error("Phase 3 fixture pack must be local-only.");
  }
}
