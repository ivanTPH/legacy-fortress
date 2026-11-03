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

## Vault access status (31 Oct 2026)
- Live on TEST: Vault access tab (nominations for later), Power of Attorney recording (pending check, owner can withdraw), nominee view (`/vault-nominations`, locked rows in the Vault switcher).
- Verified on TEST with synthetic person Sam Testperson: authority recorded as "Authority being checked · Not in effect", areas narrowed, no access created, then withdrawn (now under Ended).
- Since built and passing TEST acceptance (releases 44–54, 7 journeys): notifications to the person, share now with end date, early-access requests, death reporting by nominees with fresh ID capture, Admin review/activation of authorities (fresh attorney ID check), estate release by a person only (can ask for more evidence), Record history.

## Identity check and staff sign-in (31 Oct 2026)
- ID check: document photo + live selfie with random LEFT/RIGHT head turns; automatic face match (@vladmandic/human, server-side WASM) verifies clear matches; anything else, and every check tied to a death report or Power of Attorney, goes to a person in Platform Admin. Thresholds in `lib/identity-verification/faceAnalysis.ts` need calibrating on consenting real photos before production; a DPIA is needed before production.
- Staff sign-in: `/admin/sign-in` and `/enterprise/sign-in`, password then authenticator code (QR set-up on first use), 30-minute idle sign-out, 12-hour code freshness. Required by default (`lib/admin/access.ts`), including partners who come in through organisation membership; only a local dev server may set `STAFF_MFA_REQUIRED=false`. TEST acceptance proves authenticator codes work each release.
- Suggested-change approvals (7a–7f), the summary email and the organisation detail page were built on 3 Nov 2026 (see below).

## Owner review fixes (1–2 Nov 2026)
- Releases 55–68 on TEST. Phone checks in `tests/e2e/staging-admin-role-boundary.spec.ts` emulate an iPhone, tap through the Power of Attorney → attorney flow, list anything cut off at the screen edge, and write small screenshots into the job log (`Phone-shot:` lines, base64 JPEG) for design review.
- ID check: Settings › Verify your ID and Settings › Profile identity row; larger text, photo confirmations, back link; result email (`lib/identity-verification/resultEmail.ts`, never to synthetic addresses).
- Settings › Security to design p5m; owners can turn on two-step verification (switch); main sign-in asks for the code.
- Record people (va-p1), person panel (va-n1), three People & Access tabs (Sharing reached from Vault access). `?view=vault-access&setup=<person>` opens set-up for that person.
- Schema checks: `hasColumns` in `lib/schemaSafe.ts` (one request, shared in-flight); remember to export from the extensionless `lib/schemaSafe` shim.
- Not built: listing other signed-in devices (sign-in service doesn't expose it); mobile top bar still shows the Vault switcher on main pages.

## Approvals, summary email, organisation detail (3 Nov 2026)
- Suggested documents (owner decision 3 Nov: people the owner shares with, not the Partner portal yet). Migration `20261103120000_record_suggestions.sql`: `record_suggestion_permissions` (owner-only, separate from view scope; never grants viewing), `record_suggestions` + comments (owner and proposer read only; writes only through functions), private `record-suggestions` bucket (server only). Owner approves or rejects; a proposer can't decide their own. Approve: the server copies the held file into `vault-docs` and writes the document row as the System, then `lf_mark_suggestion_applied` (service role only). Every step goes to record history; notifications and emails carry no record details. Local test: `tests/sql/record-suggestions-local.sql`.
- UI: `/access-sharing?asset=` › "Who can suggest documents"; To do item "Review <name>’s document" → `/actions?review=<id>` (SuggestionReviewDialog); proposer page `/suggestions` (from the Vault switcher).
- Cleared notifications sync across devices: `20261103130000_notification_clears.sql` (own rows only), `lib/notifications/cleared.ts` falls back to this device if the table is missing.
- Summary email: `20261103140000_summary_email.sql`; Settings › Communications › Summary email (Monthly/Weekly/Off, Send me one now); daily `.github/workflows/summary-email.yml` signs an HMAC with the TEST service key (key never sent) and calls `/api/internal/summary-email/run`. Outside production only people who chose a frequency are emailed; production needs `SUMMARY_EMAIL_DEFAULT_SEND=true` and rows for people who never chose (not built). Turn off: `/email/summary-off?token=` (button, so link scanners change nothing).
- Organisation detail: Platform Admin page follows ADMIN_PARTNER (seats strip, details, administrators, members, activity, actions rail; Suspend/Reactivate need a reason). Partner detail: plain tab names, staged tabs removed, no licence creation or status changes for partners.
