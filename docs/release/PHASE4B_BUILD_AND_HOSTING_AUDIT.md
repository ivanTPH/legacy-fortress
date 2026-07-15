# Phase 4B Build And Hosting Audit

Date: 2026-07-13

## Framework And Package Manager

- Framework: Next.js App Router.
- Package manager: npm, with `package-lock.json` present.
- CI Node version: 20 from `.github/workflows/ci.yml`.
- No repo-level Dockerfile, Nixpacks file, Procfile, Coolify config or Node version file was found outside dependencies.

## Commands

- Install: `npm ci` for CI/Coolify, `npm install` for local development if needed.
- Build: `npm run build` (`next build --webpack`).
- Start: `npm run start` (`next start`).
- Local dev: load approved local env, then `PORT=3012 npm run dev`.
- Health checks: `/api/health`, `/api/version`, `/api/health/schema` when server-side Supabase admin configuration is present.
- Tests: `npm test`, `npm run test:core`, `npm run test:stabilisation`, `npm run lint`, `npm run test:e2e`, and focused Playwright specs.

## Coolify Runtime Settings To Configure

- Build method: Node/NPM or Nixpacks-compatible Node build.
- Node: 20.
- Install command: `npm ci`.
- Build command: `npm run build`.
- Start command: `npm run start`.
- Port: platform-provided `PORT` variable; Next `start` must bind to the platform port. If Coolify requires explicit host binding, set the start command to the smallest supported equivalent after testing.
- Health-check path: `/api/health` first; add `/api/version` for version proof. Use `/api/health/schema` only after UAT Supabase admin env is configured.

## Current Hosting Truth

Repo docs still describe Vercel as the current deployment path. The production branch is documented as `main` for Vercel. No repository evidence proves the live Coolify application branch or even that Coolify is currently configured for this repo.

## Risks

- `.env.local` may point to hosted services locally and is not the local-UAT source of truth.
- `next.config.ts` has local-only CSP allowances for local development. Production CSP does not allow arbitrary HTTP origins.
- Phase 4C added environment-controlled UAT banner/noindex implementation; see `PHASE4C_UAT_PRESENTATION_CONTROLS.md`.
- No Coolify-specific deployment config is checked in.
- Phase 4C proved production start schema health locally after fixing server runtime Supabase URL selection; repeat before UAT deployment.
