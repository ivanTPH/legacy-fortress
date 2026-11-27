import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getCategoryTypeSelectOptions } from "../lib/assets/categoryTypeIntegrity.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("loans & mortgages: the app's types match the approved migration exactly", () => {
  const migration = read("supabase/migrations/20261127120000_loans_and_cards.sql");
  const values = getCategoryTypeSelectOptions("finances", "debts", "Select").map((option) => option.value).filter(Boolean);
  for (const key of ["mortgage", "personal_loan", "car_finance", "buy_now_pay_later", "student_loan", "family_loan", "overdraft", "business_debt", "other_debt"]) {
    assert.ok(values.includes(key), key);
    assert.match(migration, new RegExp(`'${key}'`), `${key} allowed by the database`);
  }
});

test("loans & mortgages: renamed everywhere, credit cards not offered, mortgages link to a property", () => {
  assert.match(read("app/(app)/finances/page.tsx"), /title: "Loans & mortgages"/);
  assert.match(read("app/(app)/finances/debts/page.tsx"), /title="Finances · Loans & mortgages"/);
  assert.match(read("lib/vault/addRecordTypes.ts"), /label: "Loan or mortgage"/);
  assert.match(read("lib/vaultPreferences.ts"), /label: "Loans & mortgages"/);
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  assert.match(workspace, /option\.value !== "credit_card"/);
  assert.match(workspace, /<FieldLogoPicker label="Secured on"/);
  assert.match(workspace, /debt_property_id: parseLinkRef\(form\.debt_property_id\)/);
  assert.match(workspace, /<PropertyLoansList propertyRef=\{linkRef\("asset", selectedRecord\.id\)\}/);
  assert.match(workspace, /UK student loans are normally cancelled when the borrower dies/);
});

test("property links point at the property records page", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  assert.match(workspace, /href="\/vault\/property\?add=1"/);
  assert.match(workspace, /case "property": return "\/vault\/property";/);
});

test("loans wording: 'Add loan or mortgage', people linked to this loan, house icon not initials, one mortgage figure", () => {
  const workspace = read("components/records/UniversalRecordWorkspace.tsx");
  assert.match(workspace, /debts: "loan or mortgage", cards: "card", "direct-debits": "direct debit"/);
  assert.match(workspace, /Mortgage: see Mortgages and loans on this property/);
  assert.match(workspace, /option\.category === "property" \? "home"/);
  assert.match(read("components/ui/LogoPicker.tsx"), /categoryIcon=\{option\.icon\}/);
  assert.match(read("lib/linkedPeople/recordLinkedPeople.ts"), /heading: "People linked to this loan"/);
});
