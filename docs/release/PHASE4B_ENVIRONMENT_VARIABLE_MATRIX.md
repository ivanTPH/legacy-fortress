# Phase 4B Environment Variable Matrix

Date: 2026-07-13

No values are recorded here.

| Name | Purpose | Timing | Exposure | Must differ UAT/production | Validation |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Browser-visible canonical app URL | Build/runtime | Public | Yes | Must match deployed UAT domain |
| `BASE_URL` | Smoke/browser test target | Runtime/test | Server/test | Yes | Must point to UAT/local target |
| `PLAYWRIGHT_BASE_URL` | Playwright target | Test | Test | Yes | Must point to target under test |
| `PORT` | Runtime listener port | Runtime | Server | Platform-specific | Must be platform-provided or documented |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser Supabase API URL | Build/runtime | Public | Yes | Must be UAT/local, never production for UAT |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser Supabase anon key | Build/runtime | Public | Yes | Must match UAT Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin/schema/demo/admin flows | Runtime | Server-only | Yes | Must never be exposed to browser |
| `SUPABASE_DB_URL` | Migration/schema checks | Runtime/operator | Server/operator | Yes | Must be UAT DB only |
| `LEGACY_FORTRESS_ENV` | Environment marker | Runtime | Server | Yes | Expected `uat` or `staging` for UAT |
| `ENABLE_EDGE_AUTH_REDIRECT` | Edge auth redirect feature flag | Runtime | Server | Environment-specific | Must be intentional |
| `NEXT_PUBLIC_ENABLE_TEST_PERSONAS` | Browser test persona flag | Build/runtime | Public | Yes | Disabled unless UAT explicitly approves |
| `ENABLE_INTERNAL_TEST_LOGIN` | Local/internal test login harness | Runtime | Server | Yes | Disabled outside controlled UAT/local |
| `E2E_USER_EMAIL` | Synthetic test account | Test | Test | Yes | Synthetic only |
| `E2E_USER_PASSWORD` | Synthetic test password | Test | Test secret | Yes | Never committed |
| `SMOKE_OWNER_EMAIL` | Synthetic smoke owner | Test | Test | Yes | Synthetic only |
| `SMOKE_OWNER_PASSWORD` | Synthetic smoke password | Test | Test secret | Yes | Never committed |
| `STRIPE_SECRET_KEY` | Stripe API key | Runtime | Server-only | Yes | Test-mode only or absent |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification | Runtime | Server-only | Yes | Test-mode only or absent |
| `STRIPE_CUSTOMER_PORTAL_URL` | Billing portal URL | Runtime | Server/browser if surfaced | Yes | UAT/test only |
| `GOOGLE_CLIENT_ID` | OAuth provider | Runtime | Public-ish | Yes | UAT OAuth app only or disabled |
| `APPLE_CLIENT_ID` | OAuth provider | Runtime | Public-ish | Yes | UAT OAuth app only or disabled |

Variables that must never be copied from production to UAT: service-role keys, database URLs, JWT/encryption secrets, Stripe live keys, webhook secrets, email provider credentials, storage credentials, OAuth secrets and analytics write keys.
