# Identity Verification Provider Requirements

No vendor is selected by this foundation. Any provider must satisfy a documented security, privacy, product, commercial, and integration review.

## Security

- document authenticity and expiry checks for required countries/types;
- passive/active liveness and presentation-attack detection;
- resistance to replay, injection, virtual-camera abuse, and synthetic media;
- signed webhooks with timestamps, event IDs, replay protection, and idempotency;
- encryption in transit/at rest, access logging, incident response, and suitable certifications;
- documented data residency, subprocessors, and operational SLA.

## Privacy

- configurable deletion of raw document/selfie evidence;
- no training or secondary use without an approved basis;
- biometric template minimisation and non-retention where possible;
- UK GDPR/DPIA support, subject rights, deletion guarantees, and international-transfer safeguards.

## Product

- UK passports and driving licences plus required international documents;
- dynamically declared country/document support;
- accessible hosted capture or SDK for supported browsers/mobile devices;
- clear retry, technical failure, manual review, and camera-denied paths;
- provider status mapping into the Legacy Fortress neutral lifecycle.

## Commercial

- cost per check and retry;
- manual-review pricing;
- sandbox quality and deterministic test controls;
- volume limits, support, SLA, and exit/deletion terms.

## Architecture

- hosted capture preferred where it avoids raw-media retention;
- optional NFC/ePassport support where justified;
- API/webhook session binding;
- evidence metadata access controls;
- provider references that do not become user-facing secrets.
