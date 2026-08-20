# Legacy Fortress — Attachment and Document Architecture

Status: based on the confirmed Codex implementation report for the latest pass.

## Confirmed shared component
- `components/documents/AttachmentGallery.tsx`

## Confirmed behaviour of the shared gallery
The shared gallery now supports:
- image thumbnail cards
- document file cards
- in-app preview modal
- download
- print for PDF/images
- remove

## Confirmed integration points

### Canonical record workspace
- `components/records/UniversalRecordWorkspace.tsx`
- old behaviour replaced: `window.open(...)`
- new behaviour: shared in-app preview through `AttachmentGallery`

### Canonical documents workspace
- `components/documents/DocumentsWorkspace.tsx`
- old behaviour replaced: `window.open(...)`
- new behaviour: shared in-app preview through `AttachmentGallery`

### Legacy section workspace
- `components/sections/SectionWorkspace.tsx`
- previous pattern: single attachment via `file_path`
- current pattern: multi-attachment via `details.attachments[]`
- compatibility: old `file_path` values are still backfilled

## Confirmed current outcomes
- canonical records now use shared in-app preview
- legacy section pages can now hold multiple files instead of one
- one shared preview/download/remove model is now in place across canonical records and legacy sections

## Confirmed limitations still present
- non-previewable office-style files still fall back to download rather than rich embedded viewing
- legacy section pages still remain on `section_entries`
- attachment architecture is improved, but the broader data architecture is not yet fully unified

## Rules for future prompts
- Never add a new attachment UI that duplicates `AttachmentGallery`.
- Avoid `window.open(...)` preview flows when the shared gallery can be used.
- Preserve backward compatibility only where required; do not let compatibility paths become the new default architecture.
- When touching attachment logic, document whether the target is canonical or legacy.

## Document provenance, permissions and erasure — added 20 August 2026

The shared attachment UX must not determine the legal/security semantics of a document operation by itself.

Required architecture rules:
- original/historic documents must have stable provenance
- a Professional Adviser with contribution permission may add a new document/version but must not silently overwrite the prior original
- executor/representative/estate access must not permit deletion or overwrite of the deceased owner's historical originals
- record unlink, user-visible remove, soft delete, storage-object deletion, retention expiry and lawful erasure are distinct operations
- every contributed/replacement version should record uploader, timestamp, related record/wallet, source/context and prior-version relationship where applicable
- storage and signed-URL access must remain permission-checked server-side
- privacy-rights erasure must use an approved retention/exception workflow; a UI 'delete' button is not by itself proof of compliant erasure

Future attachment work must document which operation is being performed and its audit/retention consequences.
## Death-lock and Estate Administration document semantics — approved 20 August 2026

When a vault enters `PROTECTIVE_LOCK`, ordinary mutation of historical owner records/documents must be blocked while the death claim is investigated.

When a vault enters `ESTATE_LOCKED`:
- historical owner documents and metadata become immutable through normal product workflows;
- executor/representative access may view/download according to approved estate permissions but may not edit, replace or delete historic originals;
- all new death/probate/valuation/tax/correspondence/distribution evidence must be added under a separate Estate Administration context;
- every post-death object must carry provenance including uploader, timestamp, estate case/context, source/authority and version relationship where relevant;
- suspending/revoking a compromised representative must not alter historical documents or remove the estate lock;
- exceptional living-owner recovery may restore future owner functionality only through the controlled recovery workflow and must preserve the forensic/audit record of the false/malicious death event.

The document service must distinguish owner-lifetime originals, contributed lifetime versions and post-death estate-administration records as explicit provenance classes.
