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
