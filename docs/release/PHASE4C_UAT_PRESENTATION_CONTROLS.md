# Phase 4C UAT Presentation Controls

Date: 2026-07-13

## Implementation

Environment-aware UAT controls were added through:

- `lib/environment/appEnvironment.ts`
- `components/internal/UatEnvironmentBanner.tsx`
- `app/layout.tsx`
- `app/globals.css`

The banner is controlled only by server environment categories such as `APP_ENV` or `LEGACY_FORTRESS_ENV`. Browser query parameters cannot enable it.

## Behaviour

- UAT-like environments show a visible `UAT / TEST ENVIRONMENT` banner on all routes.
- UAT-like environments emit `noindex`, `nofollow` and no-image-index robot metadata.
- Production mode remains unchanged unless explicitly configured as a UAT-like environment.
- The banner contains no secrets, project IDs or internal URLs.

## Tests

`node --test tests/uat-presentation-controls.test.mjs` passed.

Coverage:

- Banner/noindex mode activates from explicit server environment.
- Production mode does not set noindex by default.
- Query strings cannot enable UAT mode.
