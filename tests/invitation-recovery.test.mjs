import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("expired invitation links provide recovery actions instead of a dead-end message", () => {
  const acceptPage = fs.readFileSync(path.join(root, "app/invite/accept/InvitationAcceptPageClient.tsx"), "utf8");

  assert.match(acceptPage, /linkProblem/);
  assert.match(acceptPage, /Invitation recovery options/);
  assert.match(acceptPage, /Ask the account holder to resend the invitation from Contacts/);
  assert.match(acceptPage, /temporary smoke-test invitation/);
  assert.match(acceptPage, /Go to sign in/);
  assert.match(acceptPage, /Create account/);
  assert.match(acceptPage, /Contact support/);
  assert.match(acceptPage, /getInvitationValidationMessage/);
});

test("authenticated bootstrap recovers actionable invitations without a return path", () => {
  const signIn = fs.readFileSync(path.join(root, "components/auth/SignInForm.tsx"), "utf8");
  const bootstrap = fs.readFileSync(path.join(root, "lib/auth/pendingInvitations.ts"), "utf8");
  const route = fs.readFileSync(path.join(root, "app/api/auth/pending-invitations/route.ts"), "utf8");

  assert.match(signIn, /findPendingInvitationDestination\(supabase, nextPath\)/);
  assert.match(signIn, /pendingDestination \?\? await resolvePermissionedAdminDestination/);
  assert.match(bootstrap, /if \(invitations\.length > 1\) return "\/pending-invitations"/);
  assert.match(route, /contact_email.*email\.trim\(\)\.toLowerCase\(\)/s);
  assert.match(route, /invitation_status.*ACTIONABLE_STATUSES/s);
  assert.match(route, /token_consumed_at/);
  assert.match(route, /revoked_at/);
  assert.match(route, /\.is\("accepted_user_id", null\)/);
});

test("invitation acceptance states are mutually exclusive and reject the wrong account", () => {
  const acceptPage = fs.readFileSync(path.join(root, "app/invite/accept/InvitationAcceptPageClient.tsx"), "utf8");

  assert.match(acceptPage, /summary && linkProblem === "none"/);
  assert.match(acceptPage, /wrongAccount/);
  assert.match(acceptPage, /Sign in with another account/);
  assert.match(acceptPage, /setSummary\(null\)/);
});
