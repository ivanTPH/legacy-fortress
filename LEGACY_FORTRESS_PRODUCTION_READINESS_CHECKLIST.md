# Legacy Fortress — Production Readiness Checklist

This is a gate, not a launch approval. Production deployment remains prohibited until each applicable owner signs off.

## Application ready

- [ ] Canonical `/`, `/access`, `/enterprise` and `/admin` routes are deployed and capability-protected.
- [ ] Deep-link authentication returns to the authorised destination without open redirects.
- [ ] Phase 1–5 security regression and focused tests pass.
- [ ] Database migrations are reconciled and rollback/forward procedures are documented.
- [ ] Error, locked, revoked, expired and unavailable-provider states are user-safe.
- [ ] Prototype/test-only routes are unavailable in production.

## Infrastructure ready

- [ ] Production Supabase, domain/TLS and Coolify deployment are positively identified.
- [ ] Production KMS/HSM or approved key provider is configured; staging provider is not promoted.
- [ ] Backups, restore drills, retention and recovery-key validation are evidenced.
- [ ] Email, notification, monitoring, alerting and external campaign providers are approved and tested.
- [ ] RTO/RPO, incident contacts and rollback procedures are operational.

## Security ready

- [ ] Penetration/adversarial testing is complete with material findings closed.
- [ ] Admin, enterprise, estate and recovery capabilities are least-privilege and dual-controlled where required.
- [ ] IDV provider, biometric processing and manual-review controls are approved.
- [ ] Session revocation, signed URLs, storage policies and audit append-only controls are verified.
- [ ] Security incident and breach response exercise is complete.

## Privacy and legal ready

- [ ] Governance requirements, ROPA, lawful-basis map and controller/processor map are approved.
- [ ] Privacy notice, terms, cookie notice, IDV notice and estate/enterprise/partner terms are approved and versioned.
- [ ] DPIAs, retention schedule, legal-hold policy and data-rights procedure are approved.
- [ ] Subprocessor, international-transfer and data-sharing reviews are complete.
- [ ] Marketing objection, consent withdrawal and suppression controls are operational.

## Operations ready

- [ ] Support, complaints, privacy rights, estate review and exceptional recovery runbooks are staffed.
- [ ] Monitoring dashboards, audit review and escalation procedures are live.
- [ ] Account recovery, estate suspension and restore procedures have been exercised.
- [ ] Data deletion/export jobs are dry-run tested, scoped and idempotent.

## Commercial ready

- [ ] Enterprise licensing, sponsor entitlement and partner terms are approved.
- [ ] Campaign governance, aggregate thresholds, suppression and delivery responsibilities are approved.
- [ ] Billing, contract, DPA and customer-support ownership are confirmed.

Current Phase 6 outcome must be reported separately from this checklist. A passing staging UAT does not approve production launch.
