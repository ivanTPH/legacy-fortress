import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateEnquiry } from "../lib/partners/enquiries.ts";

test("partner enquiry: required fields, plain messages, spam field and limits", () => {
  assert.equal(validateEnquiry({ organisationName: "A" }).ok, false);
  assert.match(validateEnquiry({ organisationName: "Acme", contactName: "Jo", contactEmail: "nope" }).message, /work email/);
  assert.equal(validateEnquiry({ organisationName: "Acme", contactName: "Jo", contactEmail: "jo@acme.co.uk", website: "http://spam" }).message, "spam");
  const ok = validateEnquiry({ organisationName: "  Acme   Ltd ", contactName: "Jo Bloggs", contactEmail: "Jo@Acme.co.uk", organisationType: "Employer", membersEstimate: "1000", message: "x".repeat(5000) });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.organisationName, "Acme Ltd");
  assert.equal(ok.value.contactEmail, "jo@acme.co.uk");
  assert.equal(ok.value.membersEstimate, 1000);
  assert.equal(ok.value.message.length, 4000);
  assert.equal(validateEnquiry({ organisationName: "Acme", contactName: "Jo", contactEmail: "jo@acme.co.uk", organisationType: "Made up" }).value.organisationType, null);
});

test("partner enquiry: service role only table; platform staff only in Admin", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261123180000_partner_enquiries.sql", import.meta.url), "utf8");
  assert.match(sql, /REVOKE ALL ON TABLE public\.partner_enquiries FROM anon, authenticated;/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  const route = readFileSync(new URL("../app/api/internal/admin/partner-enquiries/route.ts", import.meta.url), "utf8");
  assert.match(route, /organisationScoped\) return NextResponse\.json\(\{ ok: false, message: "Not available\." \}, \{ status: 403 \}\)/);
  const alerts = readFileSync(new URL("../lib/admin/staffAlerts.ts", import.meta.url), "utf8");
  assert.match(alerts, /!== "enterprise_admin"\)/, "partner organisation admins never get staff alerts");
});
