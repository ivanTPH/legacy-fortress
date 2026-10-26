# Document intelligence capability and release gate — 26 October 2026

## Release #88 decision

Digital-PDF-to-record creation remains **BACKEND BLOCKED**. Release #87's parser accepts text supplied by a trusted caller, but there is still no isolated PDF byte processor or authorised extraction job. The active browser upload writes to Coolify TEST Supabase Storage before any server-side byte validation, malware scan or quarantine. Bucket privacy, deployed document RLS, immutable original retention and accepted-decision audit have not been verified end to end. An operational extraction endpoint or prepopulated review form would therefore present unverified sensitive financial data and provenance. The feature stays disabled; there is no fake suggestion UI or automatic record mutation.

The safe Release #88 slice fixes owner-reported account-number validation, truthful staged-upload copy, search scope/focus, unknown-value presentation, mobile form fit and the document-preview close target. The close target and form fit still require installed-iPhone owner acceptance after protected TEST deployment. No uploaded PDF, scanned image or investment valuation has been processed by this slice. Investment classification and OCR remain the later deliverable B once digital-PDF deliverable A passes its security gate.

To unblock A, provision and verify a TEST-only isolated digital-PDF worker with resource/time limits and deletion of temporary bytes; server-side owner/document checks against the Coolify TEST Supabase private bucket; byte validation and scan/quarantine; immutable original and decision audit/retention; and synthetic statement fixtures for bank and non-bank classification. Only then can a disabled-by-default owner-reviewed proposal be connected to the existing Add Bank form and authorised persistence. OCR additionally needs an approved secure provider and equivalent retention checks.

Baseline inspected: current staging and Coolify TEST `4c10033d4167de17c41dc51c1834ff0011bbd6bc`. The owner worktree and separate security branches were untouched. This is a one-time review of the active attachment, document and Vault search paths.

| Capability | State | Evidence and release limit |
|---|---|---|
| Canonical document upload and record link | IMPLEMENTED; local synthetic VERIFIED | `createCanonicalAssetDocument` uploads to `vault-docs`, then inserts a `documents` row. The UI validates declared MIME and 15 MB size, requires a selected saved asset and confirmation, and allows retry after a failed upload. There is no byte-level format verification or percentage progress. |
| Private storage and access | PARTIAL | Storage RLS migration scopes paths to owner IDs and linked grants; live Coolify bucket privacy, deployed policy state and server-side upload validation have not been independently verified for this work. Client controls alone do not establish isolation. |
| Preview and document title search | IMPLEMENTED; local synthetic VERIFIED in prior V5.2 pass | Shared `AttachmentGallery` uses a signed URL and in-app preview. Global search uses authorised loaded rows and file names/titles, not document bodies. Saved record navigation was verified locally. |
| To do in Vault search | IMPLEMENTED in this slice | Saved authorised task records now appear under To do rather than Records. Search still indexes only display labels and explicitly selected safe type fields. It does not persist a recent-search list, but query terms currently enter the browser URL and may remain in browser history or access logs. |
| Document metadata edit and history | PARTIAL / BACKEND BLOCKED | The document row exposes file name and creation time, but there is no verified immutable version lineage or append-only document action history. The supplied history artboard must not show invented view/download counts. |
| Replace and delete retention | BACKEND BLOCKED | Current owner-only UI paths delete the old storage object and metadata after replacement or removal. RLS checks active owner mutation, but no per-document retention/legal-hold decision or audit event is proven in these handlers. Do not represent these actions as preserving originals. |
| Malware scanning and quarantine | MISSING | No scanner, quarantine state or promotion gate was found in the active upload path. MIME is supplied by the browser and is not a trustworthy content check. |
| Digital PDF text extraction | MISSING | No bank-statement PDF parser or isolated processing service is installed. This slice adds only a pure text-to-candidate parser with page evidence, validation and conflict rejection; it cannot read uploaded PDFs by itself. |
| Scanned PDF/image OCR | MISSING | No secure OCR provider or configured worker was found. Blank digital text produces a truthful `no_digital_text` result. |
| Structured statement fields | FOUNDATION VERIFIED | The pure parser recognises explicitly labelled provider, name, holder, type, full account number/sort code, validated IBAN/BIC, dates/period, currency and signed closing balance. It omits uncertain or conflicting fields and never mutates a record. Synthetic tests are not a production accuracy study. |
| Existing-account matching | FOUNDATION VERIFIED | A pure matcher requires full IBAN or full account number plus sort code and an owner-scoped authorised record list. It returns IDs only and does not query a database or unlock protected identifiers. |
| Owner review, Add Bank prefill, accept changes and Keep document only | BACKEND BLOCKED | No extraction endpoint, secure temporary result store, verified sensitive-record loader or accepted-decision audit exists. The operational suggestion UI remains off. Existing document-only upload remains usable. |

## Decision for this release

Promote only the search grouping, truthful legacy copy and parser/matcher foundation after focused checks. **Do not enable extraction or show document-added suggestions.** No Auth, RLS, schema, production or Coolify Supabase configuration change is authorised or needed for this slice.

## Exact gate to enable digital-PDF statements

1. Provision a TEST-only isolated PDF text worker with CPU, memory, page and time limits; confirm temporary bytes are erased and parser output is never logged. The worker must read only an owner-authorised document from the self-hosted Coolify TEST Supabase private bucket.
2. Verify bucket privacy, deployed RLS, byte-level file validation, scanner/quarantine, failure/retry behaviour and document checksum/provenance. Do not let extraction run before quarantine release.
3. Add a bearer-authenticated, owner-checked, disabled-by-default processing endpoint. Load decrypted comparison identifiers only through an approved owner-scoped server path. Never send them to search, analytics or notifications.
4. Add append-only accepted-decision events and version/retention rules before exposing New account, Existing account change acceptance, Replace or Delete. Preserve the original statement and historical versions. Test lock/linked-user denial and direct ID guessing.
5. With approved synthetic TEST PDFs, validate each extracted field against page evidence and confidence, then test owner correction, individual acceptance and Keep document only on mobile WebKit and desktop. Enable only after hosted owner acceptance.

Scanned PDFs/images follow as a separate stage once an approved secure OCR provider exists. Future parsers for Wills/executors, insurance, pensions, property and other documents should reuse the same evidence and explicit owner-choice contract; none should auto-change Vault records.
