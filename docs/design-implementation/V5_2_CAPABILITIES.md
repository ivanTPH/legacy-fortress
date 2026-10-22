# V5.2 capability findings (22 October 2026)

Baseline: TEST `/api/version` and remote staging both reported `291d4c72df576266069e01a97b13b34db6c6a680` before this work. These are source and implementation findings, not hosted security test results.

| Capability | Status | Evidence and limit |
| --- | --- | --- |
| Saved-record document/photo upload | Partially implemented | `DocumentsWorkspace` resolves a saved canonical asset, validates MIME and 15 MB size in the browser, uploads to `vault-docs`, then inserts a `documents` row. `UniversalRecordWorkspace` also has per-record attachment upload. Live upload was not exercised. |
| Retrieval and authorised download | Partially implemented | Document rows are filtered by owner and asset ID; download uses a signed Storage URL. Migration policies define owner and scoped linked reads. Hosted policy state and denial were not independently tested. |
| All Vault categories | Partially implemented | Canonical document workspace explicitly supports finances, property, business, digital and personal; other record forms have attachment controls. Legal/Wills and every attachment relationship need route-specific proof. |
| File type, size, malicious content | Partially implemented | Browser validation checks declared MIME and 15 MB size. It does not inspect file signatures or malware. Storage rejection/scanning is unverified. |
| Vault OCR, classification, structured extraction, field prefill | Not implemented | Vault upload saves the original file and metadata only. The extraction confirmation was presentation copy, now corrected. Identity-verification extraction is a separate workflow and cannot be treated as Vault document intelligence. |
| Bank, property or legal field-source evidence | Not implemented | No Vault extraction engine or evidence mapping exists. Synthetic accuracy cases therefore cannot be executed. |
| People matching from documents | Not implemented | No document-derived suggestions, ambiguity handling, invitations or automatic grants exist. |
| Adviser-submitted pending proposal and owner approval | Not implemented | Current contribution path uploads against a record; no verified proposal quarantine, review or apply transaction was found. This must not be represented as approved sharing. |
| Append-only record history and version references | Not implemented for ordinary Vault records | A last-updated timestamp exists. It is insufficient to claim a complete immutable history. |
| DESIGNATED_LOCKED, attorney identification-only and estate release | Security-gated | The undeployed privacy-policy branch defines planned controls. Current linked grants/storage policy must not be represented as enforcing the new model. |
| Recipient notifications and approval audit | Security-gated | The notification and privacy migration sequence remains separate from this UI package. Do not claim outbound email or approval events. |
| Founder TEST launcher | Blocked | Existing Admin master flag can derive from email. A protected founding-owner account-ID assignment/check and verified independent TEST sign-in destinations are absent. Direct `/dashboard`, `/admin` and `/enterprise` routes retain their existing guards. |

No real customer data was used. Hosted write, authenticated linked-user denial, upload, extraction and approval tests remain unverified. The next security release must reconcile migrations, restore-tested TEST backup, grant impact, RLS and Storage before SQL or deployment.
