# Staging Send Email Hook Deployment Plan

This plan is staging-only for `test.mylegacyfortress.com` and
`supabase-test.mylegacyfortress.com`. It must not be applied to production.

## Components

- Hook endpoint: `POST https://test.mylegacyfortress.com/api/auth/send-email`
- Auth hook: self-hosted GoTrue `v2.186.0`
- Provider: Resend HTTPS API
- Sender: `Legacy Fortress Staging <staging@mail.mylegacyfortress.com>`
- Approved action types: `recovery`, `signup`, `invite`, `magiclink`
- Unsupported in the first spike: `email_change` because secure email-change flows may require two recipients and separate token/hash mapping.

## Staging secrets

Inject through the staging Coolify secret/configuration channel only:

- `RESEND_API_KEY`
- `RESEND_AUTH_FROM=Legacy Fortress Staging <staging@mail.mylegacyfortress.com>`
- `SEND_EMAIL_HOOK_SECRET`

The Resend key and hook secret must never be committed, printed, returned to the browser, or included in logs.

## GoTrue configuration

Configure the staging Auth container with:

```text
GOTRUE_HOOK_SEND_EMAIL_ENABLED=true
GOTRUE_HOOK_SEND_EMAIL_URI=https://test.mylegacyfortress.com/api/auth/send-email
GOTRUE_HOOK_SEND_EMAIL_SECRETS=<staging webhook secret>
GOTRUE_SITE_URL=https://test.mylegacyfortress.com
GOTRUE_URI_ALLOW_LIST=https://test.mylegacyfortress.com/auth/callback*,https://test.mylegacyfortress.com/reset-password
```

Do not remove existing SMTP variables until the hook has passed staging acceptance. Once enabled, GoTrue uses the hook rather than SMTP for the configured email flows; SMTP must not be presented as a silent fallback.

## Network and observability checks

1. Confirm Auth can reach the HTTPS hook over the staging network.
2. Confirm the hook can reach `https://api.resend.com`.
3. Confirm the hook rejects unsigned, stale, replayed and invalidly redirected events.
4. Confirm logs contain only event ID, action type, provider name, outcome, latency and provider-ID presence.
5. Confirm no token, token hash, recipient address, URL, body or secret appears in logs.

The initial staging deployment should remain a single Auth-to-hook runtime. The replay cache is process-local and is suitable for this controlled staging spike only; production deployment requires a durable replay/idempotency store or an equivalent single-instance guarantee before approval.

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
