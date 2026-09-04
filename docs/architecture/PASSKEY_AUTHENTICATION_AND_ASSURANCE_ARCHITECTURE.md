# Legacy Fortress — Passkey Authentication & Assurance Architecture

Status: approved project direction for continuous build; staging-first implementation and validation required before production enablement.

## 1. Product objective
Legacy Fortress should make secure sign-in simpler, faster and more phishing-resistant without confusing account authentication, real-world identity verification, legal authority or estate-access policy.

Passkeys are the preferred future primary sign-in experience. Password authentication remains an initial fallback until passkey compatibility, account recovery, multi-device use and hosted UAT are proven.

## 2. Assurance model
Legacy Fortress must preserve three separate assurance layers:

### L1 — Account authentication
Purpose: prove control of a Legacy Fortress account/session.

Preferred mechanisms:
- passkey / platform authenticator
- device-supported user verification such as Face ID, Touch ID/fingerprint, Windows Hello or device PIN
- password and recovery fallback during transition

Passkey authentication does not itself prove government identity, executor authority or access entitlement.

### L2 — Identity verification
Purpose: verify the person’s real-world identity where required for protected linked access or other policy-controlled workflows.

Production design may use a commercial identity-verification provider for:
- identity document capture
- document authenticity
- extraction/OCR
- liveness
- facial comparison
- privacy-controlled evidence lifecycle

The internal staging simulator must remain synthetic and must not collect real identity documents, selfies or biometric evidence.

### L3 — Fresh presence
Purpose: require recent re-authentication for high-risk actions.

A passkey/device-presence check is the preferred future mechanism where appropriate. L3 must be time-bounded and cannot create legal authority or bypass access policy.

## 3. Passkey UX direction
Default returning-user hierarchy:

1. **Continue with passkey**
2. Other ways to sign in
3. Email + password fallback
4. Account recovery

Primary wording should avoid technical WebAuthn/FIDO terminology. Recommended helper text:

> Use your device’s passkey — for example Face ID, fingerprint, Windows Hello or device PIN.

The interface must not claim that a biometric is always used because the authenticator may use a device PIN or security key.

## 4. Biometric privacy boundary
During passkey authentication, Legacy Fortress must not receive or store the user’s Face ID, fingerprint or platform biometric template. The local device/authenticator performs user verification and the service verifies the cryptographic credential response.

This is separate from L2 identity verification, where biometric processing may occur through an explicitly selected and governed commercial identity-verification provider.

## 5. Password transition and recovery
Passkeys should not initially remove all alternative sign-in methods.

Initial rollout:
- passkey preferred
- password supported as fallback
- recovery process retained
- unsupported browsers/devices remain usable
- users may register multiple passkeys where supported

Password removal, if ever adopted, requires a later explicit security/recovery decision after hosted adoption and recovery testing.

## 6. Post-authentication routing
Authentication establishes the person/session; it must not hard-code a Personal Vault destination.

Canonical post-authentication precedence:
1. validated internal `next` path
2. actionable pending invitation
3. accepted linked role requiring identity verification
4. role-specific required action
5. mandatory terms/security action
6. valid previously selected workspace
7. Personal Vault onboarding if genuinely incomplete
8. Personal Vault dashboard

Users with multiple contexts must not have workspaces silently merged. Where context is ambiguous, use an explicit workspace chooser.

## 7. Invitation and passkey journey
Target flow for an existing recipient:

invitation → Continue with passkey → correct account authenticated → invitation acceptance → bound L2 identity verification where required → role-aware workspace

If the passkey authenticates the wrong account, the invitation must remain intact and the user must be offered a safe account-switch path.

A pending role must take precedence over generic Personal Vault onboarding.

## 8. Credential management
Security settings should support a future Passkeys section showing privacy-safe credential metadata such as:
- friendly device/passkey label
- date added
- last-used timestamp where available

Actions:
- Add passkey
- Rename passkey
- Remove passkey

Credential removal and security-setting changes should require recent authentication/fresh presence.

## 9. Production safety and feature flags
Passkeys must be introduced staging-first behind explicit configuration/feature gating.

Before production enablement, prove:
- self-hosted authentication stack compatibility
- browser/device coverage
- sign-in and enrollment reliability
- recovery/fallback
- multiple credential behaviour
- wrong-account invitation handling
- workspace routing
- session policy
- security logging
- production deployment/runbook impact

Do not change production authentication configuration without explicit approval.

## 10. Continuous build programme
Passkey work is part of the continuing Legacy Fortress build programme, not a standalone security experiment.

Every relevant development iteration should consider the interaction between:
- Personal Vault
- Contacts/invitations
- Executor/linked-role workspace
- Enterprise administration
- Platform administration
- IDV/admin verification
- account/security settings
- session/workspace routing

The administrative dashboards and control interfaces remain active build areas and should evolve alongside authentication rather than being treated as finished.

### Continuous acceptance rule
For every major authentication or workspace change:
1. prove the correct staging target;
2. run focused automated tests;
3. run full build/type checks where available;
4. perform hosted browser UAT for the affected journey;
5. verify mobile/zoom/keyboard behaviour where relevant;
6. verify role, identity, authority and access remain separate;
7. verify no admin or enterprise role silently enters a customer vault;
8. record the exact final SHA and outstanding blockers;
9. do not call the phase complete while hosted acceptance remains blocked.

## 11. Administrative dashboard implications
Platform Administration must gain operational visibility without exposing secrets or biometric evidence.

Future account-security/admin capabilities should include privacy-safe status such as:
- passkey enabled / not enabled
- number of registered credentials where operationally appropriate
- last successful authentication method/category where lawful and useful
- recovery/security state
- session/security alerts

Normal administrators must never see:
- private key material
- authenticator secrets
- biometric templates
- Face ID/fingerprint data
- raw L2 identity evidence

Admin interfaces should support support and risk operations without becoming a credential-surveillance surface.

## 12. Current open implementation items
- prove the exact self-hosted authentication-stack passkey compatibility
- implement canonical post-auth destination resolver
- fix any remaining automatic-dashboard redirect behaviour
- add staging feature flag for passkey enrollment/sign-in
- add credential-management UX
- define L3 fresh-presence policy and time windows
- validate invitation + passkey + IDV end to end
- continue administrative dashboard/control-centre build
- close hosted browser acceptance gaps
- resolve release-gate dependency advisory separately from runtime authentication work

## 13. Non-negotiable architecture rules
- authentication is not identity verification
- identity verification is not legal authority
- legal authority is not access activation
- passkeys do not replace L2 IDV where policy requires real-world identity proof
- staging synthetic IDV must not collect real identity evidence
- security controls should reduce user friction without weakening role or data isolation
- production remains untouched until explicitly authorised


## 14. Current staging implementation status — Prompt 34 / SHA 302377e
Prompt 34 produced staging candidate `302377e` on `hosted-uat-preparation-20260715` with no database migration and no production access.

Implemented:
- existing authenticated visits to `/sign-in` no longer blindly redirect personal users to `/dashboard`;
- actionable pending invitations and validated internal `next` paths retain routing precedence;
- staging-only passkey enrollment foundation behind explicit non-production flags;
- browser-support detection and safe fallback messaging;
- password authentication retained;
- Security settings passkey enrollment UI;
- privacy wording that Face ID/fingerprint/platform biometrics remain local to the device/authenticator;
- regression tests for routing and production-safe passkey flags.

Current platform limitation:
- `@supabase/supabase-js` is `2.98.0`;
- available WebAuthn APIs support MFA enrollment/step-up helpers;
- a supported passwordless/discoverable passkey sign-in API is not available in the current stack;
- therefore routine passkey sign-in is intentionally not exposed.

Validation reported PASS for focused auth/invitation/IDV/workspace tests, full `npm test`, TypeScript, build, route audit, link crawl and `git diff --check`. `release:check` remains blocked by the separate transitive `eslint -> @humanfs/node` moderate advisory. Hosted staging/Auth capability verification and browser UAT remain outstanding.

### Continuous-build consequence
Passkey capability is a continuing workstream, not a gate that should pause the broader product build. Administrative dashboards, verification operations, Enterprise controls, access/probate interfaces, analytics, session/workspace controls and account-security tooling remain active parallel workstreams. Each iteration should preserve the L1/L2/L3 assurance separation and role/workspace isolation.
