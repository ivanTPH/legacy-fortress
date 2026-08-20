# Legacy Fortress — Project Structure

Status: working project reference created from the latest Codex report and the documents already attached to this project. This is a stabilisation note, not a full repo crawl.

## Confirmed key application areas

### Canonical/shared record system
- `components/records/UniversalRecordWorkspace.tsx`
- `components/documents/DocumentsWorkspace.tsx`
- `components/documents/AttachmentGallery.tsx`

These are the confirmed shared/canonical attachment surfaces now in use.

### Legacy section system still in use
- `components/sections/SectionWorkspace.tsx`
- `app/(app)/personal/page.tsx`

The legacy section system is still active in parts of the product and has now been upgraded to support multi-attachment behaviour instead of only a single `file_path` pattern.

### Contact-related split areas
- `app/(app)/personal/page.tsx` — next of kin via legacy `SectionWorkspace`
- `app/(app)/trust/page.tsx` — executors / trusted contacts via canonical asset records
- `ContactInvitationManager.tsx` — invite status handling

## Confirmed structural observations
- Attachment UI has been centralised into one reusable shared component.
- Canonical record/document workspaces are now using the shared in-app preview approach.
- Legacy section pages still exist and still use `section_entries`, even though attachment handling has improved.
- Contacts are still fragmented across multiple systems and are not yet one canonical reusable entity.

## Confirmed files changed in the latest pass
- `components/documents/AttachmentGallery.tsx`
- `components/records/UniversalRecordWorkspace.tsx`
- `components/documents/DocumentsWorkspace.tsx`
- `components/sections/SectionWorkspace.tsx`

## Current architecture summary

### Shared attachment layer
A shared gallery/viewer now provides:
- image thumbnail cards
- document file cards
- in-app preview modal
- download
- print for PDF/images
- remove

### Compatibility approach
Legacy section pages now use `details.attachments[]` for multiple files, while still backfilling old `file_path` values for compatibility.

## Known structural gaps
- Full route inventory is not yet documented here.
- Full lib/data/service layer inventory is not yet documented here.
- Test directory and build config inventory still need a repo-level pass.
- Contact persistence is still split and not normalised.

## Rules for future prompts
- Reuse `AttachmentGallery` instead of creating page-level attachment UIs.
- Do not introduce new single-file `file_path`-only patterns where multi-attachment support exists.
- Prefer canonical/shared workspaces before extending legacy section flows.
- Do not create a new contact model in one page without checking the broader cross-app contact architecture first.

## Governance architecture target — 20 August 2026
New authoritative project references:
- `PROJECT_CONTEXT.md`
- `LEGACY_FORTRESS_DATA_PROTECTION_GOVERNANCE.md`

Canonical service/domain targets that must be found or created through safe remediation rather than page-local duplication:
- People & Access / canonical contact entity
- Invitation lifecycle service
- Identity verification provider abstraction
- Permission-resolution service enforced server-side/RLS
- Immutable document/version provenance
- Estate access request/review service
- Organisation/licence/sponsored-entitlement domain
- Privacy rights case-management service
- Retention/deletion/anonymisation service
- Consent/marketing preference service
- Append-only audit/event service

These are architectural targets, not assertions that the current repo already implements them.
## Required security/domain services — target architecture 20 August 2026
Future repo structure should converge on shared canonical services/interfaces rather than page-local implementations for:
- `IdentityVerificationProvider` — replaceable internal-UAT/commercial IDV adapter;
- identity assurance / step-up policy — Level 1 authenticated, Level 2 identity verified, Level 3 presence re-verified;
- vault lifecycle/state service — owner active, death reported, protective lock, estate locked, disputed/recovery;
- estate claimant/representative access service — independent from vault state;
- immutable Estate Administration record/provenance service;
- policy/consent/communication preference service including per-partner purpose/channel/frequency;
- closed-loop partner cohort/activation service;
- key-management/recovery interface supporting envelope encryption and separately protected wrapped recovery material;
- security/privacy audit service.

Do not implement these rules independently inside Personal Vault, Admin and Enterprise pages. Shared server-side domain policies must be reused by all UI surfaces.
