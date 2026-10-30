# Update — 27 Oct 2026: Vault access and nominations (V5.2 addition)

Give this file to the coding agent. Read only what is listed. Your existing context for Vault Master V5.2 and Linked People stands.

Folder: `design_handoff_legacy_fortress 5.21/` (with " 5.21"). Ignore the older " 5.2" folder and `design/history/`.

## Read
1. `VAULT_ACCESS.md` in full: rules, fields, proposed data, acceptance 13–26, screen ids.
2. `AGENTS.md`, only the last section "Vault access and nominations (V5.2 addition, 27 Oct 2026)", rules 47–54.
3. `OWNER_DECISIONS_VAULT_ACCESS.md`: open items. Don't guess them.
4. Visuals: `design/V5.2 Vault Access - NN *.dc.html`, one file per section (01 overview … 10 build spec). Open only the section you're working on. Section 01 maps every element to the approved boards.

## What changed
- People & Access gets a **Vault access** tab, and the person page's Vault access card gets **Now** and **Later** rows.
- New flows: nominate for later (whole Vault or selected records), share selected records now, record a Power of Attorney, recipient states before and after release, review and stop access.
- Vault access is five separate facts; only Access (now) opens anything.
- Nothing approved is redrawn. Linked People 1–12 and PR 1 (`feat/v52-linked-people-data`) are unchanged.

## This is a design task first
Do not change the database, RLS, `access_grants`, identity verification or death-release logic until the owner approves the proposed data model (decision 13). When approved, work in this order, one PR each, stopping for review:
1. Data: nominations, nomination records, legal authorities, grant source fields, audit events, RLS (nominee sees kind and state only).
2. People & Access › Vault access tab and the person card's Now / Later rows (read-only lists).
3. Nominate for later flow (va-n2–n7, va-w3–w4).
4. Share now flow ending in the existing Give access (va-s1–s5).
5. Power of Attorney recording and status (va-l1–l8); reviewer activation stays in Platform Admin.
6. Recipient screens (va-r4–r9) and early-access requests into To do (va-v7).
7. Stop, cancel and withdraw (va-v2–v6) with Record history.

## Done when
Acceptance criteria 13–26 pass on iPhone (light, dark, largest text) and desktop, alongside Linked People 1–12. Log questions in `docs/design-implementation/QUESTIONS.md`.
