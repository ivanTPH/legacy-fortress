import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("Phase 4 migration adds saved views, report runs, exports and risk overrides securely", () => {
  const migration = read("supabase/migrations/20260724163000_enterprise_analytics_reporting_phase4.sql");

  for (const table of [
    "enterprise_report_runs",
    "enterprise_export_events",
    "enterprise_risk_overrides",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  }

  for (const column of [
    "description",
    "sort_config",
    "visible_columns",
    "last_used_at",
    "is_default",
    "share_scope",
  ]) {
    assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
  }

  assert.match(migration, /minimum_cohort integer NOT NULL DEFAULT 5/);
  assert.match(migration, /enterprise_export_events_format_check CHECK \(export_format IN \('csv'\)\)/);
  assert.match(migration, /enterprise_saved_views_share_scope_check/);
  assert.match(migration, /public\.is_active_enterprise_operator\(\)/);
  assert.doesNotMatch(migration, /USING\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(migration, /section_entries|documents|attachments|assets|records/);
});

test("Phase 4 service implements governed reports, saved-view lifecycle and CSV safety", () => {
  const service = read("lib/admin/enterpriseOperations.ts");

  for (const symbol of [
    "ENTERPRISE_REPORT_TYPES",
    "ENTERPRISE_FILTER_KEYS",
    "buildEnterpriseReportExportDecision",
    "saveEnterpriseView",
    "updateEnterpriseView",
    "deleteEnterpriseView",
    "buildEnterpriseReportCatalogue",
    "buildEnterpriseRiskSummaries",
    "sanitizeEnterpriseFilters",
    "csvSafeCell",
    "safeExportFilename",
  ]) {
    assert.match(service, new RegExp(symbol));
  }

  assert.match(service, /enterprise_report_runs/);
  assert.match(service, /enterprise_export_events/);
  assert.match(service, /minimumCohort/);
  assert.match(service, /Results are suppressed because this cohort is below the minimum reporting threshold/);
  assert.match(service, /\^\[=\+\\-@\]/);
  assert.match(service, /privateVaultFieldsExcluded: true/);
  assert.doesNotMatch(service, /\.from\("assets"\)|\.from\("documents"\)|\.from\("attachments"\)|\.from\("records"\)|\.from\("section_entries"\)/);
});

test("Phase 4 enterprise API exposes saved-view lifecycle and governed export audit metadata", () => {
  const route = read("app/api/internal/admin/enterprise/route.ts");

  for (const action of [
    "save_view",
    "update_view",
    "delete_view",
    "export_report",
  ]) {
    assert.match(route, new RegExp(action));
  }

  assert.match(route, /Enterprise saved view updated/);
  assert.match(route, /Enterprise saved view deleted/);
  assert.match(route, /report_run_id/);
  assert.match(route, /export_event_id/);
  assert.match(route, /document_content_excluded/);
  assert.match(route, /financial_values_excluded/);
});

test("Phase 4 UI has operational analytics filters, saved views, reports and campaign-safe treatment", () => {
  const workspace = read("components/enterprise/EnterpriseOperationsWorkspace.tsx");

  for (const text of [
    "Low adoption",
    "At-risk organisations",
    "Membership",
    "Organisation role",
    "Date range",
    "Synthetic/UAT",
    "Saved enterprise views",
    "Reset to default",
    "Request governed export",
    "Minimum cohort",
    "Consent and compliance",
    "Private vault records, uploaded documents, legal contents, individual financial values",
  ]) {
    assert.match(workspace, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(workspace, /setFilters\(card\.filters\)/);
  assert.match(workspace, /coerceSavedFilters/);
  assert.match(workspace, /portfolio\.reports\.map/);
  assert.doesNotMatch(workspace, /Campaigns|Static mock data|Prototype session|Northbridge|Harrington|Ledger House|Whitestone/);
});
