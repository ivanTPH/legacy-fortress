# Identity Verification Retention Model

This is a technical baseline, not a legal retention decision. Retention duration and lawful basis require formal privacy approval and must be configurable.

| Data class | Purpose | Baseline handling |
| --- | --- | --- |
| Request/decision status, purpose, assurance, policy version, timestamps | Reconstruct policy outcome and support status | Durable, minimum necessary |
| Provider/session reference | Correlate provider operations and callbacks | Durable, access-controlled |
| Document type/country and result categories | Explain decision without retaining document content | Durable only where necessary |
| Document number/hash, extracted attributes | Safe matching or audit where justified | Minimise; hash/category preferred; legal review |
| Raw document/MRZ/NFC evidence | Provider processing | Temporary private storage only; automatic deletion required |
| Selfie/video/camera frames | Liveness processing | Temporary private storage only; do not persist by default |
| Face template/embedding | Biometric comparison | Do not retain by default |
| Audit event metadata | Accountability | Durable but sanitised; never raw evidence or secrets |

The current schema includes an evidence-retention marker and cleanup service. A production-grade scheduled deletion job, monitoring, restore implications, and subject-rights process remain outstanding.
