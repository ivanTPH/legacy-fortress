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
