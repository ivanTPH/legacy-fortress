import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const panel = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
const updates = read("lib/notifications/inboxUpdates.ts");
const css = read("app/v3-screens.css");

test("Inbox, Mail style: categories All / Needs you / Waiting / Updates; badge-like subtitle (owner, 11 Nov 2026)", () => {
  assert.match(panel, /\[\["all", "All", "inbox"\], \["needs", "Needs you", "priority_high"\], \["waiting", "Waiting", "hourglass_top"\], \["update", "Updates", "notifications"\], \["archived", "Archived", "archive"\]\]/);
  assert.match(panel, /\{needs\} \{needs === 1 \? "needs" : "need"\} you · \{newCount\} new/);
  assert.match(css, /\.lf-inbox-category\.is-needs\[aria-pressed="true"\]/);
});

test("one tap goes straight to the thing; only your own tasks, the Will question and the executor/attorney decisions open first", () => {
  assert.match(panel, /const opensFirst = ownTask \|\| Boolean\(guidance && NAMED_PEOPLE_STEPS\[String\(guidance\.key\)\]\)\n        \|\| \(guidance\?\.key === "will"/);
  assert.match(panel, /if \(opensFirst\) setOpened\(key\); else onAction\(row\.actionKey\);/);
  assert.match(panel, /open: \(\) => \{ markRead\(ids\); window\.location\.assign\(latest\.href\); \}/);
  // A tap on your own task never ticks it off; Mark as done is its own button.
  assert.match(panel, /openedRow\.actionKey\.startsWith\("task:complete:"\) \? \(\s*<button type="button" className="lf-inbox-primary" onClick=\{\(\) => \{ onAction\(openedRow\.actionKey\); setOpened\(null\); say\("Marked as done"\); \}\}>Mark as done/);
});

test("swipes like Mail, with visible buttons for everything; long swipe left only where Done is safe", () => {
  const swipe = read("components/inbox/SwipeRow.tsx");
  assert.match(swipe, /if \(disabled \|\| event\.pointerType !== "touch"\) return;/, "a mouse gets the hover buttons instead");
  assert.match(swipe, /moved < -from\.width \* LONG && onLongLeft/);
  assert.match(panel, /onLongLeft=\{entry\.finish \? \(\) => finishEntries\(\[entry\.key\]\) : undefined\}/);
  assert.match(panel, /className="lf-inbox-hover"/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{ \.lf-inbox-row:hover \.lf-inbox-hover/);
  // Items that need a decision have no quick finish: Select skips them and says so.
  assert.match(panel, /need\$\{skipped === 1 \? "s" : ""\} opening/);
});

test("Later brings an item back as new on the chosen date, synced through the person's own rows", () => {
  assert.match(panel, /chosen\.forEach\(\(entry\) => setRead\(entry, false\)\); \/\/ comes back as new/);
  assert.match(panel, />Tomorrow morning</); assert.match(panel, />Next week</); assert.match(panel, /<span>Pick a date<\/span>/);
  assert.match(updates, /export const LATER_PREFIX = "later:";/);
  assert.match(updates, /from\("inbox_reads"\)\.insert\(itemKeys\.map\(\(item_key\) => \(\{ user_id: userId, item_key, read_at: iso \}\)\)\)/);
  assert.match(updates, /\.filter\(\(key\) => !key\.startsWith\(LATER_PREFIX\)\)/, "Later rows are not read marks");
});

test("repeats of the same update show once with a count; clearing clears them all, with Undo", () => {
  assert.match(panel, /grouped\.set\(update\.title, list\)/);
  assert.match(panel, /finish: \{ label: "Clear", run: \(\) => clear\(ids\),.*undo: \(\) => restore\(ids\) \}/);
});

test("what's been read follows the person across devices, through their own rows only", () => {
  const migration = read("supabase/migrations/20261110220000_inbox_reads.sql");
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  for (const action of ["select", "insert", "delete"]) assert.match(migration, new RegExp(`inbox_reads_own_${action} .*auth\\.uid\\(\\)`));
  assert.match(updates, /if \(error\) return local;/);
  assert.match(updates, /await flushPending\(userId\);\n    const \{ data, error \} = await supabase\.from\("inbox_reads"\)\.select/);
  assert.doesNotMatch(updates, /\.update\(/);
  for (const match of updates.matchAll(/from\("([a-z_]+)"\)\.(delete|upsert|insert)\(/g)) assert.equal(match[1], "inbox_reads");
});

test("the bell is gone; Inbox replaces To do in the menus; old Notifications links open Inbox Updates", () => {
  assert.doesNotMatch(read("app/(app)/layout.tsx"), /<NotificationBell/);
  assert.match(read("app/(app)/layout.tsx"), /\["\/actions", "Inbox", "inbox"\]/);
  assert.match(read("app/(app)/notifications/page.tsx"), /router\.replace\("\/actions\?filter=updates"\)/);
});

test("executors and attorneys are decided in the Inbox, using the record page's own services (owner, 11 Nov 2026)", () => {
  const panelFile = read("components/inbox/NamedPeoplePanel.tsx");
  assert.match(panel, /review_executors: "will", invite_executors: "will", remind_executors: "will"/);
  assert.match(panelFile, /reviewLinkedPersonSuggestion\(supabase, \{\s*ownerUserId, suggestionId: person\.suggestionId, decision: "confirm", choice: "new"/);
  assert.match(panelFile, /sendRecordLinkedPersonInvitation\(supabase, \{ ownerUserId, recordType: person\.recordType/);
  // A Will rarely has an email: inviting needs one, and says so.
  assert.match(panelFile, /Needed to invite them\. We didn’t find one in your \{docName\}\./);
  assert.match(panelFile, /if \(sendInvite && !email\) \{ setError\("Add an email address to invite them, or choose Add without inviting\."\); return; \}/);
  // Orange ✓ Sent, green ✓ Accepted, in the same place.
  assert.match(panelFile, /<span className="lf-named-tick is-accepted">✓ Accepted<\/span>/);
  assert.match(panelFile, /<span className="lf-named-tick is-sent">✓ Sent<\/span>/);
  assert.match(css, /\.lf-named-tick\.is-sent \{ color: var\(--lf-inbox-needs/);
  // Never shares anything: the invite service sends an empty permissions override.
  assert.match(read("lib/linkedPeople/recordLinkedPeople.ts"), /permissionsOverride: \{ asset_ids: \[\], record_ids: \[\]/);
  assert.match(panelFile, /Accepting it doesn’t let them see anything\./);
});

test("the Inbox badge and 'N need you' use one rule: must-do items, not suggestions or Later", async () => {
  const { readFileSync } = await import("node:fs");
  const panel = readFileSync(new URL("../app/(app)/components/dashboard/ActionQueuePanel.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/(app)/dashboard/page.tsx", import.meta.url), "utf8");
  assert.match(panel, /const needs = entries\.filter\(\(entry\) => entry\.kind === "needs" && !entry\.suggested\)/);
  assert.match(panel, /publishNeedsYouCountForCurrentUser\(needs\)/);
  assert.match(panel, /later\.has\(`action:\$\{row\.actionKey\}`\)/);
  assert.match(page, /loading \|\| actionCentreOnly \|\|/);
  assert.doesNotMatch(panel, /"User created"|"System generated"/);
});

test("the executors panel never sits on Loading for ever", () => {
  const src = fs.readFileSync(new URL("../components/inbox/NamedPeoplePanel.tsx", import.meta.url), "utf8");
  assert.match(src, /waitForActiveUser\(supabase/);
  assert.match(src, /Promise\.race\(/);
  assert.match(src, />Try again</);
  assert.doesNotMatch(src, /supabase\.auth\.getUser\(\)\.then/);
});

test("a routine sign-in refresh doesn't close what's open in the Inbox", () => {
  const layout = read("app/(app)/layout.tsx");
  assert.match(layout, /setViewerAccess\(\(current\) => sameViewerAccess\(current, nextViewer\) \? current : nextViewer\)/);
  const page = read("app/(app)/dashboard/page.tsx");
  assert.match(page, /\{loading && !loadedOnce \? <div className="lf-todo-loading"/);
});

test("swipes: one action per side, message slides over, off while selecting (owner, 11 Nov 2026)", () => {
  const panel = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
  const right = panel.slice(panel.indexOf("const rightButtons"), panel.indexOf("const pickedEntries"));
  assert.match(right, /is-read/);
  assert.doesNotMatch(right, /Later/);
  const left = panel.slice(panel.indexOf("const leftButtons"), panel.indexOf("const rightButtons"));
  assert.match(left, /Later/);
  assert.doesNotMatch(left, /is-read/);
  assert.match(panel, /disabled=\{selecting\}/);
  assert.match(panel, /onLongRight=\{\(\) => setRead\(entry, entry\.isNew\)\}/);
  const css = read("app/v3-screens.css");
  assert.match(css, /\.lf-swipe-actions \{ position: absolute;/);
  const row = read("components/inbox/SwipeRow.tsx");
  assert.match(row, /suppressClick\.current = false; \/\/ only the click that ends a swipe/);
});

test("select: fixed toolbar replaces the phone tab bar, with Select all and Archive", () => {
  const panel = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
  assert.match(panel, /Select all/);
  assert.match(panel, /archiveEntries\(picked\)/);
  const css = read("app/v3-screens.css");
  assert.match(css, /\.lf-inbox-selectbar \{ position: fixed;/);
  assert.match(css, /body:has\(\.lf-inbox-selectbar\) \.lf-mobile-bottom-nav \{ display: none; \}/);
});

test("archive keeps items findable and out of the badge; invite reminders are Waiting", () => {
  const panel = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
  assert.match(panel, /\["archived", "Archived", "archive"\]/);
  assert.match(panel, /!archived\.has\(`action:\$\{row\.actionKey\}`\)/);
  assert.match(panel, /startsWith\("remind_"\) \? "waiting"/);
  const store = read("lib/notifications/inboxUpdates.ts");
  assert.match(store, /export const ARCHIVE_PREFIX = "archive:"/);
});
