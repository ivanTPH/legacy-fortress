import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sender = fs.readFileSync(path.join(root, "lib/contacts/sendContactInvite.ts"), "utf8");
const contacts = fs.readFileSync(path.join(root, "components/contacts/ContactsNetworkWorkspace.tsx"), "utf8");
const manager = fs.readFileSync(path.join(root, "app/(app)/components/dashboard/ContactInvitationManager.tsx"), "utf8");

test("contact invitation records Auth request acceptance rather than provider delivery", () => {
  assert.match(sender, /client\.auth\.signInWithOtp/);
  assert.match(sender, /deliveryState: "auth_request_accepted"/);
  assert.match(sender, /event_type: "auth_request_accepted"/);
  assert.match(sender, /delivery_state: "auth_request_accepted"/);
  assert.match(sender, /provider_acceptance_confirmed: false/);
  assert.doesNotMatch(sender, /event_type: input\.resend \? "resent" : "sent"/);
});

test("invitation UI does not claim email provider delivery from the Auth response", () => {
  assert.match(contacts, /Invitation request submitted/);
  assert.match(manager, /Invitation request \$\{resend \? "resubmitted" : "submitted"\}/);
  assert.match(manager, /Legacy Fortress has accepted the request to send/);
  assert.doesNotMatch(contacts, /Invitation sent again to/);
  assert.doesNotMatch(manager, /Invitation email \$\{resend \? "resent" : "sent"\}/);
});

test("provider and hook failures remain distinct from the accepted Auth request", () => {
  const hook = fs.readFileSync(path.join(root, "app/api/auth/send-email/route.ts"), "utf8");
  assert.match(hook, /deliverWithResend/);
  assert.match(hook, /event: "accepted"/);
  assert.match(hook, /event: "rejected"/);
  assert.match(sender, /markInvitationDeliveryFailed/);
});
