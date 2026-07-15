export const phase4aSyntheticFixturePack = {
  version: "phase4a-local-uat-2026-07-13",
  scope: "local-only",
  baseUrl: "http://127.0.0.1:3012",
  supabaseTargetCategory: "local-only",
  domains: ["legacyfortress.test", "example.invalid"],
  customerStates: [
    {
      key: "empty_customer",
      email: "phase4a-empty-customer@legacyfortress.test",
      expected: {
        propertyRecords: 0,
        businessRecords: 0,
        digitalRecords: 0,
        possessionRecords: 0,
      },
    },
    {
      key: "populated_customer",
      email: "phase4a-populated-customer@legacyfortress.test",
      expected: {
        propertyRecords: 1,
        businessRecords: 1,
        digitalRecords: 2,
        possessionRecords: 2,
      },
    },
    {
      key: "mixed_customer",
      email: "phase4a-mixed-customer@legacyfortress.test",
      expected: {
        propertyRecords: 0,
        businessRecords: 1,
        digitalRecords: 0,
        possessionRecords: 1,
      },
    },
    {
      key: "isolation_customer",
      email: "phase4a-isolation-customer@legacyfortress.test",
      expected: {
        recordsVisibleToOtherCustomers: 0,
      },
    },
  ],
  selectedRoutes: ["/property", "/business", "/vault/digital", "/vault/personal"],
  excludedRoutes: ["/finances", "/legal", "/employment", "/cars-transport", "/contacts", "/access-requests", "/support"],
  privacyRules: [
    "dashboard_overview_counts_only",
    "no_document_body_or_filename_summary",
    "no_contact_email_or_phone_summary",
    "no_account_number_summary",
    "owner_scoped_canonical_reads_only",
  ],
};

export function assertPhase4aFixturePackIsLocalOnly(pack = phase4aSyntheticFixturePack) {
  const serialized = JSON.stringify(pack);
  if (/gmail\.com|me\.com|icloud\.com|hotmail\.com|outlook\.com/i.test(serialized)) {
    throw new Error("Phase 4A fixture pack contains a real consumer email domain.");
  }
  if (/https:\/\/|supabase\.co|vercel\.app|stripe/i.test(serialized)) {
    throw new Error("Phase 4A fixture pack contains hosted-service references.");
  }
  if (pack.scope !== "local-only" || pack.supabaseTargetCategory !== "local-only") {
    throw new Error("Phase 4A fixture pack must be local-only.");
  }
}
