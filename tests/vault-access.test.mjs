import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// The browser service may change only a grant's end date (owner sharing). It never creates,
// widens or deletes a grant; stopping goes through lf_stop_vault_access.
function assertOnlyEndDateGrantWrites(service) {
  const writes = [...service.matchAll(/from\("account_access_grants"\)\.(insert|update|upsert|delete)\((\{[^}]*\})/g)];
  assert.equal(writes.length, 1);
  assert.equal(writes[0][1], "update");
  assert.match(writes[0][2], /^\{ ends_at: endsAt, updated_at: new Date\(\)\.toISOString\(\) \}$/);
}

test("the Vault access migration never creates or changes access", () => {
  const sql = read("supabase/migrations/20261030200000_vault_access_foundation.sql");
  assert.doesNotMatch(sql, /INSERT INTO public\.account_access_grants/i);
  assert.doesNotMatch(sql, /UPDATE public\.account_access_grants/i);
  assert.doesNotMatch(sql, /CREATE OR REPLACE FUNCTION public\.(can_|has_|lf_can|lf_has)/i);
  assert.match(sql, /release_condition = 'death_release_and_probate'/);
  assert.match(sql, /Nominations are released only by an approved estate release/);
  assert.match(sql, /Areas can only be narrowed/);
  assert.match(sql, /authority_type <> 'lpa_health_welfare' OR usable_when = 'lacks_capacity_only'/);
  assert.match(sql, /AND \(n\.notify_person OR n\.status = 'released'\)/);
});

test("nominees learn only kind and state, never scope or records", () => {
  const sql = read("supabase/migrations/20261030200000_vault_access_foundation.sql");
  const fn = sql.slice(sql.indexOf("CREATE FUNCTION public.my_vault_nomination_status"));
  assert.match(fn, /RETURNS TABLE \(owner_display_name text, kind text, status text\)/);
  assert.doesNotMatch(fn.slice(0, fn.indexOf("GRANT EXECUTE")), /vault_nomination_records|scope|record_id/);
});

test("the Vault access screen says Access now: none and saves through the one-step RPC", () => {
  const ui = read("components/people-access/VaultAccessWorkspace.tsx");
  const service = read("lib/vaultAccess/vaultAccess.ts");
  assert.match(ui, /Access now: none\./);
  assert.match(ui, /grant of probate is confirmed/);
  assert.match(service, /rpc\("lf_save_vault_nomination"/);
  assertOnlyEndDateGrantWrites(service);
  assert.match(read("components/people-access/PeopleAccessWorkspace.tsx"), /view=vault-access/);
});

test("recording a Power of Attorney gives no access and can only narrow", () => {
  const ui = read("components/people-access/VaultAccessWorkspace.tsx");
  const service = read("lib/vaultAccess/vaultAccess.ts");
  const dialog = ui.slice(ui.indexOf("function AttorneyDialog"));
  assert.match(dialog, /Access now: none\./);
  assert.match(service, /scope_areas: input\.areas\.filter\(\(area\) => allowed\.includes\(area\)\)/);
  assert.match(service, /input\.authorityType === "lpa_health_welfare" \? "lacks_capacity_only"/);
  const record = service.slice(service.indexOf("export async function recordLegalAuthority"), service.indexOf("export async function withdrawLegalAuthority"));
  assert.doesNotMatch(record, /status:/);
  assertOnlyEndDateGrantWrites(service);
  for (const areas of service.match(/AUTHORITY_AREAS[\s\S]*?\n};/g) ?? []) assert.doesNotMatch(areas, /"legal"/);
});

test("the nominee sees only the owner's name, kind and state", () => {
  const page = read("app/(app)/vault-nominations/page.tsx");
  const service = read("lib/vaultAccess/vaultAccess.ts");
  const start = service.indexOf("export async function loadMyNominations");
  const loader = service.slice(start, service.indexOf("\n}\n", start));
  assert.match(loader, /rpc\("my_vault_nomination_status"\)/);
  assert.doesNotMatch(loader, /from\(/);
  assert.doesNotMatch(page, /from\(|vault_nomination_records|scope|includeCount|exceptionCount/);
  assert.match(page, /can’t see anything/);
  const switcher = read("components/navigation/WorkspaceSwitcher.tsx");
  assert.match(switcher, /Locked until release/);
  assert.match(switcher, /Partner and Admin never appear here/);
});

test("only the review team can activate an authority, and activation stays inside its areas", () => {
  const sql = read("supabase/migrations/20261031120000_legal_authority_activation.sql");
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.lf_activate_legal_authority\(uuid, uuid\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.lf_activate_legal_authority\(uuid, uuid\) TO service_role/);
  assert.match(sql, /IF auth\.uid\(\) IS NOT NULL THEN\s+RAISE EXCEPTION 'Authorities are activated by the review team'/);
  assert.match(sql, /IF v_auth\.status <> 'confirmed'/);
  assert.match(sql, /lf_identity_assurance_level\(v_linked\) < 2/);
  assert.match(sql, /lf_vault_lifecycle_state\(v_auth\.owner_user_id\) <> 'OWNER_ACTIVE'/);
  assert.match(sql, /COALESCE\(p_section, ''\) <> 'legal'/);
  assert.match(sql, /current_user IN \('anon', 'authenticated'\)/);
  // Existing access functions are not redefined.
  assert.doesNotMatch(sql, /FUNCTION public\.(linked_grant_allows|lf_linked_grant_satisfies_identity|has_linked_account_access)/);
  const route = read("app/api/internal/admin/legal-authorities/[authorityId]/actions/route.ts");
  assert.match(route, /requireAdminAccess/);
  assert.match(route, /verification:decide/);
  assert.match(route, /Add decision notes/);
  const service = read("lib/admin/legalAuthorities.ts");
  assert.match(service, /rpc\("lf_activate_legal_authority"/);
  assert.doesNotMatch(service, /from\("account_access_grants"\)/);
});

test("sharing now can end on a date, stop at once, and is written to Record history", () => {
  const sql = read("supabase/migrations/20261031150000_vault_access_history_and_end_dates.sql");
  // The identity gate only gains narrowing conditions.
  const gate = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.lf_linked_grant_satisfies_identity"), sql.indexOf("$$;"));
  assert.match(gate, /activation_status = ANY\(ARRAY\['verified','active'\]\)/);
  assert.match(gate, /lf_identity_assurance_level\(p_grant\.linked_user_id\) >= COALESCE\(p_grant\.required_identity_level, 2\)/);
  assert.match(gate, /lf_vault_lifecycle_state\(p_grant\.owner_user_id\) = 'OWNER_ACTIVE'/);
  assert.match(gate, /p_grant\.paused_at IS NULL/);
  assert.match(gate, /p_grant\.ends_at IS NULL OR p_grant\.ends_at > timezone\('utc', now\(\)\)/);
  // Stop is invoker (RLS applies) and owner-made sharing only.
  assert.match(sql, /lf_stop_vault_access[\s\S]*SECURITY INVOKER[\s\S]*source = 'owner_grant'/);
  // History is owner-only and carries no titles.
  const history = sql.slice(sql.indexOf("CREATE FUNCTION public.my_vault_access_history"));
  assert.match(history, /c\.owner_user_id = me\.uid/);
  assert.doesNotMatch(history, /title|file_name|display_title/);
  const ui = read("components/people-access/VaultAccessWorkspace.tsx");
  assert.match(ui, /This happens straight away/);
  assert.match(ui, /Note for your Record history/);
  assert.match(ui, /Record history/);
});

test("asking early or reporting a death never shares anything", () => {
  const sql = read("supabase/migrations/20261031170000_nominee_requests_and_release_state.sql");
  assert.match(sql, /REVOKE INSERT, DELETE ON public\.vault_early_access_requests FROM authenticated/);
  assert.doesNotMatch(sql, /INSERT INTO public\.account_access_grants/);
  assert.doesNotMatch(sql, /UPDATE public\.account_access_grants/);
  const status = sql.slice(sql.indexOf("CREATE FUNCTION public.my_vault_nomination_status"), sql.indexOf("REVOKE ALL ON FUNCTION public.my_vault_nomination_status"));
  assert.doesNotMatch(status, /vault_nomination_records|scope|record_id|asset/);
  assert.match(status, /AND \(n\.notify_person OR n\.status = 'released'\)/);
  const route = read("app/api/estate/death-reports/route.ts");
  assert.match(route, /eq\("notify_person", true\)/);
  assert.match(route, /accepted_user_id", userId/);
  const page = read("app/(app)/vault-nominations/page.tsx");
  assert.match(page, /Asking doesn’t give you access/);
  const report = read("app/estate/report-death/EstateDeathReportPageClient.tsx");
  assert.doesNotMatch(report, /Account owner user ID/);
  assert.match(report, /doesn’t give me access/);
  const panel = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
  assert.match(panel, /asked for access now/);
  assert.match(panel, /status: "Required"/);
});

test("estate release waits for probate, releases only verified nominees, and only the review team can run it", () => {
  const sql = read("supabase/migrations/20261031190000_estate_release_nominations.sql");
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.lf_release_vault_nominations\(uuid, uuid, uuid\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /IF auth\.uid\(\) IS NOT NULL THEN\s+RAISE EXCEPTION 'Releases are approved by the review team'/);
  assert.match(sql, /IF v_state <> 'ESTATE_LOCKED'/);
  assert.match(sql, /e\.evidence_type = 'probate_grant'/);
  assert.match(sql, /pc\.status = 'approved'/);
  assert.match(sql, /lf_identity_assurance_level\(v_linked\) < 2/);
  assert.match(sql, /x\.mode = 'exclude'/);
  // Gate: estate-release grants only after the estate is locked; others only while the owner is active.
  assert.match(sql, /WHEN p_grant\.source = 'estate_release'\s+THEN public\.lf_vault_lifecycle_state\(p_grant\.owner_user_id\) = 'ESTATE_LOCKED'\s+ELSE public\.lf_vault_lifecycle_state\(p_grant\.owner_user_id\) = 'OWNER_ACTIVE' END/);
  const route = read("app/api/internal/admin/probate-cases/[caseId]/release/route.ts");
  assert.match(route, /verification:decide/);
  assert.match(route, /Add decision notes before releasing/);
});
