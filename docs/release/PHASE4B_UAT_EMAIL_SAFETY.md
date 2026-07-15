# Phase 4B UAT Email Safety

Date: 2026-07-13

UAT must not send arbitrary external email until explicitly approved.

## Approved UAT Patterns

Use one of:

- Hosted email capture service.
- Restricted sender and recipient allowlist.
- Test-only provider account with visibly marked UAT subjects.
- Email sending disabled with observable event capture.

## Email Paths To Control

- Account confirmation.
- Password reset.
- Contact/trust/executor invitations.
- Reminder/review notifications.
- Support messages.
- Probate/executor notifications.
- Failed-email reporting.

## Required Controls

- No production email credentials in UAT.
- No production unsubscribe/support links.
- No real customer, executor or contact recipients.
- UAT message templates must clearly identify the environment.
- UAT email events must be auditable without leaking private content.

## Current Readiness

Local Mailpit/Inbucket has been used for local UAT. No hosted UAT email capture or allowlist is proven from repo truth.
