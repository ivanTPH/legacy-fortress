# Legacy Fortress — Legal and Public Policy Requirements Matrix

Status: engineering requirements for legal and policy review; not final legal advice.

This matrix records the public-facing and operational documents required before production launch. Legal, privacy and security owners must approve the wording, jurisdictional scope, lawful bases, retention periods and controller/processor positions before publication.

| Document | Audience | Domain / processing | Owner | Required source work | Status |
| --- | --- | --- | --- | --- | --- |
| Platform Terms of Service | all users | account, vault service, acceptable use | Product + Legal | service model, liability, estate boundaries | Legal review required |
| Privacy Notice | users, contacts, representatives | identity, vault, estate, rights | Privacy owner | data inventory, lawful-basis map, recipients | Legal review required |
| Cookie Notice | site visitors and users | cookies, local storage, analytics | Privacy + Engineering | actual tracker/cookie inventory | Review required |
| Communications Notice | users and sponsored users | email, SMS, push and in-app messages | Product + Privacy | channel purposes and suppression rules | Policy approval required |
| Identity Verification / Biometric Notice | claimants and verified users | ID documents, camera, liveness, 1:1 comparison | Privacy + Security | DPIA, Article 9 condition, provider terms | DPIA/legal review required |
| Estate Access / Executor Terms | claimants, executors, advisers | death claims, probate, estate workspace | Estate operations + Legal | authority model and disclaimers | Legal review required |
| Enterprise Customer Terms | organisation customers | licences, sponsored entitlements, admin access | Commercial + Legal | controller/processor assessment | Legal review required |
| Partner/Sponsor Terms | partners and sponsors | cohorts, campaigns, aggregate reporting | Commercial + Privacy | data-sharing and marketing model | Legal review required |
| Data Processing Agreement | enterprise/partner controllers | processor services and instructions | Legal + Security | subprocessor and transfer inventory | Required before production |
| Subprocessor Schedule | customers and partners | hosting, database, messaging, IDV/KMS as enabled | Security + Privacy | confirmed production vendors | Required before production |
| Acceptable Use Policy | all users | misuse, unlawful content, abuse | Product + Legal | threat and support model | Draft required |
| Data Retention Policy | users, staff, customers | vault, identity, estate, audit and rights records | Privacy + Security | approved category schedule | Policy approval required |
| Information Security Policy | staff and customers as appropriate | access, encryption, incidents, recovery | Security | control framework and evidence | Security approval required |
| Incident and Breach Response Policy | staff and processors | detection, containment, assessment, notification | Security + Privacy | incident control plane and contacts | Operational approval required |
| Data Subject Rights Procedure | users and contacts | access, rectification, erasure, restriction, portability, objection | Privacy operations | case workflow and deadlines | Operational approval required |
| Staff Privileged Access Policy | staff/admins | support, recovery, exceptional access | Security | dual control and audit model | Security approval required |
| Encryption and Key Management Policy | staff, customers, auditors | envelope encryption, KMS, recovery | Security | production KMS/HSM design | Security approval required |
| Business Continuity / Disaster Recovery Policy | customers and staff | backups, restore, key recovery, outage response | Operations | tested RTO/RPO and restore drills | Infrastructure blocker |
| Complaints Procedure | users and customers | support, privacy, estate complaints | Support + Legal | escalation and response targets | Draft required |
| Probate / Estate Disclaimer and Terms | claimants and representatives | legal authority, non-advice, evidence | Estate operations + Legal | jurisdiction and professional advice boundary | Legal review required |

## Technical versioning requirements

Every accepted notice or term must record the policy identifier/version, effective date, acceptance timestamp, authenticated user, source/context, locale or jurisdiction where relevant, and the exact immutable acceptance-history reference. Material changes require reacceptance rules and must not overwrite prior acceptance records.

## Required pre-production approvals

- Complete the processing inventory and records of processing activities.
- Approve lawful-basis and special-category mappings for each enabled purpose.
- Complete DPIAs for biometric/IDV, partner targeting and other high-risk processing.
- Confirm controller, processor and joint-controller relationships and execute required agreements.
- Confirm international transfer mechanisms and subprocessor due diligence.
- Approve retention durations, legal holds and deletion exceptions.
- Review children/minors handling, deceased-person information, beneficiary data and third-party confidentiality.
- Review automated decision, AI/OCR and human-review safeguards.

The application provides enforcement and audit primitives; code alone does not establish legal compliance.
