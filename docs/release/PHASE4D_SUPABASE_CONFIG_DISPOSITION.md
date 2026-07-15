# Phase 4D Supabase Config Disposition

Date: 2026-07-14

## Outcome

Exclude entirely from release unless separately reviewed and approved.

## Diff Classification

| Area | Current Change Category | Release Disposition |
| --- | --- | --- |
| `project_id` | Local-UAT identity | Exclude |
| API/database/pooler/Studio/Inbucket ports | Local-UAT port range for isolated local stack | Exclude |
| `site_url` | Local review URL | Exclude |
| Additional auth redirect URLs | Local `127.0.0.1` / `localhost` review URLs | Exclude |
| Edge runtime | Disabled for local/dev reliability | Exclude |
| Inspector port | Local-UAT port range | Exclude |
| Analytics | Disabled locally | Exclude |

## Safety Notes

- The file contains local ports and local auth/email redirect behaviour intended for isolated local Supabase only.
- It is not a hosted UAT or production configuration.
- It should stay out of controlled commits unless a separate sanitised shared configuration is intentionally prepared.

## Controlled Staging Impact

Any future Coolify UAT or staging package must explicitly exclude `supabase/config.toml`, or split local-only developer setup into an uncommitted setup note.
