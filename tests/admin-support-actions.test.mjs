import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { availability, cleanReason, renderSignedOutEmail, runSupportAction, SUPPORT_ACTIONS } from "../lib/admin/supportActions.ts";

function client({ user, rpcError = null, authError = null } = {}) {
  const calls = [];
  return {
    calls,
    auth: {
      admin: { async getUserById() { return { data: { user }, error: user ? null : { message: "no" } }; } },
      async resend(args) { calls.push(["resend", args]); return { error: authError }; },
      async resetPasswordForEmail(email, opts) { calls.push(["reset", email, opts]); return { error: authError }; },
    },
    async rpc(name, args) { calls.push(["rpc", name, args]); return rpcError ? { data: null, error: rpcError } : { data: 2, error: null }; },
    from(table) { return { delete() { return { eq(k, v) { calls.push(["delete", table, k, v]); return Promise.resolve({ error: null }); } }; } }; },
  };
}
const real = { id: "u1", email: "person@gmail.com", email_confirmed_at: null };

test("only the three approved actions exist", () => {
  assert.deepEqual([...SUPPORT_ACTIONS], ["resend_confirmation", "password_reset", "sign_out_everywhere"]);
});

test("emails go only to the account's own real address; test addresses and confirmed emails are refused", async () => {
  assert.equal(availability("resend_confirmation", { ...real, email_confirmed_at: "2026-01-01" }).available, false);
  assert.equal(availability("password_reset", { email: "x@example.test" }).available, false);
  assert.equal(availability("sign_out_everywhere", { email: "x@example.test" }).available, true);
  const c = client({ user: real });
  const result = await runSupportAction(c, { userId: "u1", action: "password_reset" });
  assert.equal(result.ok, true);
  assert.deepEqual(c.calls[0].slice(0, 2), ["reset", "person@gmail.com"]);
  assert.match(c.calls[0][2].redirectTo, /\/reset-password$/);
});

test("sign out everywhere ends sessions and forgets remembered devices", async () => {
  const c = client({ user: { ...real, email: "x@example.test" } });
  const result = await runSupportAction(c, { userId: "u1", action: "sign_out_everywhere" });
  assert.equal(result.ok, true); assert.equal(result.sessionsEnded, 2); assert.equal(result.emailed, false);
  assert.deepEqual(c.calls[0], ["rpc", "lf_admin_sign_out_everywhere", { p_user_id: "u1" }]);
  assert.ok(c.calls.some((call) => call[0] === "delete" && call[1] === "trusted_devices"));
  const missing = await runSupportAction(client({ user: real, rpcError: { message: "Could not find the function public.lf_admin_sign_out_everywhere", code: "PGRST202" } }), { userId: "u1", action: "sign_out_everywhere" });
  assert.equal(missing.ok, false); assert.match(missing.message, /database update/);
});

test("hourly limit, and the email names nothing", async () => {
  const limited = await runSupportAction(client({ user: real }), { userId: "u1", action: "password_reset", recentCount: 3 });
  assert.equal(limited.ok, false); assert.equal(limited.status, 429);
  const email = renderSignedOutEmail("https://test.mylegacyfortress.com");
  assert.doesNotMatch(email.text, /@|record|document/i);
  assert.equal(cleanReason("  a\n b  ").length, 3);
});

test("route: support:manage + audit:write, reason required, audited with the reason; migration is service-role only", () => {
  const route = readFileSync(new URL("../app/api/internal/admin/users/[userId]/support-action/route.ts", import.meta.url), "utf8");
  assert.match(route, /\["support:manage", "audit:write"\]/);
  assert.match(route, /reason\.length < REASON_MIN/);
  assert.match(route, /metadata: \{\s*reason,/);
  // The migration ships in its own PR for owner approval; check it whenever it is present.
  let sql = "";
  try { sql = readFileSync(new URL("../supabase/migrations/20261120150000_admin_sign_out_everywhere.sql", import.meta.url), "utf8"); } catch { return; }
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.lf_admin_sign_out_everywhere\(uuid\) FROM anon, authenticated;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.lf_admin_sign_out_everywhere\(uuid\) TO service_role;/);
  assert.match(sql, /SET search_path = ''/);
});
