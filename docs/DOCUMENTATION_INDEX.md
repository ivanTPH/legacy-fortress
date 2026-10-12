# Legacy Fortress Documentation Index

Status: canonical documentation map, 12 October 2026

This index identifies the documents to use for current development. It is
deliberately small: detailed phase evidence remains available, but it does not
override current product, security or architecture decisions.

## Authoritative current documents

| Area | Document | Use |
| --- | --- | --- |
| Product direction | [Roadmap and Entitlements](product/ROADMAP_AND_ENTITLEMENTS.md) | Delivery order, Free/Plus working specification and future mobile strategy |
| Customer language | [Product Copy Standard](PRODUCT_COPY_STANDARD.md) | Tone, terminology and customer-facing wording |
| Project context | [Project Context](../PROJECT_CONTEXT.md) | Product invariants, architecture boundaries and development discipline |
| UX and capture | [UX, Data Capture and Interaction Standards](specifications/Legacy_Fortress_UX_Data_Capture_Interaction_Standards.docx) | Shared interaction and input standards |
| Scope | [Inclusion and Exclusion Specification](specifications/Legacy_Fortress_Inclusion_Exclusion_Specification.docx) | Current product scope and explicit exclusions |
| Security and privacy | [Data Protection Governance](../LEGACY_FORTRESS_DATA_PROTECTION_GOVERNANCE.md) | Privacy, identity, access and governance requirements |
| Linked relationships | [Linked Fortress and Estate Access Architecture](architecture/LINKED_FORTRESSES_AND_ESTATE_ACCESS.md) | Relationship, access, IDV and estate-state boundaries |
| Build and release | [Build and Release](BUILD_AND_RELEASE.md) | Local validation and release discipline |
| Staging operations | [Staging Operations](STAGING_OPERATIONS.md) | Staging-only operating procedure and safety boundaries |

## Historical and evidence documents

Phase, UAT, release, audit and remediation documents remain in their existing
folders for traceability. They describe evidence or decisions at a point in
time and must not be treated as current product scope when they conflict with
the documents above. In particular, `docs/release/`, `docs/stabilisation/`,
`docs/UAT_REMEDIATION_TODO.md` and `docs/CODEX_HANDOVER.md` are historical or
operational records, not a second product specification.

The detached `/Users/ivan-imac/legacy-fortress-release` worktree is also a
historical/recovery snapshot. Its committed files must be preserved until the
repository owner explicitly completes a separate archival decision.

## Non-negotiable architecture rules

- One authenticated identity may own a Personal Vault and participate in many
  linked Fortresses; do not create relationship-specific accounts.
- People I Trust means people connected to the current user's Fortress.
  Linked Fortresses means other owners whose Fortress relationship is held by
  the current user.
- Relationship, invitation, account linking, identity assurance, legal
  authority and Vault access are separate state machines.
- RLS, `account_access_grants`, role assignments, recipient binding, IDV,
  death verification, probate, quorum, append-only audit and estate locking
  remain authoritative server-side.
- Death evidence is evidence for review, not an automatic access credential.
- New work must reuse canonical services/models and include negative security
  coverage. Legacy removal requires consumer discovery, migration, regression
  coverage and route/build verification first.

## Current delivery order

1. Finish invitation acceptance and Linked Fortresses.
2. Runtime-prove relationship and access isolation.
3. Complete production-grade biometric identity verification.
4. Build central Free/Legacy Fortress+ entitlement architecture.
5. Build subscription and trial UX.
6. Add premium asset limits and discovery.
7. Build Connected Estate and financial integrations.
8. Add a lightweight native mobile distribution layer.
9. Continue safe legacy retirement throughout.

## Documentation maintenance

Update the authoritative documents above when an approved decision changes.
Add dated phase or UAT evidence to the historical folders instead of creating
competing `FINAL`, `UPDATED`, or `V2` product specifications.
