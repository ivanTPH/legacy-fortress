# Legacy Fortress Deployment Readiness Report

## 1. Broken Features Discovered
- Many navigation leaf routes were served only by catch-all category pages instead of explicit section pages.
- Legal category routes lacked dedicated data-backed list/manage pages.
- Auth redirects in app-protected pages frequently routed to `/` instead of `/signin`.
- Upload validation logic was duplicated and inconsistent across modules.
- Required runtime env validation was missing for Supabase public keys.

## 2. Repairs Implemented
- Added explicit legal routes:
  - `/legal`
  - `/legal/[category]` for all legal categories in navigation.
- Legal category pages now support:
  - listing existing records
  - add/upload entry points
  - edit links
  - delete action
  - document download
- Standardized protected-page auth redirects to `/signin` in app routes.
- Added shared upload validation utilities:
  - MIME/type enforcement
  - max-size enforcement
  - safe file-name sanitization
- Applied shared upload validation to:
  - Legal document upload
  - Profile avatar upload
- Added runtime env validation module and wired Supabase client to validated env.
- Added route audit script and env validation script for repeatable pre-deploy checks.
- Navigation cleaned so security/billing/terms/comms are no longer duplicated as bottom account links; these stay under Settings.

## 3. Remaining Configuration Required
- Configure OAuth providers in Supabase dashboard and env:
  - Google
  - Apple
- Configure Stripe secrets if billing flow is enabled in production.
- Confirm Supabase storage buckets exist with correct policies:
  - `vault-docs`
  - `avatars`

## 4. Environment Variables Needed
- Required:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Recommended (feature-dependent):
  - `GOOGLE_CLIENT_ID`
  - `APPLE_CLIENT_ID`
  - `STRIPE_SECRET`

## 5. Migration Instructions
1. Verify local DB target:
   - `supabase status`
2. Apply pending migrations:
   - `supabase db push`
3. Verify tables and RPC functions required by app are present.

## 6. Storage Setup
- Ensure bucket `vault-docs` is created and accessible for authenticated users under RLS policies.
- Ensure bucket `avatars` is created and accessible for avatar upload/read per-user.
- Confirm delete policies allow owner-only file deletion.

## 7. OAuth Setup
- In Supabase auth provider config:
  - Enable Google and Apple providers.
  - Register callback URL:
    - `https://<app-domain>/auth/callback`
    - local: `http://localhost:3000/auth/callback`

## 8. Stripe Setup
- If billing is enabled:
  - Set `STRIPE_SECRET` server-side.
  - Keep payment method updates in server-side handlers only.
  - Use Stripe customer portal/session creation on server.

## 9. Monitoring Recommendations
- Capture client and server errors (Sentry or equivalent).
- Monitor Supabase auth failures and storage errors.
- Add audit logging for invitation and role assignment state transitions.

## 10. Final QA Checklist
- `npm run audit:routes`
- `npm run validate:env`
- `npm run lint`
- `npx tsc --noEmit`
- Manual smoke tests:
  - Auth flow (signup/signin/callback/signout)
  - Legal category routes and CRUD + download
  - Dashboard links to detail/add pages
  - Upload validation for legal/profile
  - Settings pages under Settings nav
