# Linked Fortresses and Estate Access Architecture

Status: current architecture reference, 12 October 2026

## Context model

One authenticated account may own `My Fortress` and hold accepted
relationships to multiple other owners. The current user selects a linked
owner context explicitly; the UI does not merge owner and recipient data.

`People I Trust` is the set of people connected to the current user's
Fortress. `Linked Fortresses` is the reverse direction: other owners whose
Fortress relationship is held by the current user.

## Separate state machines

The following are deliberately distinct:

`person recorded -> relationship/role -> invitation -> accepted -> account linked -> identity assured -> access granted`

Relationship explains why a person is connected. `account_access_grants` and
server-side RLS determine which records, if any, can be seen. Role assignment
does not grant living Vault access. Identity verification establishes identity,
not legal authority.

The canonical client projection is `lib/access-control/viewerAccess.ts` and
the canonical persistence/security surfaces include contacts, invitations,
role assignments, `account_access_grants`, permissions overrides, IDV
assurance and audit/event records. These projections are not substitutes for
database authorization.

## Estate access

The current estate lifecycle is separate from ordinary living access:

`linked relationship -> report/request -> evidence -> identity and relationship checks -> authority/probate/quorum review -> authorised estate access`

The existing estate lifecycle services and routes own death reports, evidence,
claims, vault lifecycle transitions, estate administration and audit events.
The customer journey may start a canonical case/request where policy permits;
it must not create a second estate-access model.

Death evidence is not an access credential. It must not automatically unlock
records. Estate locking, death verification, authority checks, quorum and
administrative approval remain authoritative before any protected post-death
access is activated.

## Current implementation status

- Linked Fortress list/detail and explicit context indicators are implemented
  in the current development branch.
- Zero-grant linked contexts suppress owner creation controls and inaccessible
  record sections.
- The staging IDV simulator is intentionally non-production and remains a
  bridge for testing the assurance state machine.
- Commercial biometric provider integration and full hosted runtime proof are
  future work.

## Legacy retirement rule

Legacy section-entry and compatibility paths remain where current routes still
consume them. Before removal, identify all consumers, prove canonical route and
data parity, migrate with rollback/regression coverage, then remove the old
path. A cleaner directory is not a sufficient reason to delete a security or
data path.
