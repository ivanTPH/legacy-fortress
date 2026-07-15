# Phase 4C Live Deployment Identification

Date: 2026-07-13

## Repo Truth

- Current local branch: `uat-remediation-preview`.
- Remote: `origin` points to the Legacy Fortress GitHub repository.
- Local/remote branches observed: `main`, `uat-remediation-preview`, `origin/main`, `origin/uat-remediation-preview`.
- GitHub CI runs `npm run release:check -- --ci` on pull requests and pushes to `main`.
- Repo docs still refer to the production URL and prior Vercel/current deployment path.
- No Coolify config file, webhook config, checked-in deployment manifest or live app metadata was found that proves the current Coolify application branch.

## What Is Proven

The repository can identify branches and CI expectations, and it can provide a recommended UAT branch. It cannot prove the source branch/commit of the current live Coolify application.

## What Is Not Proven

- Current live Coolify application repository.
- Current live Coolify branch.
- Current live Coolify commit SHA.
- Current live Coolify domain mapping.
- Current build/start commands.
- Current environment group.
- Current database/storage/auth category.
- Auto-deploy status.
- Rollback availability.

## Owner Verification Checklist

The owner/operator must inspect the live Coolify application and record:

- Repository.
- Branch.
- Commit SHA.
- Domain.
- Build command.
- Start command.
- Environment variable group.
- Database category.
- Auto-deploy setting.
- Last successful deployment.
- Rollback target.

## Release Impact

Until this checklist is completed, the Phase 4C recommendation remains blocked from push/deploy.
