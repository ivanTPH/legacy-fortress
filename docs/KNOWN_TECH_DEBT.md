# Legacy Fortress — Known Technical Debt

Status: confirmed from the latest Codex review.

## High priority

### Fragmented contacts / people model
Confirmed split:
- `app/(app)/personal/page.tsx` — next of kin via legacy `SectionWorkspace`
- `app/(app)/trust/page.tsx` — executors / trusted contacts via canonical asset records
- `ContactInvitationManager.tsx` — invite status in a separate flow

Impact:
- people/contacts are still fragmented across multiple systems
- records do not reference one canonical contact entity across the app
- contacts are not yet reusable shared entities

### Legacy persistence still active in key pages
- `components/sections/SectionWorkspace.tsx`
- legacy pages still use `section_entries`

Impact:
- architecture remains mixed between canonical and legacy systems
- future features risk being implemented twice

## Medium priority

### Missing synthetic populated-account coverage
Not yet added for:
- profile
- finances
- property
- legal
- business
- personal
- tasks / reminders
- contacts

Impact:
- empty and near-empty states have not been fully pressure-tested
- realistic user journeys are not yet fully validated

### Attachment viewing still partial for office-style files
Impact:
- preview is shared for supported formats, but unsupported office-style files still require download

## Canonical contact design target identified, not yet implemented
- `id`
- `full_name`
- `email`
- `phone`
- `contact_role`
- `relationship`
- `linked_context`
- `invite_status`
- `verification_status`
- `source_type`

## Current verdict
- NOT FIXED
- product is improved, but not yet stable enough to call complete

## Rules for future prompts
- Prioritise contact unification before adding more contact-adjacent features.
- Avoid extending `section_entries` unless there is no safe canonical path.
- Any new sample/demo data should cover multiple categories and realistic linked records.
- Do not declare the platform stable until shared entities and shared workflows are actually unified.
