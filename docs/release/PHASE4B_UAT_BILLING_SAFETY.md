# Phase 4B UAT Billing Safety

Date: 2026-07-13

Billing is not ready for live-payment UAT.

## Required UAT Billing Model

Use one of:

- Stripe test mode with separate UAT products, prices and webhook secret.
- Billing disabled by feature flag.

## Prohibited

- Live Stripe secret keys.
- Production price IDs.
- Production checkout links.
- Production webhook endpoints.
- Production customer portal.
- Real payment methods.

## Current Repo Evidence

The product docs describe billing as future/partial. Environment templates use placeholders for Stripe values. UAT should keep billing disabled unless separate test-mode configuration and browser proof are approved.
