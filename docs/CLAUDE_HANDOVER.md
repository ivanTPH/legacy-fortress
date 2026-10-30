# Claude handover

Concise running state. Newest first. Codex history stays in `CODEX_HANDOVER.md`.

## 30 October 2026 (afternoon)

**Database migrations on TEST:** owner-approved files go through `.github/workflows/staging-migrations.yml`. Edit `ops/test-migration-request.json` (files + SHA-256, `mode: verify` first, then `apply`; bump `attempt`) and merge to the staging branch. The runner (`scripts/staging/apply-test-migrations.mjs`) refuses any URL other than TEST and the production cluster, checks hashes, runs each file in one transaction as the table-owner role (`supabase_admin`, as earlier migrations were) and records history. Results appear as workflow annotations (logs are not readable through the agent proxy). Applied 30 Oct: 090000, 090050, 090100, 090200.

**Verified on TEST (synthetic data):** Will upload → 6 correct suggestions (no testator or witnesses); confirm → person + role + provenance; remove → Undo; review again; re-confirm picks the existing person; one-step add with private address and notes. Statement → "This looks like a new bank account. Add it to your Vault?" → prefilled form with "Check these details are correct" → "Confirm and add to Vault" → statement filed on the new account (copy plus owner-style removal, because `documents_protect_original` makes document rows immutable).

**Synthetic TEST data created:** bank records Northfield (7781), Riverside (0234), Harbour (3419); People Mary Placeholder and Sam Testperson on "Synthetic Will (extraction test)".

**Open owner decisions:** none outstanding from today.

**Release path (works):** merge PR into `hosted-uat-preparation-20260715` → Coolify auto-deploys (≈10 min) → run `staging-release.yml` with `expected_sha` = merge SHA *after* `/api/version` shows it → workflow verifies SHA, IDV acceptance and Admin role boundary.

**Fixed: TEST kept reverting to an old build.** The Coolify TEST app (`yka9huzmm56hjpz1gno448fb`) had *Git commit SHA* pinned to `ec86be7` (24 Aug). The workflow's deploy webhook deployed the pinned commit ~40 s after each correct auto-deploy. Set back to `HEAD` on 29 Oct. If releases show an old SHA again, check that field first.

**Released to TEST (all gates passed):** PR #8 asset sequence, #9 Add to my Vault cards, #10 mobile Linked People sheet, #11 Vault-first sign-in + verified Admin/Partner/My Vault links, #12 Admin tokens + Overview per Admin Console board, #13 Partner light sidebar + overview per Partner board, account avatar/initials, #14 Vault dark mode — `globals.css` re-declared V5.2 tokens as fixed light hex in three `:root` blocks, overriding `tokens.css` dark/high-contrast values. Removed; legacy aliases now point at V5.2 tokens; ~1,350 hard-coded colours tokenised. Sidebar footer selected row matches nav. Verified on TEST in light and dark (desktop and iPhone size).

**Preserved work:** owner's uncommitted admin changes from the main local checkout are on `preserve/main-checkout-uncommitted-20261029` (not for merge as-is).

**Known pre-existing test failures (not caused by these PRs):** `admin-phase1-foundation` ×2, `admin-phase7-oversight-health` ×1, `auth-bootstrap-access` terms test, `category-dashboard-consistency` ×2, `legal-linked-contacts` ×2, two enterprise UI tests. They assert text removed in earlier releases; update or retire them deliberately.

**Environment notes:**
- Founder TEST launcher is unavailable on TEST: `TEST_FOUNDER_AUTH_USER_ID` is set on the Supabase service, not the app. The account-menu links (#11) replace the need for it.
- Cloud Playwright occasionally gets 404 for `/_next/static/chunks/app/(app)/legal/%5Bcategory%5D/...` through the agent proxy; the same page loads normally in a real browser. Not an app defect.

**Next:** finish V5.2 Vault drift review (record pages, forms, Add to my Vault, profile), mobile/dark screenshots; then database-dependent Linked People items (atomic contact+link save, timed Undo, suggestion re-review) — each migration needs the owner's explicit approval before it is applied to TEST.
