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
  assert.equal(validateEnquiry({ organisationName: "Acme", contactName: "Jo", contactEmail: "jo@acme.co.uk", organisationType: "" }).value.organisationType, null);
  // The website form: size band to a number, extra details kept with the message.
  const site = validateEnquiry({ organisationName: "Acme", contactName: "Jo", contactEmail: "jo@acme.co.uk", organisationType: "Law firm or solicitor", membersBand: "250 to 1,000", request: "demo", contactRole: "Partner", message: "Hello" });
  assert.equal(site.value.organisationType, "Law firm or solicitor");
  assert.equal(site.value.membersEstimate, 1000);
  assert.match(site.value.message, /^Asked for: a 20-minute demo · Role: Partner · Size: 250 to 1,000\n\nHello$/);
});

test("partner enquiry: the website partners form sends to the enquiry API", () => {
  const html = readFileSync(new URL("../public/site/partners.html", import.meta.url), "utf8");
  assert.match(html, /data-endpoint="\/api\/partners\/enquiry"/);
  for (const name of ["organisationName", "organisationType", "contactName", "contactEmail", "membersBand", "website"]) assert.match(html, new RegExp(`name="${name}"`));
  assert.doesNotMatch(html, /messages aren’t sent anywhere/);
  const js = readFileSync(new URL("../public/site/site.js", import.meta.url), "utf8");
  assert.match(js, /data-endpoint/);
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
