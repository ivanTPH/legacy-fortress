# Legacy Fortress — UK Data Protection, Access and Governance Standard

Status: Project governance baseline — 20 August 2026
Basis: ICO UK GDPR guidance and resources reviewed on 20 August 2026, including guidance updated following the Data (Use and Access) Act 2025. Some ICO pages state that further updates are in progress; this standard must therefore be reviewed before production release and after material ICO guidance changes.

> This is a product/technical governance standard, not a substitute for formal legal advice. Production launch involving biometric recognition, partner data sharing or direct marketing requires formal privacy/legal review and an approved DPIA where applicable.

## 1. Core architectural principle

Legacy Fortress is the controller of the personal vault service where it determines why and how personal data is processed. A sponsoring/licensing organisation does not become owner of a customer's wallet merely because it pays for an entitlement.

Partner access must be purpose-limited, role-based and server-enforced. Sponsorship, analytics access, data sharing and direct marketing are separate processing purposes and must not be collapsed into one generic permission or Terms & Conditions acceptance.

## 1.1 Canonical data domains and route boundaries

The application separates three logical domains:

- **Identity**: authentication, account identity, contact details and assurance state.
- **Vault**: private assets, records, documents, estate records and owner content.
- **Intelligence**: pseudonymous eligibility, aggregate reporting, campaign state and service metrics.

The Intelligence domain must not query raw Vault tables for partner analytics. Partner-facing routes are organisation-scoped and return controlled aggregate results by default. Canonical user-facing areas are `/` for Personal Vault, `/access` for estate/access workflows, `/enterprise` for organisation operations and `/admin` for system administration. Legacy internal aliases remain compatibility paths and must retain the same server-side capability checks.

## 2. Data protection by design and default

Every new feature handling personal data must identify before implementation:
- processing purpose;
- data categories;
- lawful basis;
- controller/processor/joint-controller position;
- recipients and sharing purpose;
- retention rule;
- individual rights that apply;
- security controls;
- audit requirements;
- whether a DPIA is required.

Only the minimum personal data necessary for the defined purpose should be collected, displayed, queried or exported.

## 3. Personal Vault and invited access

### 3.1 Relationship, role and permission are separate
Person types:
- Family / Loved One
- Professional Adviser
- Other Trusted Person

Roles may include:
- Beneficiary
- Executor
- Trustee
- Representative / Attorney
- Professional Adviser

Permissions are separate from roles:
- relationship/basic access state;
- view;
- download;
- contribute documents.

Only an eligible Professional Adviser may be granted `contribute documents` in the normal pre-death workflow. A contributed document must create a new immutable document/version and may not overwrite or silently replace an existing original.

### 3.2 Identity-gated activation
Protected access must require successful identity verification when the policy requires it. Invitation acceptance alone must not activate protected wallet access.

Target lifecycle:
`draft -> sent -> accepted -> identity_required -> verification_submitted -> verified -> active`

Exception/terminal states:
`delivery_failed / expired / revoked / rejected`.

Access enforcement must exist in server/API/database/RLS logic, not solely in UI components.

## 4. Biometric identity verification

Photo-ID plus camera facial/liveness matching used to uniquely authenticate an individual is biometric recognition and involves special-category biometric data.

Before production use Legacy Fortress must:
- document a UK GDPR lawful basis;
- document a separate Article 9 special-category condition;
- complete and approve a DPIA before processing begins;
- identify controller/processor roles with the identity-verification provider;
- execute appropriate processor/data-sharing agreements;
- minimise biometric data retained by Legacy Fortress;
- define retention/deletion for identity evidence and biometric outputs;
- provide a human/manual review route for false rejection, failure and exceptional cases;
- record the verification decision and evidence reference without logging raw secrets or unnecessary biometric templates.

A third-party IDV provider should be abstracted behind a provider interface. Homemade facial recognition must not be introduced as a shortcut.

## 5. Estate access after death

Normal invited access must not automatically become estate-administration access.

Target flow:
`estate_access_requested -> re-verification -> death certificate -> probate/authority evidence where applicable -> LF admin review -> approved/rejected/more_information_required -> estate_access_active`.

Admin review must record:
- claimant identity and LF account;
- original invitation and assigned roles;
- verification state;
- death/probate evidence references;
- decision;
- decision reason;
- reviewing administrator;
- timestamp and audit event.

Approved estate access may allow appropriate view/download/administration but must not overwrite or delete the deceased user's historic original documents. Post-death evidence must be recorded separately with provenance.

## 6. Enterprise sponsorship and partner analytics

A sponsored customer remains a Legacy Fortress customer and wallet holder.

Canonical relationship:
`Organisation -> Licence/Contract -> Registration Campaign -> Sponsored Entitlement -> LF User/Wallet`.

A licence funds entitlement; it does not transfer ownership or unrestricted access to the wallet.

Partner dashboards should default to minimum, purpose-limited readiness/engagement information. They must not expose underlying wills, asset values, financial documents, beneficiary details, notes or other vault content without a separately justified lawful purpose and authorisation.

## 7. Data sharing with partner organisations

Before any controller-to-controller sharing begins Legacy Fortress must document:
- the purpose of sharing;
- lawful basis;
- necessity and proportionality;
- categories of data;
- recipients;
- whether special-category data is involved and any additional condition;
- retention and onward-sharing restrictions;
- individual rights handling;
- security arrangements;
- audit trail;
- data-sharing agreement / joint-controller arrangement where applicable.

The platform must log material sharing decisions and actual disclosure/export events: who, what, recipient, purpose, lawful basis, when and how.

## 8. Direct marketing and partner marketing

Marketing must not be bundled into service Terms & Conditions.

The application must keep distinct records for:
- service Terms acceptance/version;
- Privacy Notice/version;
- sponsor relationship;
- data-sharing status/purpose;
- Legacy Fortress marketing preference;
- named partner marketing preference where applicable;
- communication channel (email, SMS/text, etc.) where required;
- consent/opt-out source and timestamp;
- withdrawal timestamp;
- suppression status.

For electronic marketing to individual subscribers, consent normally needs to be freely given, specific, informed, unambiguous and demonstrated by affirmative action unless a valid PECR soft opt-in applies. A third-party sponsor cannot assume it inherits Legacy Fortress's soft opt-in. The right to object to direct marketing is absolute and suppression must take effect across campaign selection and exports.

Analytics eligibility and marketing eligibility must be separate concepts.

## 9. Individual-rights administration

Legacy Fortress Admin must include a privacy-rights case management workspace. Requests may arrive through multiple channels and must not depend on a user finding a special form.

Required request types:
- access / SAR;
- rectification;
- erasure;
- restriction;
- portability;
- objection;
- withdrawal of consent;
- complaint/privacy enquiry.

For each case record:
- requester;
- identity-verification status appropriate to the request;
- request type and scope;
- received date/time;
- statutory due date;
- extension status/reason where permitted;
- assigned administrator;
- data sources searched;
- third-party data/redaction review;
- decision and legal/retention exception where relevant;
- response date and delivery method;
- immutable audit trail.

One calendar month should be the default operational deadline for rights requests unless the applicable rule permits extension. The system should calculate and surface deadlines, warn before breach, and retain the case decision record according to an approved retention schedule.

### SAR/export
Provide secure export of the individual's personal data and supplementary information. Do not expose other individuals' personal information without appropriate review/redaction.

### Rectification
Allow correction while preserving an audit history. Where data was shared with recipients and the law requires notification, record the recipients and notification outcome.

### Erasure
Erasure is not absolute. The workflow must distinguish:
- deletion required;
- deletion not required due to a documented applicable exception;
- restriction/suppression pending decision;
- data placed beyond use in backups until normal expiry where immediate physical deletion is not technically feasible and the approach is lawful/justified.

### Restriction
Support a state that permits storage while preventing normal use/processing of restricted personal data.

### Portability
Where the right applies, support a commonly used machine-readable export for data within scope.

### Objection/marketing suppression
Direct-marketing objections must produce immediate campaign/export suppression while preserving the minimum suppression record required to honour the objection.

## 10. Retention and deletion

Legacy Fortress must maintain a documented retention schedule by data category and purpose. Data must not be retained indefinitely 'just in case'.

Each relevant record should be capable of carrying or deriving:
- retention category;
- retention trigger;
- review/delete date;
- legal hold/exception reason;
- deletion/anonymisation outcome.

Admin tooling must provide:
- records due for retention review;
- deletion/anonymisation queue;
- legal-hold/exception control with reason and authorised user;
- evidence of completed disposal;
- backup-expiry handling.

Deletion of an application record and destruction of an evidential/original document are separate operations and must not be conflated.

## 11. Audit and accountability

## 12. Actual Phase 6 dependency inventory

The repository currently uses Supabase for authentication, database and private storage, and Coolify for the confirmed staging application deployment. The staging application is hosted at `test.mylegacyfortress.com` and uses `supabase-test.mylegacyfortress.com`. The codebase contains Stripe billing readiness metadata, but no enabled payment event should be inferred from that readiness layer. No analytics tag, marketing pixel, error-monitoring SDK, email delivery provider, IDV commercial provider or production KMS/HSM integration is treated as enabled by this inventory without separate deployment configuration and approval.

Browser persistence found in the application is limited to authentication/session mechanisms and functional local/session storage for preferences, test-only persona state and development diagnostics. Any future non-essential analytics or marketing tracker requires a consent-management decision and an updated cookie inventory. Local/test persona and diagnostic storage must remain disabled or unavailable in production.

Subprocessor and transfer records remain an operational pre-production gate. Before production, record the actual provider, purpose, data categories, environment, contract/DPA status, transfer mechanism and replacement seam for each enabled hosting, database, messaging, IDV, KMS, AI/OCR, analytics, monitoring and campaign-delivery dependency.

## 13. Accountability limitations

These requirements and application controls support privacy-by-design and auditable operations. They do not by themselves establish UK GDPR compliance, a lawful basis, a DPIA outcome, an approved international transfer, legal retention duration, or a certified biometric service. Those decisions require the designated privacy, legal, security and operational owners.

Use one canonical append-only audit/event service for security, privacy and access events.

Minimum events:
- login/security-sensitive events;
- invitation lifecycle;
- role/permission grant, change and revocation;
- ID verification lifecycle;
- document contribution/versioning;
- protected document download/access where policy requires;
- estate-access request and decision;
- partner data query/export/disclosure where material;
- privacy-rights request lifecycle;
- retention/deletion/anonymisation actions;
- consent/marketing preference changes;
- administrative impersonation or elevated access if introduced.

Audit records must not contain raw invitation tokens, passwords, unnecessary biometric templates or full sensitive documents.

## 12. Security controls

Apply risk-appropriate technical and organisational measures, including:
- encryption in transit and at rest;
- least privilege and RLS/server-side authorisation;
- short-lived/signed document access;
- separation of LF platform-admin and partner-admin privileges;
- secure secrets handling;
- logging and security-event detection;
- backup/recovery controls;
- regular access review;
- incident-response procedures.

## 13. Release gates

Production release is blocked until:
1. DPIA is approved for biometric recognition and other high-risk processing.
2. Lawful bases and Article 9 condition(s) are documented where required.
3. Controller/processor/partner roles and contracts are documented.
4. Privacy Notice and consent/marketing capture reflect actual processing.
5. SAR/rectification/erasure/restriction/portability/objection workflows work on real persisted data.
6. Retention schedule and deletion/anonymisation mechanisms are implemented and tested.
7. Access is server-side enforced and negative tests pass.
8. Partner tenant isolation and data minimisation are proven.
9. Audit records prove material access/sharing/privacy decisions.
10. Staging UAT passes before production deployment.

## 14. ICO sources reviewed

Primary portal:
https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/

Key guidance reviewed:
- A guide to lawful basis
- Data sharing: a code of practice — lawful basis, agreements and checklist
- Controllers and processors
- Special category data
- Biometric recognition guidance
- Data Protection Impact Assessments
- A guide to individual rights / subject access requests
- Storage limitation
- Accuracy
- Integrity and confidentiality (security)
- Direct marketing and PECR guidance, including electronic mail marketing

Review note: several ICO pages currently state that guidance is under review following the Data (Use and Access) Act. Re-check the ICO before production/legal sign-off.
## 15. Progressive consent and user-controlled communications — approved refinement 20 August 2026

Consent must only be used where it is the appropriate legal mechanism. Required service processing must not be disguised as optional consent. Optional/high-risk processing should be presented at the point it becomes relevant, with a concise explanation of purpose and user benefit.

Maintain distinct records as applicable for:
- required account/service processing and privacy information;
- sponsor-funded entitlement;
- Legacy Fortress marketing preference;
- named-partner marketing preference;
- permitted purposes/topics;
- communication channel;
- communication frequency/cap;
- withdrawal, objection and suppression;
- timestamp, source and policy/notice version.

A partner must not receive blanket marketing access to sponsored customers. Closed-loop delivery is preferred: the partner defines an approved audience/purpose, Legacy Fortress determines eligible recipients, enforces suppression/frequency rules and delivers the message without providing the partner an unrestricted customer list.

## 16. Risk-based identity assurance and step-up verification

Use three assurance levels:
- Level 1 — authenticated account/session;
- Level 2 — identity verified by photo-ID plus 1:1 live camera/selfie comparison under the approved verification process;
- Level 3 — presence re-verified by fresh liveness challenge and 1:1 comparison immediately before a security-sensitive action.

High-risk changes such as materially increasing another person's permissions, changing executor/trustee/representative authority, initiating estate access, or security recovery should require the policy-defined step-up level and must be enforced server-side.

A dynamic liveness challenge may request head movement/orientation or another randomised action and should be combined with anti-spoof controls where practicable. Biometric comparison remains probabilistic; borderline/failure states require retry/manual review rather than insecure bypass.

## 17. Internal experimental IDV before commercial provider

Legacy Fortress may use an internal experimental 1:1 identity-verification adapter during development and controlled UAT to avoid premature recurring provider cost, provided that:
- it is isolated behind the same `IdentityVerificationProvider` contract planned for production;
- verification records identify the provider and assurance class, e.g. `internal_uat` versus an approved production provider;
- it is not represented as government/document-authenticity certification;
- it does not rely on a central population face-search database;
- biometric data is minimised and transient embeddings/captures are deleted according to the approved policy unless retention is justified;
- DPIA, special-category governance and user information still apply to real biometric testing;
- production activation requires the approved assurance/provider decision and formal release gate.

General-purpose AI/document vision may assist OCR, field extraction, image-quality and consistency checks, but must not be described as authenticating an official identity document unless the implemented controls genuinely support that claim.

## 18. Death Lock, immutable estate state and fraud recovery

Death notification and estate access are separate security operations.

### 18.1 Vault state machine
`OWNER_ACTIVE -> DEATH_REPORTED -> PROTECTIVE_LOCK -> ESTATE_LOCKED`

`PROTECTIVE_LOCK` is a defensive state used while the death claim is investigated. It prevents ordinary mutation and can suspend risky sessions/access without asserting that death is finally established.

`ESTATE_LOCKED` is the post-death immutable state. The deceased owner's historical data must not be edited, overwritten, silently replaced or deleted through ordinary estate administration.

Post-death evidence and administration documents must be appended to a separate Estate Administration record with uploader, time, source, authority/context and version/provenance metadata.

### 18.2 Representative access state is independent
Representative/claimant access must have its own lifecycle, for example:
`invited -> identity_verified -> estate_claim_submitted -> under_review -> active_estate_access`
with `suspended / revoked / compromised / rejected` states.

Revoking or suspending a compromised representative must leave the deceased vault locked and immutable. A replacement representative can later be verified/authorised without reopening historical owner editing.

### 18.3 False or malicious death report
Legacy Fortress must support:
`DEATH_STATUS_DISPUTED -> OWNER_RECOVERY -> OWNER_ACTIVE`.

Owner recovery requires a security case, suspension of claimant/estate access, fresh high-assurance identity/presence verification, review of the suspected compromise, dual authorised approval, session/credential reset as necessary and immutable audit evidence. It must not be exposed as a normal single-admin toggle.

### 18.4 Emergency administrative controls
Authorised administrators require a narrow `Suspend Estate Access` control that immediately blocks new estate sessions, decrypt/recovery-key requests, downloads and additions while preserving all data and the current vault lock. Investigation can then determine whether representative access should be reinstated, replaced or the living owner recovered.

## 19. Encryption, key separation and estate recovery

Target security architecture is envelope encryption:
- each user/vault has one or more data-encryption keys (DEKs);
- application data/documents are encrypted with DEKs;
- DEKs are wrapped by separately protected key-encryption/recovery keys;
- encrypted application data and usable recovery keys must not be held in the same ordinary security boundary;
- key release must be least-privilege, purpose-bound, time-limited where appropriate and audited.

Estate recovery should use securely wrapped recovery material held in a separate security boundary, preferably using managed KMS/HSM or equivalent controls. Critical recovery/reinstatement operations should use separation of duties/dual control.

A scheduled job may reconcile key-registration/recovery coverage and flag any active vault lacking valid recovery material, but the platform must not depend on a weekly plaintext-key export to make a new vault recoverable.

## 20. Privacy-preserving intelligence domain

Where product analytics or partner targeting can operate without direct identifiers, store/query limited purpose-specific indicators against opaque internal identifiers and keep identity/vault data separated. Treat reconnectable pseudonymous data as personal data and apply UK GDPR controls.

Preferred partner activation:
`approved cohort definition -> Legacy Fortress policy/consent/frequency eligibility -> aggregate eligible count -> LF-controlled delivery -> authenticated user views relevant content`.

Do not expose names, contact details, detailed estate values, wills/documents or beneficiary data to a sponsor merely because a pseudonymous audience condition can be calculated.
