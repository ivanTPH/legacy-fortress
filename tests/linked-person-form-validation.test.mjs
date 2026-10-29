import test from "node:test";
import assert from "node:assert/strict";
import { linkedPersonFormIssues } from "../lib/linkedPeople/recordLinkedPeople.ts";

test("new-person Save reports every missing field without requiring optional contact details", () => {
  const missing = linkedPersonFormIssues({ mode: "new", name: "", role: "", recordLabel: "14 Elm Road", online: true });
  assert.deepEqual(missing.map((issue) => issue.field), ["name", "role"]);
  assert.match(missing[1].message, /14 Elm Road/);
  assert.deepEqual(linkedPersonFormIssues({ mode: "new", name: "Ana Kowalski", role: "Managing agent", recordLabel: "14 Elm Road", online: true }), []);
});

test("existing-person Save requires an explicit selection and record role", () => {
  const missing = linkedPersonFormIssues({ mode: "existing", personId: "", role: "", recordLabel: "Lloyds Savings Account", online: true });
  assert.deepEqual(missing.map((issue) => issue.field), ["person", "role"]);
  assert.deepEqual(linkedPersonFormIssues({ mode: "existing", personId: "person-1", role: "Joint account holder", recordLabel: "Lloyds Savings Account", online: true }), []);
});

test("invalid optional values, duplicate email and offline state remain separate actionable errors", () => {
  const issues = linkedPersonFormIssues({ mode: "new", name: "Ana Kowalski", email: "bad", phone: "123", role: "Other", roleOtherText: "", duplicateEmail: true, online: false, recordLabel: "14 Elm Road" });
  assert.deepEqual(issues.map((issue) => issue.field), ["email", "phone", "email", "other", "connection"]);
});
