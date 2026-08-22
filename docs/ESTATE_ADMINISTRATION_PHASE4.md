# Phase 4 Estate Administration Control Plane

Phase 4 adds a working estate-administration layer beside the immutable historic vault. It does not unlock or mutate the deceased owner's original vault records.

## Domain Separation

- Historic deceased vault: owner-created assets, records, documents and attachments. These remain read-only once the vault is protected or estate locked.
- Estate case: operational case record for estate administration. Its status is separate from `wallets.vault_lifecycle_state`.
- Estate workspace: post-death tasks, documents, valuations, liabilities, beneficiary working records and distribution records.
- Estate participants: each representative has their own identity, role, status and explicit permissions.
- Sensitive actions: high-risk requests use separate approval records and quorum checks.
- Recovery material: only wrapped/key-reference metadata is represented. No plaintext DEK, KEK or master key material is stored.

## Permissions

Estate participants receive explicit capabilities such as:

- `view_estate_case`
- `view_authorised_historic_data`
- `view_estate_documents`
- `download_estate_documents`
- `contribute_estate_document`
- `create_estate_task`
- `update_estate_task`
- `submit_valuation`
- `record_liability`
- `record_distribution`
- `request_sensitive_action`
- `approve_sensitive_action`
- `close_estate_case`

Roles such as executor, co-executor, solicitor, accountant, tax adviser, valuer, trustee and beneficiary do not imply broad access by themselves.

## Documents And Versioning

Estate documents are stored in the private `estate-administration-evidence` boundary. New contributions are appended as estate-administration records with uploader, timestamp, estate case, category, purpose, notes, prior-version reference and provenance. Historic vault originals are never overwritten or deleted by estate routes.

## Tasks, Valuations, Liabilities And Distributions

Estate tasks are practical workflow records and do not change legal/security states automatically. Valuations, liabilities and distributions are estate working records with provenance. They do not modify owner-entered historic values, liabilities or beneficiary information.

## Sensitive Actions And Dual Control

Sensitive actions use `sensitive_action_requests` and `sensitive_action_approvals`. The requester cannot approve their own request. Quorum counts distinct approvers excluding the requester. Critical recovery actions require fresh Level 3 presence.

## Emergency Security Controls

Suspension and revocation deny future RLS/API access and signed URL generation without unlocking the vault. Existing signed URLs remain short-lived and expire naturally. Emergency controls preserve evidence and audit records.

## Recovery Key Architecture

The Phase 4 schema prepares for encrypted-vault recovery with:

- `recovery_key_versions`
- `vault_recovery_material`
- `recovery_access_requests`
- `recovery_approval_events`

Only wrapped material references, algorithm versions, KMS references and validation status are stored. Production cryptographic recovery remains a future provider/KMS integration.

## Closure And Reopen

Closing an estate case restricts further contributions and keeps the historic vault locked. Reopen is a sensitive action requiring approval and audit; it does not make historic records mutable.

## Known Limitations

Phase 4 implements the canonical schema, service/API enforcement and staging UAT path. Real notification delivery and production KMS-backed recovery execution are prepared but not enabled.
