import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Inbox: things to do and updates in one list, filtered All / Actions / Updates (owner, 10 Nov 2026)", () => {
  const panel = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
  assert.match(panel, /\["all", "All",[^\]]*\], \["actions", "Actions",[^\]]*\], \["updates", "Updates",/);
  assert.match(panel, /useInboxUpdates\(true, reads\)/);
  // Filled dot = new, outline = read; each row also says Action or Update in words.
  assert.match(panel, /lf-inbox-dot is-\$\{kind\}\$\{isNew \? " is-new" : ""\}/);
  assert.match(panel, /Action · \{groupLabel\(row\)\}/);
  assert.match(panel, /Update · <time/);
  // Opening an action never completes it; Not now and Mark as done are explicit choices.
  assert.match(panel, /"remind_later"\); setSelection\(null\); \}\}>\{[^}]*"Not now"\}/);
  assert.match(panel, /"already_done"\); setSelection\(null\); \}\}>Mark as done/);
  assert.match(panel, />Mark as unread</);
  assert.match(panel, /No updates yet\. When someone accepts an invitation/);
  assert.match(panel, /clearUpdates\(\[selectedUpdate\.id\]\)\}>Clear</);
  const css = read("app/v3-screens.css");
  assert.match(css, /\.lf-inbox-dot\.is-new \{ background: var\(--lf-inbox-dot\)/);
  assert.match(css, /max-width: 700px\) \{\n  \.lf-action-centre-drawer-backdrop:has\(\.lf-inbox-message\)/);
});

test("the bell is gone; Inbox replaces To do in the menus; old Notifications links open Inbox Updates", () => {
  const layout = read("app/(app)/layout.tsx");
  assert.doesNotMatch(layout, /<NotificationBell/);
  assert.match(layout, /\["\/actions", "Inbox", "inbox"\]/);
  assert.match(read("config/routeManifest.tsx"), /label: "Inbox",\n    path: "\/actions"/);
  assert.match(read("app/(app)/notifications/page.tsx"), /router\.replace\("\/actions\?filter=updates"\)/);
  assert.match(read("app/(app)/dashboard/page.tsx"), /<PageHeader title="Inbox"/);
});

test("updates keep their old sources, read state and cross-device clearing; nothing changes the events", () => {
  const updates = read("lib/notifications/inboxUpdates.ts");
  assert.match(updates, /from\("invitation_events"\)\.select\(/);
  assert.match(updates, /loadPersonNotifications\(supabase\)/);
  assert.match(updates, /syncClearedNotificationIds\(supabase\)/);
  // The only writes are the person's own read marks; the events themselves are never changed.
  assert.doesNotMatch(updates, /\.update\(|\.insert\(/);
  for (const match of updates.matchAll(/from\("([a-z_]+)"\)\.(delete|upsert)\(/g)) assert.equal(match[1], "inbox_reads");
});

test("what's been read follows the person across devices, through their own rows only (owner, 10 Nov 2026)", () => {
  const migration = read("supabase/migrations/20261110220000_inbox_reads.sql");
  assert.match(migration, /CREATE TABLE public\.inbox_reads/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON public\.inbox_reads FROM anon/);
  for (const action of ["select", "insert", "delete"]) assert.match(migration, new RegExp(`inbox_reads_own_${action} .*auth\\.uid\\(\\)`));
  assert.doesNotMatch(migration, /DROP|ALTER TABLE public\.(?!inbox_reads)/);
  const updates = read("lib/notifications/inboxUpdates.ts");
  assert.match(updates, /from\("inbox_reads"\)\.upsert\(/);
  assert.match(updates, /from\("inbox_reads"\)\.select\("item_key"\)/);
  // Falls back to this device if the server or the table isn't available.
  assert.match(updates, /if \(error\) return local;/);
  // The server is the truth: queued changes are sent first, then the server's list is taken as it is,
  // so an unread on one device isn't undone by another device's old copy (TEST run 24, 10 Nov 2026).
  assert.match(updates, /await flushPending\(userId\);\n    const \{ data, error \} = await supabase\.from\("inbox_reads"\)\.select/);
  assert.match(updates, /return saveLocalRead\(\[\.\.\.remote\.filter\(\(key\) => !still\.remove\.includes\(key\)\), \.\.\.still\.add\]\)/);
  assert.doesNotMatch(updates, /missingRemotely/);
  const panel = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
  assert.match(panel, /reads\.markRead\(\[actionReadKey\(row\.actionKey\)\]\)/);
  assert.match(panel, /reads\.markUnread\(actionReadKey\(selectedRow\.actionKey\)\)/);
});
