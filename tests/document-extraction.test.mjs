import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const { readDocumentText, detectDocumentKind } = await import("../lib/documents/extraction/readDocumentText.ts");
const { extractNamedPeople } = await import("../lib/documents/extraction/peopleExtraction.ts");
const { mergePeopleByName, matchOwnerContact } = await import("../lib/documents/extraction/personMatching.ts");
const { extractBankStatementCandidate } = await import("../lib/documents/bankStatementExtraction.ts");
const { matchBankStatementToAuthorisedAccounts } = await import("../lib/documents/bankStatementMatching.ts");
const { buildBankAccountFinding, bankAccountTypeToken } = await import("../lib/documents/extraction/bankFinding.ts");

const fixture = (name) => new Uint8Array(fs.readFileSync(new URL(`./fixtures/documents/${name}`, import.meta.url)));
const read = async (name) => {
  const result = await readDocumentText(fixture(name));
  assert.equal(result.ok, true, `${name} should be readable`);
  return result.pages;
};

test("file type comes from bytes, not the declared name", () => {
  assert.equal(detectDocumentKind(fixture("synthetic-will.pdf")), "pdf");
  assert.equal(detectDocumentKind(fixture("synthetic-will-photo.png")), "png");
  assert.equal(detectDocumentKind(new TextEncoder().encode("<html>not a pdf</html>")), null);
});

test("a Will gives executors, trustees, reserve executor, guardian and beneficiaries — not the testator or witnesses", async () => {
  const people = extractNamedPeople(await read("synthetic-will.pdf"));
  const byRole = (role) => people.filter((p) => p.role === role).map((p) => p.name).sort();
  assert.deepEqual(byRole("Executor"), ["Jane Example", "Robert Sample"]);
  assert.deepEqual(byRole("Trustee"), ["Jane Example", "Robert Sample"]);
  assert.deepEqual(byRole("Reserve executor"), ["Mary Placeholder"]);
  assert.deepEqual(byRole("Guardian"), ["Chris Example"]);
  assert.deepEqual(byRole("Beneficiary"), ["Natalie Example", "Sophie Example"]);
  for (const name of ["Alex Example", "Peter Witness", "Linda Witness"]) assert.ok(!people.some((p) => p.name === name), `${name} must not be suggested`);
  assert.ok(people.every((p) => p.page >= 1 && p.evidence.length > 0));
});

test("one suggestion per person keeps the most important role", async () => {
  const merged = mergePeopleByName(extractNamedPeople(await read("synthetic-will.pdf")));
  assert.equal(merged.find((p) => p.name === "Jane Example").role, "Executor");
  assert.equal(new Set(merged.map((p) => p.name)).size, merged.length);
});

test("a lasting power of attorney gives attorneys and a replacement attorney", async () => {
  const people = extractNamedPeople(await read("synthetic-lpa.pdf"));
  assert.deepEqual(people.filter((p) => p.role === "Attorney").map((p) => p.name).sort(), ["Jane Example", "Robert Sample"]);
  assert.deepEqual(people.filter((p) => p.role === "Replacement attorney").map((p) => p.name), ["Mary Placeholder"]);
  assert.ok(!people.some((p) => p.name === "Sam Provider"));
});

test("a photographed Will is read with in-house OCR", async () => {
  const pages = await read("synthetic-will-photo.png");
  assert.equal(pages[0].source, "ocr");
  const people = extractNamedPeople(pages);
  assert.deepEqual(people.filter((p) => p.role === "Executor").map((p) => p.name).sort(), ["Ella Scanned", "Tom Scanned"]);
});

test("matching never guesses: exact only for one identical name, otherwise possible or none", () => {
  const contacts = [{ id: "a", full_name: "Jane Example" }, { id: "b", full_name: "J. Sample" }, { id: "c", full_name: "Robert Other" }];
  assert.deepEqual(matchOwnerContact("Jane Example", contacts), { personId: "a", kind: "exact" });
  assert.deepEqual(matchOwnerContact("Jack Sample", contacts), { personId: "b", kind: "possible" });
  assert.deepEqual(matchOwnerContact("Mary Placeholder", contacts), { personId: null, kind: "none" });
});

test("a bank statement gives account details and is offered as a new record", async () => {
  const candidate = extractBankStatementCandidate(await read("synthetic-bank-statement.pdf"));
  assert.equal(candidate.fields.provider.value, "Northfield Bank");
  assert.equal(candidate.fields.accountNumber.value, "41207781");
  assert.equal(candidate.fields.sortCode.value, "20-45-77");
  assert.equal(candidate.fields.closingBalance.value, "12450.32");
  const none = matchBankStatementToAuthorisedAccounts(candidate, "owner", []);
  const finding = buildBankAccountFinding(candidate, none, "this-record");
  assert.equal(finding.status, "new_account");
  assert.equal(finding.display.accountEnding, "7781");
  assert.equal(finding.prefill.bank_account_type, "savings_account");
  assert.equal(finding.prefill.value_major, "12450.32");
  const same = matchBankStatementToAuthorisedAccounts(candidate, "owner", [{ id: "this-record", ownerUserId: "owner", accountNumber: "41207781", sortCode: "204577" }]);
  assert.equal(buildBankAccountFinding(candidate, same, "this-record").status, "matches_this_record");
  const other = matchBankStatementToAuthorisedAccounts(candidate, "owner", [{ id: "other", ownerUserId: "owner", accountNumber: "41207781", sortCode: "20-45-77" }]);
  assert.equal(buildBankAccountFinding(candidate, other, "this-record").status, "matches_other_record");
});

test("account type labels map to the Add bank account options", () => {
  assert.equal(bankAccountTypeToken("Cash ISA").token, "isa_cash");
  assert.equal(bankAccountTypeToken("Current Account").token, "current_account");
  assert.deepEqual(bankAccountTypeToken("Regular Bonus"), { token: "other_bank_account", other: "Regular Bonus" });
});

test("extraction endpoint is owner-checked, TEST-gated and never stores or logs document text", () => {
  const route = fs.readFileSync(new URL("../app/api/documents/[documentId]/extract/route.ts", import.meta.url), "utf8");
  assert.match(route, /NEXT_PUBLIC_DOCUMENT_EXTRACTION !== "true"/);
  assert.match(route, /getRequestUser\(request\)/);
  assert.match(route, /\.eq\("owner_user_id", user\.id\)/);
  assert.doesNotMatch(route, /console\.(log|info|warn|error)/);
  assert.doesNotMatch(route, /from\("record_links"\)\.insert|from\("contacts"\)\.insert/);
  const reader = fs.readFileSync(new URL("../lib/documents/extraction/readDocumentText.ts", import.meta.url), "utf8");
  assert.doesNotMatch(reader, /fetch\(|https?:\/\//);
});

test("a scanned PDF with no text layer is rendered and read with OCR", async () => {
  const pages = await read("synthetic-will-scanned.pdf");
  assert.equal(pages[0].source, "ocr");
  assert.ok(extractNamedPeople(pages).some((p) => p.name === "Tom Scanned" && p.role === "Executor"));
});

test("bank matching reads asset details from the assets.metadata_json column", () => {
  const route = fs.readFileSync(new URL("../app/api/documents/[documentId]/extract/route.ts", import.meta.url), "utf8");
  assert.match(route, /select\("id,owner_user_id,metadata_json"\)/);
});
