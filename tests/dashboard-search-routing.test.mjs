import test from "node:test";
import assert from "node:assert/strict";

const { buildDashboardDiscoveryResults, buildDashboardSearchHref } = await import("../lib/records/discovery.ts");

test("shell search always targets the canonical dashboard route", () => {
  assert.equal(buildDashboardSearchHref(""), "/dashboard");
  assert.equal(buildDashboardSearchHref("  Emma Carter  "), "/dashboard?search=emma%20carter");
});

test("dashboard discovery returns direct contact click-through links", () => {
  const results = buildDashboardDiscoveryResults({
    query: "emma",
    assets: [],
    contacts: [
      {
        id: "contact-123",
        fullName: "Emma Carter",
        email: "emma@example.com",
        phone: "0207 123 4567",
        contactRole: "executor",
        relationship: "sister",
        linkedContext: [{ label: "Will", section_key: "legal", category_key: "wills" }],
      },
    ],
    documents: [],
    attachments: [],
    assetHref: () => "/dashboard",
    assetIcon: () => "description",
    contactHref: (contact) => `/contacts?contact=${contact.id}`,
    documentHref: () => "/legal/wills",
    attachmentHref: () => "/legal/wills",
  });

  assert.equal(results.length, 1);
  assert.equal(results[0]?.kind, "contact");
  assert.equal(results[0]?.href, "/contacts?contact=contact-123");
});

test("dashboard discovery suppresses duplicate dead-end asset hits when a canonical contact match exists", () => {
  const results = buildDashboardDiscoveryResults({
    query: "emma carter",
    assets: [
      {
        id: "asset-1",
        title: "Emma Carter",
        section_key: "personal",
        category_key: "executors",
        summary: "Executor asset",
      },
    ],
    contacts: [
      {
        id: "contact-123",
        fullName: "Emma Carter",
        email: "emma@example.com",
        phone: "",
        contactRole: "executor",
        relationship: "friend",
        linkedContext: [{ label: "Will", section_key: "legal", category_key: "wills" }],
      },
    ],
    documents: [],
    attachments: [],
    assetHref: () => "/personal",
    assetIcon: () => "description",
    contactHref: (contact) => `/contacts?contact=${contact.id}`,
    documentHref: () => "/legal/wills",
    attachmentHref: () => "/legal/wills",
  });

  assert.deepEqual(
    results.map((result) => ({ kind: result.kind, href: result.href, label: result.label })),
    [
      { kind: "asset", href: "/personal", label: "Emma Carter" },
      { kind: "contact", href: "/contacts?contact=contact-123", label: "Emma Carter" },
    ],
  );
});

test("dashboard discovery can return working navigation destinations from shell search", () => {
  const results = buildDashboardDiscoveryResults({
    query: "contacts",
    assets: [],
    contacts: [],
    documents: [],
    attachments: [],
    assetHref: () => "/dashboard",
    assetIcon: () => "description",
    contactHref: (contact) => `/contacts?contact=${contact.id}`,
    documentHref: () => "/legal",
    attachmentHref: () => "/legal",
    extraLinks: [
      {
        id: "contacts",
        label: "Contacts",
        description: "Open the shared contacts workspace.",
        href: "/contacts",
        icon: "contacts",
        keywords: ["contacts", "people", "executors"],
      },
    ],
  });

  assert.deepEqual(results, [
    {
      id: "navigation-contacts",
      kind: "navigation",
      label: "Contacts",
      description: "Open the shared contacts workspace.",
      href: "/contacts",
      icon: "contacts",
    },
  ]);
});

test("dashboard discovery matches metadata-backed asset terms, document titles, and attachment file names", () => {
  const results = buildDashboardDiscoveryResults({
    query: "hsbc",
    assets: [
      {
        id: "asset-1",
        title: "",
        provider_name: "",
        section_key: "finances",
        category_key: "bank",
        summary: "",
        metadata: {
          institution_name: "HSBC",
          account_holder_name: "Jane Doe",
        },
      },
    ],
    contacts: [],
    documents: [],
    attachments: [],
    assetHref: () => "/finances/bank",
    assetIcon: () => "account_balance",
    contactHref: (contact) => `/contacts?contact=${contact.id}`,
    documentHref: () => "/legal",
    attachmentHref: () => "/legal",
  });

  assert.deepEqual(results.map((item) => item.href), ["/finances/bank"]);
  assert.equal(results[0]?.label, "HSBC");
});

test("dashboard discovery matches document titles and attachment names", () => {
  const results = buildDashboardDiscoveryResults({
    query: "passport",
    assets: [],
    contacts: [],
    documents: [
      {
        id: "document-1",
        title: "Passport renewal record",
        fileName: "identity-pack.pdf",
        parentLabel: "Identity documents",
        sectionKey: "legal",
        categoryKey: "identity-documents",
        documentKind: "document",
      },
    ],
    attachments: [
      {
        id: "attachment-1",
        fileName: "passport-photo.jpg",
        parentLabel: "Identity documents",
        sectionKey: "legal",
        categoryKey: "identity-documents",
        mimeType: "image/jpeg",
        metaLabel: "Identity documents",
      },
    ],
    assetHref: () => "/dashboard",
    assetIcon: () => "description",
    contactHref: (contact) => `/contacts?contact=${contact.id}`,
    documentHref: () => "/legal/identity-documents",
    attachmentHref: () => "/legal/identity-documents",
  });

  assert.deepEqual(
    results.map((item) => ({ kind: item.kind, href: item.href })),
    [
      { kind: "document", href: "/legal/identity-documents" },
      { kind: "attachment", href: "/legal/identity-documents" },
    ],
  );
});
