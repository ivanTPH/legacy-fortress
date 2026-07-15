# Phase 4D Live Coolify Owner Verification

Date: 2026-07-14

## Status

Not completed in repo.

Repository state cannot prove which branch, commit, environment group or build settings the live Coolify application currently uses. This must be verified by the owner/operator in Coolify before any push or deployment decision.

## Owner Checklist

Complete this section in Coolify without recording secret values.

| Item | Value |
| --- | --- |
| Coolify application name | |
| Repository name | |
| Repository provider | |
| Active branch | |
| Deployed commit SHA | |
| Production domain | |
| Build method | |
| Install command | |
| Build command | |
| Start command | |
| Exposed/listening port | |
| Health-check path | |
| Auto-deploy enabled or disabled | |
| Deployment trigger type | |
| Last successful deployment date | |
| Last successful deployment commit | |
| Current environment group name/category | |
| Database/Supabase category | |
| Rollback available | |
| Current rollback target | |
| Persistent volumes present | |
| Production backups configured | |

## Owner Confirmation Block

```text
Owner verified:
Application:
Repository:
Branch:
Commit SHA:
Domain:
Date verified:
Verified by:
```

## Release Impact

Until this is completed and consistent, the recommendation must not exceed `SAFE TO CREATE CONTROLLED COMMITS — DO NOT PUSH`.
