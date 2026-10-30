# Vault access and nominations — V5.2 addition (27 Oct 2026)

Design: `design/V5.2 Vault Access - *.dc.html` (open with `support.js` beside them). Extends Vault Master V5.2 and V5.2 Linked People. Nothing approved is redrawn. On styling, Vault Master V5.2 wins; on record linking, `LINKED_PEOPLE.md` wins; security and data protection win over both.

**This is a design addition.** The data model in "Proposed data" identifies what is needed. Do not build database or access-control changes until the owner approves them (`OWNER_DECISIONS_VAULT_ACCESS.md`). Linked People PR 1 (`feat/v52-linked-people-data`, `ccde9021`) stays as it is.

## Five separate facts (replaces "four states" for Vault access)
| Fact | States | Changes when |
|---|---|---|
| 1 Contact and links | Contact saved · linked to N records | Owner adds, links or removes (Linked People) |
| 2 Invitation | Not invited · Invite sent · Not delivered · Expired · Joined | Owner sends; person accepts |
| 3 Identity | ID not checked · Checking ID · ID verified · ID check failed | Person completes Journeys 3a–3i |
| 4 Nomination (later) | Not nominated · Nominated · whole Vault / N records · Attorney · not in effect | Owner confirms, changes or cancels |
| 5 Access (now) | No access · Release in progress · Can see N records · Released · Access stopped | Permission service only |

Only fact 5 opens anything. Linked People's "Authorised" is now split into Nomination (later) and Access (now).

## Kinds of Vault access (va-n2)
- **After I die** (default for family): whole Vault or selected records, released only after the release steps.
- **Now, while I'm alive**: selected records (default) or whole Vault (warned); ends in the existing **Give access** save.
- **Under a Power of Attorney**: records a legal authority; three separate checks before it takes effect.
- **Contact only**: no access.

## Rules
1. Access is created only by the permission service: the owner's Give access, an approved release, or a confirmed and activated legal authority. Links, invitations, ID checks and nominations never create it.
2. A whole-Vault nomination is **one Vault-level record**. Never simulate it with record links.
3. Every confirmation states current access in words: "Access now: none" (nomination, authority) or "Access starts as soon as you confirm" (sharing now).
4. Before release a nominee sees only that they're nominated, the kind and the state. Never record names, counts, values, documents or scope.
5. Emails and notifications carry no record names, values or scope.
6. Release needs all four steps: death reported → evidence checked → death verified → release approved. The nominee must be ID verified. Reporting a death alone never opens anything.
7. Power of Attorney: the type limits what can ever be seen (owner may narrow, never widen). Identity, validity of the authority and "usable now" are three separate checks. Withdrawal stops access at once; other roles stay.
8. The owner can stop access, cancel a nomination or withdraw an authority at any time. Immediate, written to Record history, person told without details.
9. Whole-Vault scope includes records added later, minus the owner's exceptions. Exceptions are never shown or counted to the nominee. Saving a new record shows "Covered by N nominations for later · Keep out" (va-g11).
10. Other Vaults the owner is linked to, the Partner portal and Platform Admin are never part of Vault access.
11. Sharing now can have an end date; it stops automatically and shows in Ended.
12. An early-access request from a nominee becomes a Needs you item in the owner's To do. Nothing is shared unless the owner completes Give access.

## Where it lives
- People & Access › new **Vault access** tab: Can see now · Nominated for later · Legal authority · Ended (va-v1 mobile, va-w1 web). Rows open the person's access (va-v2, va-w2 side panel).
- Person page › Vault access card gains **Now** and **Later** rows (va-n1, va-n7). Primary action: Set up Vault access.
- Set-up: kind → scope → release → plain-English check → confirm (va-n2–n6). Web: one centred dialog (va-w3, va-w4).
- Each record keeps the existing access badges (AGENTS rule 27). Whole-Vault nominations aren't listed per record (va-s5 note).
- Recipient: Journeys 2 and 3, locked state in the Vault switcher (qm2, va-r5), release tracker (Journeys 6c, va-r7), released Vault (va-r8), ended states (va-r9).

## Fields
| Field | Rule |
|---|---|
| Kind | Required: after death · now · Power of Attorney · contact only |
| Scope | Required: whole Vault · selected records (at least 1) |
| Exceptions | Optional, whole Vault only |
| Wait for grant of probate | Optional switch — owner decision pending |
| Tell the person | On by default if they've joined; content-free notification |
| Permission (now) | View only (default) · View and suggest changes (approval path 7a–7f) |
| Documents (now) | Include each record's documents, default on |
| Until (now) | Until stopped · until a date (tomorrow or later) |
| Authority type | Required: LPA property and financial affairs · LPA health and welfare · Enduring PoA · General PoA · other |
| Authority document | Required (existing document upload) |
| Registered | Required: yes · not yet · not sure; reference optional |
| Usable when | Required; health and welfare is always "only if I lack mental capacity" |
| Areas | Pre-ticked from the type; can only be narrowed |

## Proposed data (identify only — needs approval)
| Table | Fields | Notes |
|---|---|---|
| `vault_nominations` | id, vault_id, person_id, kind (estate\|attorney), scope (whole_vault\|selected), view_level, release_condition (death_release\|death_release_and_probate), status (active\|cancelled\|released\|ended), notify_person, created_by, created_at, cancelled_by, cancelled_at, released_at | One row per person and kind. |
| `vault_nomination_records` | nomination_id, record_id, record_type, mode (include\|exclude) | include = selected; exclude = whole-Vault exceptions. |
| `legal_authorities` | id, vault_id, person_id, authority_type, registered, registration_ref, usable_when, restrictions_note, document_id, scope_areas[], status (pending_check\|confirmed\|needs_attention\|rejected\|withdrawn\|ended), activated_at, activated_by, withdrawn_at, withdrawn_reason | Encrypt registration_ref and restrictions_note. |
| `access_grants` (existing) | Rules unchanged. Proposed: source (owner_grant\|estate_release\|legal_authority), source_id, ends_at, paused_at | A whole-Vault grant may need a Vault-level grant type — flag, don't assume. |
| Access requests (existing) | New type: nominee early access | Owner decides. |
| Release (existing) | Reuse death report and probate review (Admin › Probate & deaths) | One release per Vault applies to all active nominations. |

RLS: owners see their own nominations and authorities; a nominee sees only their own nomination's kind and state through a narrow view (no scope, no records); reviewers through Platform Admin only; nothing across Vaults. Do not weaken existing `access_grants`, RLS, role boundaries, identity verification or death-release protections.

Audit (who, when, which; no values or document text): nomination.created/changed/cancelled/released · nomination.exception_added/removed · authority.recorded/checked/confirmed/needs_attention/activated/withdrawn · access.given/changed/stopped/ended/paused · early_access.requested/declined/shared.

## Acceptance criteria (adds 13–26; Linked People 1–12 unchanged)
13. From People & Access the owner nominates a person for the whole Vault after death; saved as one Vault-level nomination; no record links created.
14. A whole-Vault nomination includes records added later; exceptions are never visible or counted to the nominee.
15. A selected-records nomination covers only the chosen records; new records aren't added.
16. Confirming a nomination or recording an authority creates no access grant; the check screen says "Access now: none".
17. Before release, the nominee's screens and API return no record names, counts, values, documents or scope.
18. Reporting a death changes no access; access starts only after release approval, and only for an ID-verified nominee.
19. Sharing now grants access only on Give access, only to the selected records, and stops automatically on its end date.
20. Power of Attorney: access only when ID is verified, the authority is confirmed and activation is recorded; scope never exceeds the type; withdrawal stops access at once.
21. Stop access, cancel nomination and withdraw authority are always available to the owner, immediate, recorded in Record history; the person is told without details.
22. Executor, attorney, spouse, child, beneficiary or nominee status never grants access by itself (tested in combination).
23. Vault access never includes other Vaults, the Partner portal or Platform Admin.
24. An early-access request creates an owner To do item; nothing is shared unless the owner completes Give access.
25. Emails and notifications contain no record names, values or scope.
26. V5.2 accessibility on every new screen: 13px minimum, 44px targets, light and dark, labelled controls, logical focus order.

## Screen IDs
va-a1–a4 overview · va-n1–n7 nominate (mobile; dark n6) · va-w1–w4 web · va-s1–s5 share now · va-l1–l8 Power of Attorney · va-r1–r9 recipient (r9 dark) · va-v1–v7 review and stop · va-p1–p2 property · va-g1–g15 edge cases. The `va-` prefix avoids clashing with existing ids (Records Access uses p1–p3 and s1–s6).

| Need | Drawn in | Status |
|---|---|---|
| Linked people on any record; Will with three executors | Linked People B, C, D (d1–d10), E (e1–e4) | Reused |
| Existing or new contact; invite after saving | Linked People d2–d7; Vault Master qi1 | Reused |
| Document-extracted people | Linked People F (f1–f4); Vault Master u1, u2 | Reused |
| Identity verification | Journeys 3a–3i | Reused |
| Death reporting and release | Journeys 6a–6d | Reused; nominee view va-r7 |
| Record access sheet, avatar badges | Records Access 6m / W2; AGENTS rule 27 | Reused |
| Person Vault access card | README › Person panel | Extended (Now / Later) |
| Vault switcher locked state | Vault Master qm2 | Reused (va-r5) |
| Nominations, sharing now, PoA, recipient, review | This addition | New |
| Property with several people | va-p1, va-p2 | New example, existing component |
