# Staging Send Email Hook Deployment Plan and Phase 53 Closure

This plan is staging-only for `test.mylegacyfortress.com` and
`supabase-test.mylegacyfortress.com`. It must not be applied to production.

## Phase 53 status

**COMPLETE in staging.** The authorised recovery journey has been proven
end-to-end: request accepted, Resend delivery accepted, mailbox receipt
confirmed, recovery link opened, password updated, and subsequent sign-in
completed. The existing Auth identity, roles, vault data and access controls
were preserved.

The final application runtime used for the successful test was the staging
deployment lineage ending at `850cc7d`; `a773a79` is a test-only follow-up
commit. The exact currently deployed runtime must still be checked before any
future hosted change.

## Components

- Hook endpoint: `POST https://test.mylegacyfortress.com/api/auth/send-email`
- Auth hook: self-hosted GoTrue `v2.186.0`
- Provider: Resend HTTPS API
- Sender: `Legacy Fortress Staging <staging@mail.mylegacyfortress.com>`
- Approved action types: `recovery`, `signup`, `invite`, `magiclink`
- Unsupported in the first spike: `email_change` because secure email-change flows may require two recipients and separate token/hash mapping.

The hook is intentionally not enabled or verified for production. Production
must be configured and acceptance-tested separately before this architecture is
considered production-ready.

## Staging secrets

Inject through the staging Coolify secret/configuration channel only:

- `RESEND_API_KEY`
- `RESEND_AUTH_FROM=Legacy Fortress Staging <staging@mail.mylegacyfortress.com>`
- `SEND_EMAIL_HOOK_SECRET`

The Resend key and hook secret must never be committed, printed, returned to the browser, or included in logs.

`SEND_EMAIL_HOOK_SECRET` must be the complete Standard Webhooks value:
`v1,whsec_<standard-base64>`. The identical value is required by GoTrue and
the application verifier. Do not use only the Base64 suffix, URL-safe Base64,
or a value containing copied whitespace or quotes.

## GoTrue configuration

Configure the staging Auth container with:

```text
GOTRUE_HOOK_SEND_EMAIL_ENABLED=true
GOTRUE_HOOK_SEND_EMAIL_URI=https://test.mylegacyfortress.com/api/auth/send-email
GOTRUE_HOOK_SEND_EMAIL_SECRETS=<staging webhook secret>
GOTRUE_SITE_URL=https://test.mylegacyfortress.com
GOTRUE_URI_ALLOW_LIST=https://test.mylegacyfortress.com/auth/callback*,https://test.mylegacyfortress.com/reset-password
```

In Coolify, `GOTRUE_URI_ALLOW_LIST` is derived from the
`ADDITIONAL_REDIRECT_URLS` setting. Updating only the displayed generated
`.env`, or updating only one of these settings, is insufficient. The saved
Coolify value and the resolved Auth environment must agree before recreating
the staging Auth service.

The required Coolify redirect configuration is:

```text
GOTRUE_SITE_URL=https://test.mylegacyfortress.com
ADDITIONAL_REDIRECT_URLS=https://test.mylegacyfortress.com/auth/callback*,https://test.mylegacyfortress.com/reset-password*
```

The application continues to allow only the staging origin and the two
approved route families. A GoTrue fallback to another-origin `/` is rejected;
it must be fixed in Auth configuration rather than added to the application
allowlist.

Do not remove existing SMTP variables until the hook has passed staging acceptance. Once enabled, GoTrue uses the hook rather than SMTP for the configured email flows; SMTP must not be presented as a silent fallback.

## Network and observability checks

1. Confirm Auth can reach the HTTPS hook over the staging network.
2. Confirm the hook can reach `https://api.resend.com`.
3. Confirm the hook rejects unsigned, stale, replayed and invalidly redirected events.
4. Confirm logs contain only event ID, action type, provider name, outcome, latency and provider-ID presence.
5. Confirm no token, token hash, recipient address, URL, body or secret appears in logs. The temporary redirect diagnostic, when present, is limited to protocol, origin class, route class, slash, query and hash-presence flags.

The initial staging deployment should remain a single Auth-to-hook runtime. The replay cache is process-local and is suitable for this controlled staging spike only; production deployment requires a durable replay/idempotency store or an equivalent single-instance guarantee before approval.

## Resolved staging failure sequence

1. Direct SMTP egress from staging Auth timed out.
2. HTTPS delivery through the signed Send Email Hook and Resend was introduced.
3. An initial malformed `v1,whsec_` secret prevented Auth startup; it was regenerated and applied consistently.
4. Recovery requests then fell back to an unexpected root URL because the staging GoTrue site URL and redirect configuration were not aligned.
5. Correct `GOTRUE_SITE_URL` and `ADDITIONAL_REDIRECT_URLS` values restored the strict staging redirect flow.

## Remaining technical debt

- Production email-hook configuration and mailbox acceptance remain unconfigured/unverified.
- `email_change` is not enabled in the first implementation because its secure mode can require two recipients and reversed token/hash mappings.
- The in-memory replay cache is acceptable only for the controlled single-instance staging deployment; production requires durable replay protection or an equivalent deployment guarantee.
- SMTP remains an inactive fallback and must not be treated as healthy until egress is separately repaired and tested.

## Test sequence

1. Recovery request for the existing staging account.
2. Confirm Resend acceptance and mailbox delivery.
3. Open the link and verify `/reset-password` consumes the Auth session.
4. Update the password through the normal UI.
5. Sign in and verify the existing workspace, roles and vault access remain unchanged.
6. Test synthetic signup confirmation.
7. Test a supported Auth invitation flow.
8. Confirm provider rejection and timeout return non-200 to Auth without leaking details.
9. Confirm a repeated signed event uses the same idempotency key and is not duplicated by the provider.

## Rollback

1. Disable `GOTRUE_HOOK_SEND_EMAIL_ENABLED` in staging.
2. Restore the previously verified staging SMTP configuration only if SMTP egress has been repaired and explicitly approved.
3. Restart only the staging Auth service.
4. Verify Auth health and sign-in/recovery behavior.

Do not reset accounts, modify database records, delete volumes, rerun migrations, restart Docker, or touch production.
