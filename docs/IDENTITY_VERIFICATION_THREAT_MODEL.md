# Identity Verification Threat Model

| Threat | Control | Residual risk |
| --- | --- | --- |
| Stolen, forged, altered, expired, or replayed document | Provider authenticity/expiry result, server policy, bounded retry and review states | Provider coverage and document-country limitations |
| Printed photo, screen replay, recorded video, mask, deepfake, injected/virtual camera | Provider liveness/presentation-attack detection contract; explicit camera capture; no local AI claim | Requires an approved provider; simulator is not evidence |
| Stolen session or account takeover | Existing authentication, user binding, L3 freshness for high-risk actions | Authentication compromise remains possible |
| Attacker verifies for another account | Request is bound to authenticated `user_id`; server loads owner-scoped request | Compromised session needs separate account-security controls |
| IDV success bypasses invitation, probate, or access policy | Separate identity, relationship, legal-authority, estate, and access gates; terminal grants excluded | Future gates must consistently call central server policy |
| Replay/tampered provider callback | Future signed callback, timestamp, event-id idempotency, session/environment binding | Commercial provider contract and implementation are pending |
| Raw document/selfie/biometric disclosure | Private bucket, owner-scoped RLS, minimal API fields, sanitised audit metadata, short retention | Temporary evidence cleanup scheduling is pending |
| Admin overreach | Platform sees status metadata only; Enterprise has no raw IDV access; no manual activation path | Privileged support API requires continued capability review |
| Excessive provider retention or training use | Procurement requirements for deletion, residency, subprocessors, and provider data use | Vendor selection and DPIA are pending |

Residual risk is not a production-ready biometric assurance claim. Commercial provider assessment, legal approval, and operational controls are required before production use.
