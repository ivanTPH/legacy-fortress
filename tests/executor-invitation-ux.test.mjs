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
  assert.match(manager, /Save for later/);
  assert.match(manager, /Send invitation/);
  assert.match(manager, /RecentInvitationCard/);
  assert.match(manager, /Add another person/);
  assert.match(manager, /View status/);
});

test("executor access choices are explicit checkboxes with progressive detail", () => {
  assert.match(manager, /type="checkbox" checked=\{checked\}/);
  assert.match(manager, /Select all categories/);
  assert.match(manager, /indeterminate/);
  assert.match(manager, /Clear all/);
  assert.match(manager, /<summary>Record-level permissions \(optional\)<\/summary>/);
  assert.match(manager, /Selected categories are normally view-only/);
  assert.match(manager, /Phone number[\s\S]*optional/);
  assert.match(manager, /Information this person may eventually be able to VIEW|Information this Executor may eventually access/);
  assert.match(manager, /View only/);
});

test("executor role selection uses the canonical role catalog without duplicating the person", () => {
  assert.match(manager, /<select aria-label="Choose a role"/);
  assert.match(manager, /roleOptions\.map/);
  assert.match(manager, /getRoleDescription/);
  assert.match(manager, /initialRole/);
});

test("executor creation hides the legacy editor while guided mode is active", () => {
  assert.match(contacts, /addContactGroupKey === "executors" \? null :/);
  assert.match(contacts, /!addContactGroupKey \? <section style=\{panelStyle\}/);
  assert.match(contacts, /!loading && !addContactGroupKey/);
  assert.match(manager, /!isDashboardMode && guidedExecutor && !editingId && !draftContactId/);
  assert.match(manager, /!isDashboardMode && !guidedExecutor \? \(\s*<div style=\{sectionBlockStyle\}/);
  const guidedStart = manager.indexOf("function GuidedExecutorFlow");
  const guidedEnd = manager.indexOf("function RecentInvitationCard");
  assert.ok(guidedStart >= 0 && guidedEnd > guidedStart);
  const guidedSource = manager.slice(guidedStart, guidedEnd);
  assert.doesNotMatch(guidedSource, /My wallet - all|Owner notes|Linked records and document permissions/);
  assert.match(manager, /only one canonical interaction|Invitation sent/);
  assert.match(manager, /setRecentInvitation/);
  assert.match(manager, /Invitation dispatch attempted/);
  assert.match(manager, /Invitation prepared/);
  assert.match(manager, /window\.setTimeout\(onViewStatus, 2500\)/);
  assert.match(manager, /if \(sent\) \{\s*clearInvitationForm\(\)/);
});

test("post-send state does not immediately re-render the Person step", () => {
  assert.match(manager, /recentInvitation \? \(\s*<RecentInvitationCard/);
  assert.match(manager, /onAddAnother=\{\(\) => \{/);
  assert.match(manager, /setRecentInvitation\(null\)/);
  assert.match(manager, /onViewStatus=\{\(\) => router\.push/);
});

test("save and dispatch remain separate canonical operations with truthful status", () => {
  assert.match(manager, /Invitation prepared — ready to send/);
  assert.match(manager, /sendContactInvite\(supabase/);
  assert.match(manager, /if \(sent\) \{\s*clearInvitationForm\(\)/);
  assert.match(manager, /Invitation email \$\{resend \? "resent" : "sent"\}/);
});

test("executor invitation copy preserves role, identity and authority boundaries", () => {
  assert.match(manager, /does not itself create legal authority/);
  assert.match(manager, /They complete identity verification/);
  assert.match(manager, /does not establish legal authority or guarantee access/);
});
