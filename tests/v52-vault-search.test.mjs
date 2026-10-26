import test from "node:test";
import assert from "node:assert/strict";

const { filterDiscoveryRecords, buildDashboardDiscoveryResults } = await import("../lib/records/discovery.ts");

const rows = [
  { id: "barclays", title: "Barclays Savings Account", provider_name: "Barclays", section_key: "finances", category_key: "bank", status: "active", metadata: { account_type: "Savings", account_number: "12345678", sort_code: "111222", pin: "9087" } },
  { id: "current", title: "Current Account", provider_name: "HSBC", section_key: "finances", category_key: "bank", status: "active", metadata: { account_type: "Current", iban: "GB82 WEST 1234 5698 7654 32" } },
  { id: "will", title: "My Will", section_key: "legal", category_key: "wills", status: "active", metadata: { private_notes: "secret testament text" } },
  { id: "archived", title: "Old Savings", section_key: "finances", category_key: "bank", status: "archived" },
];

test("category search matches display names, type and provider without unrelated records", () => {
  for (const [query, expected] of [["BARCLAYS", ["barclays"]], ["  savings  ", ["barclays", "archived"]], ["current", ["current"]], ["HSBC", ["current"]], ["my wil", ["will"]], ["no-such-record", []]]) {
    assert.deepEqual(filterDiscoveryRecords(rows, { query }).map((row) => row.id), expected);
  }
  assert.deepEqual(filterDiscoveryRecords(rows, { query: "savings", statusFilter: "active" }).map((row) => row.id), ["barclays"]);
  assert.deepEqual(filterDiscoveryRecords(rows, { query: "  ", statusFilter: "active" }).map((row) => row.id), ["barclays", "current", "will"]);
});

test("search never indexes sensitive metadata or free-form private summaries", () => {
  for (const query of ["12345678", "111222", "9087", "GB82", "secret testament"]) {
    assert.deepEqual(filterDiscoveryRecords(rows, { query }).map((row) => row.id), [], query);
  }
});

test("global discovery keeps cross-category results distinct and links to saved IDs", () => {
  const results = buildDashboardDiscoveryResults({
    query: "will",
    assets: rows,
    contacts: [], documents: [], attachments: [],
    assetHref: (row) => row.section_key === "legal" ? `/legal/wills?record=${row.id}` : `/finances/bank?asset=${row.id}`,
    assetIcon: () => "description",
    contactHref: () => "", documentHref: () => "", attachmentHref: () => "",
  });
  assert.deepEqual(results.map((result) => [result.label, result.href]), [["My Will", "/legal/wills?record=will"]]);
  assert.equal(results[0]?.description.includes("secret testament"), false);
});

test("authorised saved tasks appear as To do results without indexing private notes", () => {
  const task = { id: "task-1", title: "Invite executor", section_key: "personal", category_key: "tasks", metadata: { private_notes: "account 12345678" } };
  const search = (query) => buildDashboardDiscoveryResults({
    query, assets: [task], contacts: [], documents: [], attachments: [],
    assetHref: (row) => `/personal/tasks?asset=${row.id}`, assetIcon: () => "description",
    contactHref: () => "", documentHref: () => "", attachmentHref: () => "",
  });
  assert.deepEqual(search("invite").map(({ kind, href }) => [kind, href]), [["task", "/personal/tasks?asset=task-1"]]);
  assert.deepEqual(search("12345678"), []);
});
