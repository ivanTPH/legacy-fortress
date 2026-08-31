import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manager = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/ContactInvitationManager.tsx"), "utf8");
const contacts = fs.readFileSync(path.join(root, "components/contacts/ContactsNetworkWorkspace.tsx"), "utf8");

test("executor contacts use a guided person, role, access and review flow", () => {
  assert.match(contacts, /guidedExecutor=\{addContactGroupKey === "executors"\}/);
  assert.match(manager, /guidedExecutor\?: boolean/);
  assert.match(manager, /Invite an Executor/);
  assert.match(manager, /Invitation steps/);
  assert.match(manager, /Review and send/);
  assert.match(manager, /Save and send later/);
  assert.match(manager, /Send invitation/);
});

test("executor access choices are explicit checkboxes with progressive detail", () => {
  assert.match(manager, /Information this Executor may eventually access/);
  assert.match(manager, /type="checkbox" checked=\{checked\}/);
  assert.match(manager, /<summary>Customize access<\/summary>/);
  assert.match(manager, /edit access is never granted automatically/);
  assert.match(manager, /Phone number[\s\S]*optional/);
});

test("save and dispatch remain separate canonical operations with truthful status", () => {
  assert.match(manager, /Invitation prepared — ready to send/);
  assert.match(manager, /sendContactInvite\(supabase/);
  assert.match(manager, /if \(sent\) \{[\s\S]*resetEditor\(\)/);
  assert.match(manager, /Invitation email \$\{resend \? "resent" : "sent"\}/);
});

test("executor invitation copy preserves role, identity and authority boundaries", () => {
  assert.match(manager, /does not itself create legal authority/);
  assert.match(manager, /Identity verification will be required before protected access can be considered/);
  assert.match(manager, /does not establish legal authority or guarantee access/);
});
