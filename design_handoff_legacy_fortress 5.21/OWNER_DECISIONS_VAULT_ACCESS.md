# Vault access — decisions needed from the owner (27 Oct 2026)

These are open. The design shows a proposal where marked "Drawn". Items 1, 3, 5, 7 and 9 need a solicitor's view.

1. **Grant of probate:** should "Wait for the grant of probate before releasing" be an option (drawn), the default, or not offered?
2. **Who can report a death:** the executor only, any nominee, or anyone connected to the owner?
3. **"Only if I lack mental capacity":** what evidence is needed, who decides (review team only?), and is the owner told first where possible?
4. **Access given during the owner's lifetime:** does it pause or end when a death is reported? (Drawn: paused until the release is decided.)
5. **Wills and attorneys:** exclude Wills from an attorney's scope (drawn), or show them read-only?
6. **What a nominee is told before release:** only that they're nominated and the kind (drawn), or also the scope?
7. **Estate release:** does it need confirmed executor authority (grant of probate), or is a verified death enough?
8. **Health and welfare LPA:** which Vault areas does it cover? There's no health area today.
9. **Checking the LPA register:** a reviewer by hand, or through the Office of the Public Guardian's service?
10. **Several nominees:** released together (drawn) or in an order the owner sets?
11. **Nominee invitation:** expiry (drawn: 30 days) and reminder timing.
12. **"View and suggest changes" when sharing now:** everyone, or professionals only?
13. **Data model:** approve `vault_nominations`, `vault_nomination_records`, `legal_authorities` and the proposed `access_grants` source fields (VAULT_ACCESS.md › Proposed data) before any build.
14. **Carried over from Linked People:** is a firm (e.g. a solicitors' practice) a person or an organisation?

## Owner answers — 30 Oct 2026 (Ivan, in conversation with Claude)
- 1 and 7. Grant of probate: **always wait for the grant of probate** before any estate release (not optional).
- 2. Who can report a death: **any nominee or executor**. Reporting alone never opens anything.
- 4. Access given while alive: **paused** when a death is reported, until the release is decided (designer's proposal accepted).
- 5. Wills and attorneys: **Wills excluded** from an attorney's scope (proposal accepted).
- 6. What a nominee is told before release: **only that they're nominated and the kind** (proposal accepted).
- 10. Several nominees: **released together** (proposal accepted).
- 11. Nominee invitation: **expires after 30 days** (proposal accepted).
- 13. Data model: **approved for TEST** (vault_nominations, vault_nomination_records, legal_authorities, access-grant source fields).
- Still open: 3 (evidence of lacking capacity), 8 (health and welfare areas), 9 (LPA register check), 12 (view and suggest changes), 14 (firm as person or organisation).
