# Linked people — V5.2 (27 Oct 2026)

Design: `design/V5.2 Linked People.dc.html`. Extends Vault Master V5.2. Do not redesign existing screens.

## Scope
- One component, one API and one set of steps for **every** record type that supports linked people: bank accounts, investments, pensions, insurance, title deeds / property, Wills and legal documents, companies, digital accounts, personal items.
- Record type changes only the section heading and the role list. Do not build a Will-specific version.

## Journey (every record type)
Save record → Add person (choose from People, or add new) → Save person → Offer invitation (Send invitation / Invite later) → back to record → Add another → repeat.
- No link controls until the record is saved.
- Each person saved in its own request. Cancel/failure on the next never touches saved links.
- Invitation needs explicit confirmation (d6). Saving never sends.
- No email: save allowed; offer becomes "Add email and invite".

## Four separate states
Recorded (link exists) · Invited (Not invited / Invite sent / Not delivered / Expired / Joined) · Verified (Checking ID / ID verified) · Authorised (explicit access grant; "Can see this record"). None implies another. Links never create grants.

## Source of every link
- `manual`: "Added by you" or "Added by you from People".
- `extraction`: "From <document> · page N · confirmed by you".
- Unconfirmed suggestions are never links. Possible matches are never auto-linked.

## Data
- `people`: existing canonical person, never duplicated by linking.
- `record_links`: id, record_id, record_type, person_id, role, role_other_text, source (manual|extraction), source_document_id, source_page, suggestion_id, created_by, created_at, removed_at.
- `extraction_suggestions`: id, document_id, record_id, page, extracted_name, extracted_role, match_person_id, match_kind (exact|possible|none), status (pending|accepted|edited|dismissed), decided_by, decided_at.
- `invitations`: existing; add statuses not_delivered, expired.
- Verification and `access_grants`: unchanged.
- Remove = set removed_at on that link only.
- Accepting a suggestion: create person (if new) + link in one transaction.
- Mobile: unsaved input kept on device until saved/discarded; cleared on sign-out.

## Fields
| Field | Rule |
|---|---|
| Full name | Required, 1–120 |
| Role | Required; type list or Other (1–60) |
| Relationship | Optional |
| Email | Optional; valid; required only to invite; exact match in People offers existing person |
| Phone | Optional; E.164 |
| Address, notes | Optional, under More details |

## Role words (to confirm)
| Record | Heading | Roles |
|---|---|---|
| Will | Executors | Executor, reserve executor, solicitor |
| Property, title deeds | People linked to this property | Joint owner, solicitor, managing agent |
| Bank account | People linked to this account | Joint account holder, adviser, bank contact |
| Investments, pensions | People linked to this investment | Financial adviser, broker, joint holder |
| Insurance | People linked to this policy | Beneficiary, broker, adviser |
| Business | People linked to this company | Business partner, director, accountant, adviser |
| Legal documents | People linked to this document | Solicitor, attorney, trustee, beneficiary |
| Digital | People linked to this account | Authorised contact, digital executor |
| Possessions | People linked to this item | Beneficiary, joint owner, adviser |
All types also offer Other.

## Audit (Record history)
link.created (with source, document, page) · link.role_changed · link.removed · suggestion.accepted/edited/dismissed · invitation.sent/resent/cancelled/not_delivered. Who, when, which record. No values or document text.

## Acceptance criteria
1. Owner saves a Will, adds Bob, Jane, Priya one at a time; all three show.
2. Same steps work unchanged on a bank account, investment, title deeds, insurance policy, company and personal item.
3. No link for an unsaved record.
4. Invite offer after each save; nothing sent without Send invitation on the confirmation step.
5. Person with no email can be saved.
6. Cancel/failure on the next person leaves earlier links unchanged.
7. Choosing from People never duplicates; one person can be on many records.
8. Every row shows its source.
9. Suggestions create nothing until confirmed; possible matches never auto-link.
10. Linking/inviting/verifying never adds an access grant.
11. Removing from one record leaves the person elsewhere and in People.
12. V5.2 accessibility: 13px min text, 44px targets, light + dark, labelled controls, logical focus order.

## Open questions
Role list per type · resend wait / expiry (drawn 7 / 30 days) · verification process · firm as person or organisation · which document types the reader scans.
