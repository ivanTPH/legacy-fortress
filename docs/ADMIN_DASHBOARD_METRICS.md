# Admin Dashboard Metrics

The `/admin` dashboard uses `AdminDashboardSummary` from `lib/admin/dashboardSummary.ts`. Every metric has:

- `value`
- `available`
- `status`
- `definition`
- `source`
- `updatedAt`
- optional `warning`

Unavailable metrics must display `Unavailable`, never a misleading zero.

## Current Metrics

| Metric | Definition | Source | Notes |
|---|---|---|---|
| Total users | Valid authenticated customer accounts, excluding obvious system/service emails. | Supabase Auth admin listUsers | Aggregate only. |
| Active vaults | Profiles marked active where supported. | `user_profiles.account_status` | Unavailable if column/table is missing. |
| Incomplete vaults | Profiles not marked onboarding complete. | `user_profiles.onboarding_complete` | Uses current schema only. |
| Users with no will | Auth users without an active canonical Will asset. | Auth users + `assets` legal/wills | Legacy coverage should be reviewed before production reporting. |
| Stale wills | Active Will assets updated more than five years ago. | `assets.updated_at` | Review-date support is a future improvement. |
| Old documents | Documents updated more than five years ago. | `documents.updated_at` | Does not inspect document contents. |
| Users with no executor | Auth users without active executor contacts. | Auth users + `contacts` | Relationship rules need further hardening before production reporting. |
| Pending invitations | Invitation statuses queued/sent/delivered/opened/pending. | `contact_invitations` | Excludes accepted/revoked where represented. |
| Failed emails | Actual failed/bounced delivery events. | `invitation_events` | Not inferred from “not invited”. |
| Pending probate/death-certificate reviews | Cases in submitted/needs-information/under-review states. | `probate_cases` | No evidence contents exposed. |
| Open support issues | Open/pending/escalated support records. | `support_cases` | Unavailable until real support case schema exists. |
| Risk flags | Count of aggregate alert sources above zero. | Summary status | No customer-specific fraud/risk accusation. |
| Enterprise organisations | Placeholder. | Future enterprise schema | Unavailable in Phase 1. |
| Licence seats | Placeholder. | Future licence schema | Unavailable in Phase 1. |
