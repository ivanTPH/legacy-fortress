import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Inbox: things to do and updates in one list, filtered All / Actions / Updates (owner, 10 Nov 2026)", () => {
  const panel = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
  assert.match(panel, /\["all", "All",[^\]]*\], \["actions", "Actions",[^\]]*\], \["updates", "Updates",/);
  assert.match(panel, /useInboxUpdates\(true\)/);
  // Filled dot = new, outline = read; each row also says Action or Update in words.
  assert.match(panel, /lf-inbox-dot is-\$\{kind\}\$\{isNew \? " is-new" : ""\}/);
  assert.match(panel, /Action · \{groupLabel\(row\)\}/);
  assert.match(panel, /Update · <time/);
  // Opening an action never completes it; Not now and Mark as done are explicit choices.
  assert.match(panel, /"remind_later"\); setSelection\(null\); \}\}>\{[^}]*"Not now"\}/);
  assert.match(panel, /"already_done"\); setSelection\(null\); \}\}>Mark as done/);
  assert.match(panel, />Mark as unread</);
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
  assert.doesNotMatch(updates, /\.update\(|\.delete\(|\.insert\(/);
});
