import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

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
  assert.doesNotMatch(service, /from\("account_access_grants"\)\.(insert|update|upsert|delete)/);
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
  assert.doesNotMatch(service, /from\("account_access_grants"\)\.(insert|update|upsert|delete)/);
  for (const areas of service.match(/AUTHORITY_AREAS[\s\S]*?\n};/g) ?? []) assert.doesNotMatch(areas, /"legal"/);
});

test("the nominee sees only the owner's name, kind and state", () => {
  const page = read("app/(app)/vault-nominations/page.tsx");
  const service = read("lib/vaultAccess/vaultAccess.ts");
  const loader = service.slice(service.indexOf("export async function loadMyNominations"));
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
