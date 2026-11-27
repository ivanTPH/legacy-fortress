import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderSignInReminder } from "../lib/people/signInReminder.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("sign-in reminder email names no one and says how to get back in", () => {
  const email = renderSignInReminder("https://test.mylegacyfortress.com");
  assert.equal(email.subject, "A reminder: you have access to a Legacy Fortress Vault");
  assert.match(email.text, /https:\/\/test\.mylegacyfortress\.com\/sign-in/);
  assert.match(email.text, /https:\/\/test\.mylegacyfortress\.com\/forgot-password/);
  assert.match(email.text, /Use the email address this message was sent to/);
  assert.doesNotMatch(`${email.subject} ${email.text} ${email.html}`, /\$\{|owner|Bill|Smith|shared with you by/i);
});

test("sign-in reminder: own accepted contacts only, one a day, recorded, to their sign-in address", () => {
  const service = read("lib/people/signInReminder.ts");
  assert.match(service, /\.eq\("id", contactId\)\.eq\("owner_user_id", ownerUserId\)/);
  assert.match(service, /if \(!linkedUserId\) return \{ ok: false, status: 409/);
  assert.match(service, /status: 429/);
  assert.match(service, /admin\.auth\.admin\.getUserById\(linkedUserId\)/);
  assert.match(service, /event_type: REMINDER_EVENT, payload: \{ contact_id: contactId \}/);
  assert.match(read("components/contacts/ContactsNetworkWorkspace.tsx"), /\{!readOnly && contact\.linked_user_id \? <SignInReminderButton contactId=\{contact\.id\} \/> : null\}/);
});

test("page headers show a money total only when there is one (no '£0.00' on Social media)", () => {
  assert.match(read("components/records/UniversalRecordWorkspace.tsx"), /assetFormFamily !== "document" && totals\.active \? ` · \$\{formatCurrency\(totals\.active, "GBP"\)\}`/);
});
