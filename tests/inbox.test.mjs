import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const panel = read("app/(app)/components/dashboard/ActionQueuePanel.tsx");
const updates = read("lib/notifications/inboxUpdates.ts");
const css = read("app/v3-screens.css");

test("Inbox, Mail style: categories All / Needs you / Waiting / Updates; badge-like subtitle (owner, 11 Nov 2026)", () => {
  assert.match(panel, /\[\["all", "All", "inbox"\], \["needs", "Needs you", "priority_high"\], \["waiting", "Waiting", "hourglass_top"\], \["update", "Updates", "notifications"\]\]/);
  assert.match(panel, /\{needs\} \{needs === 1 \? "needs" : "need"\} you · \{newCount\} new/);
  assert.match(css, /\.lf-inbox-category\.is-needs\[aria-pressed="true"\]/);
});

test("one tap goes straight to the thing; only your own tasks and the Will question open first", () => {
  assert.match(panel, /const opensFirst = ownTask \|\| \(guidance\?\.key === "will"/);
  assert.match(panel, /if \(opensFirst\) setOpened\(key\); else onAction\(row\.actionKey\);/);
  assert.match(panel, /open: \(\) => \{ markRead\(ids\); window\.location\.assign\(latest\.href\); \}/);
  // A tap on your own task never ticks it off; Mark as done is its own button.
  assert.match(panel, /openedRow\.actionKey\.startsWith\("task:complete:"\) \? \(\s*<button type="button" className="lf-inbox-primary" onClick=\{\(\) => \{ onAction\(openedRow\.actionKey\); setOpened\(null\); say\("Marked as done"\); \}\}>Mark as done/);
});

test("swipes like Mail, with visible buttons for everything; long swipe left only where Done is safe", () => {
  const swipe = read("components/inbox/SwipeRow.tsx");
  assert.match(swipe, /if \(event\.pointerType !== "touch"\) return;/, "a mouse gets the hover buttons instead");
  assert.match(swipe, /dx < -from\.width \* LONG && onLongLeft/);
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
