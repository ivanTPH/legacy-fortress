# Legacy Fortress Web

Secure estate and legacy vault web application.

## Auth Source Of Truth

Supabase Auth is the only authority for:
- identity
- password authentication
- password recovery
- email verification
- session state

Application tables store profile/domain metadata only and reference auth users by `user_id` / `authUserId` patterns.

## Local Setup

1. Copy env template:

```bash
cp .env.example .env.local
```

2. Set required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. Install dependencies and run:

```bash
npm install
npm run dev
```

## Validation Commands

```bash
npm run lint
npx tsc --noEmit
npm run test:core
npm run audit:routes
npm run crawl:links
```

## Health Endpoints

- `GET /api/health`
- `GET /api/version`
- `GET /api/health/schema` (requires `SUPABASE_SERVICE_ROLE_KEY`)

## Deployment (Vercel)

1. Connect GitHub repo to Vercel.
2. Enable:
- production deploys from `main`
- preview deploys from PR branches
3. Configure environment variables in Vercel project settings (Preview + Production).
4. In Supabase Auth settings, add redirect URLs for:
- production domain
- preview domains
- `/auth/callback`
- `/reset-password`

### Non-technical review flow

1. Push branch to GitHub.
2. Open PR.
3. Vercel preview URL is created automatically.
4. Test auth flows and core routes in preview.
5. Merge to `main` for production deployment.

## Project Operating Rules

Reference these repo-truth docs before changing architecture:

- [Project Structure](./docs/PROJECT_STRUCTURE.md)
- [Build And Release](./docs/BUILD_AND_RELEASE.md)
- [Attachment And Document Architecture](./docs/ATTACHMENT_AND_DOCUMENT_ARCHITECTURE.md)
- [Known Tech Debt](./docs/KNOWN_TECH_DEBT.md)

Guardrails:

- Prefer shared/canonical workspace patterns over page-local CRUD.
- Prefer shared attachment/document components over new page-specific file UIs.
- Prefer config-driven asset fields where canonical field config already exists.
- Avoid introducing new legacy patterns when a shared component or helper already exists.
