import test from "node:test";
import assert from "node:assert/strict";
import { partnerOnboarding, renewalFromLength } from "../lib/admin/partnerOnboarding.ts";
import { ENTERPRISE_ADMIN_NAVIGATION, filterAdminNavigation, labelPartnerNavigation } from "../components/admin/adminNavigation.ts";

const org = { status: "pending_setup", primaryContactEmail: "lead@acme.co.uk" };

test("onboarding: the five steps follow the partner's own records, one next step at a time", () => {
  let setup = partnerOnboarding({ organisation: org, licences: [], invitations: [] });
  assert.equal(setup.done, 1); assert.equal(setup.next.key, "licence");
  const licence = { status: "pending_approval", billingStatus: "pending", purchasedSeats: 500, renewalDate: "2027-11-22", billingReference: "INV-1" };
  setup = partnerOnboarding({ organisation: org, licences: [licence], invitations: [] });
  assert.equal(setup.next.key, "invoice");
  setup = partnerOnboarding({ organisation: org, licences: [{ ...licence, billingStatus: "active" }], invitations: [] });
  assert.equal(setup.next.key, "active");
  setup = partnerOnboarding({ organisation: org, licences: [{ ...licence, billingStatus: "active", status: "active" }], invitations: [{ roleTemplate: "organisation_admin", status: "sent", email: "lead@acme.co.uk" }] });
  assert.equal(setup.next.key, "lead"); assert.equal(setup.leadInvited, true);
  setup = partnerOnboarding({ organisation: org, licences: [{ ...licence, billingStatus: "active", status: "active" }], invitations: [{ roleTemplate: "organisation_admin", status: "accepted" }] });
  assert.equal(setup.complete, true); assert.equal(setup.done, 5);
});

test("licence length dropdown sets the renewal date", () => {
  assert.equal(renewalFromLength("2026-11-24", 12), "2027-11-23");
  assert.equal(renewalFromLength("2026-11-24", 24), "2028-11-23");
});

test("partner menu: plain words, no Organisations list, same capability checks", () => {
  const all = ENTERPRISE_ADMIN_NAVIGATION[0].items.map((item) => item.capability).filter(Boolean);
  const partner = labelPartnerNavigation(filterAdminNavigation(ENTERPRISE_ADMIN_NAVIGATION, all));
  const labels = partner[0].items.map((item) => item.label);
  assert.ok(!partner[0].items.some((item) => item.key === "enterprise-organisations"));
  assert.deepEqual(labels.slice(0, 3), ["Overview", "Members", "Sign-up link"]);
  assert.ok(labels.includes("Licence and invoice"));
});

test("view as partner: staff only, one organisation, audited, look only", async () => {
  const { readFileSync } = await import("node:fs");
  const route = readFileSync(new URL("../app/api/internal/admin/enterprise/route.ts", import.meta.url), "utf8");
  assert.match(route, /if \(admin\.access\.enterpriseScope\?\.organisationScoped\) return NextResponse\.json\(\{ ok: false, message: "Not available\." \}, \{ status: 403 \}\);/);
  assert.match(route, /organisationIds: \[viewAs\]/);
  assert.match(route, /action: "Partner Portal viewed as partner"/);
  const ui = readFileSync(new URL("../components/enterprise/EnterpriseOperationsWorkspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /\(!viewAs \|\| !\/\(manage\|create\|edit\|seats\|renew\|lifecycle\|request\)\/\.test\(capability\)\)/);
});
