# V5.2 Linked People compliance — PR 5 review, 29 October 2026

Authority: `design_handoff_legacy_fortress 5.21/LINKED_PEOPLE.md` and the approved A–H/S screens. **Implemented** means present in this branch; it does not mean hosted or installed-iPhone accepted. All record types use `LinkedPeopleSection` and `recordLinkedPeople`.

| Design screens | Implementation and focused evidence | Status |
| --- | --- | --- |
| A a1–a2: four separate states, source | `LinkedPeopleSection` invitation, ID and grant chips; manual/document provenance. `linked-people-record-section.test.mjs` | Implemented locally; hosted view pending |
| B b1–b4: empty/populated, add, row actions | Shared record section, compact cards, contextual add, action menu, role edit, unlink confirmation. Management tests | Partially implemented: exact card comparison and authenticated mobile still pending |
| B b5: dark | Shared V5.2 tokens; 320/390 WebKit light/dark geometry test | Partially implemented: authenticated dark screenshot pending |
| C c1–c9: record types and role words | `linkedPeopleConfig`; same component on eligible saved records; Will, Property and finance service tests | Implemented locally; full record-type visual sweep pending |
| D d1–d4: save first, empty, choose, picker | Saved record guard; mobile chooser sheet and full-height searchable picker with role chips. Service and WebKit geometry tests | Partially implemented: authenticated iPhone flow pending |
| D d5–d10: saved offer, confirm, repeat | Saved dialog, explicit invitation confirmation, Invite later, no-email path, repeatable independent links. Three-person Will test | Partially implemented: authenticated iPhone flow pending |
| E e1–e3: desktop side panel, invitation dialog, bank | Right panel for entry, centred saved offer, bank-specific heading. Chromium geometry test | Partially implemented: authenticated desktop comparison pending |
| F f1–f7: evidence-backed suggestions | Existing owner-scoped suggestion RPC; document title/page, possible-match comparison, explicit confirm/dismiss, atomic link. Suggestion tests | Partially implemented: document viewer page highlighting absent; real extraction/OCR intentionally deferred |
| G g1–g6: no email, later email, reuse, names, duplicate, failure | Optional email, canonical People edit route, other-record count, visible search details, Use existing person, retry recovery. Service tests | Partially implemented: later-email action opens People rather than in-place form |
| G g7–g10: delivery, pending, ID, cancel | Distinct statuses, canonical invitation request, checking-ID chip, draft discard confirmation. Service tests | Partially implemented: resend/expiry timing remains an open owner decision |
| G g11–g15: remove, offline, suggestions, wrong match, no access | Soft unlink confirmation, in-memory offline draft, independent suggestions, explicit match review, grant chip only for explicit scope. Management/suggestion tests | Partially implemented: unlink does not return an accepted suggestion to pending review; requires separately reviewed database change |
| H h1: reuse | Existing People, invitation, access, record and V5.2 token components/services reused | Implemented locally |
| S s1–s4: saving, fields, audit, acceptance | Existing owner-scoped link service, audit trigger and pending history RPC migration; focused Node and browser geometry tests | Partially implemented: canonical contacts have no address/notes fields; history migration needs separate approval; full hosted and iPhone acceptance pending |

No contact association, suggestion confirmation or invitation activates an explicit record grant. The pending history migration is `20261028234443_linked_people_history.sql` (SHA-256 `6ef3ae5a6069dc73625e3dbd532ff780b72aed866b427b9eea4f902344610983`). Do not deploy code depending on it before separate TEST approval and verification. OCR remains disabled.
