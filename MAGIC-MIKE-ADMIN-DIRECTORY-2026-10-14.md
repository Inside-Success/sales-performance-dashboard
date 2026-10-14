# Magic Mike admin directory and leadership access — October 14, 2026

## Authorized scope

Owner approved implementation after reviewing Tyler's October 14 leadership-access and admin-panel threads in C0B402VSESY. The directory is a simple list without descriptions, matches the existing dashboard, and includes a link to the separate Mock Call Agent team admin page. External permissions are explicitly outside this scope.

## Implementation

- `/admin`: nine labeled links, clear Open arrows, responsive list, keyboard focus and a new-tab indication for the external link. Homepage Admin button is rendered server-side only for eligible accounts. Return links are present on manager and FAQ admin pages.
- Exact leadership roster: Rudy `rudymawerllc@gmail.com`; Rich `rich.allen@mawercapital.com`; Mike `mike@rudysmarketing.com`; Luke `luke@mawercapital.com`; Thomas `tom@mawercapital.com`; Timothy `timothy.dick@insidesuccess.com`; Fritz `fritz.rollins@insidesuccess.com`; Raul `raul.rios@mawercapital.com`. Also approved: Dagim `dagim.abate@insidesuccess.com`, Syed, Tyler's two existing company accounts and Jawad.
- `approved-admin-emails.ts` supplies exact sign-in exceptions and shared manager permissions. Rudy and Mike's domains are not opened to arbitrary users; Gmail cannot become an approved login domain even through legacy domain configuration. Existing exact-email sign-in grants remain supported.
- `admin-access-policy.ts` preserves REP_SCORING_ADMIN_EMAILS additively and extends the existing FAQ admin list with approved managers. Existing FAQ-only admins keep their original FAQ scope. No environment variable is replaced or edited, including the non-readable FAQ admin secret.
- All manager pages now have server authorization; the four formerly sign-in-only data pages also check before data reads. Both manager chat endpoints reject unsigned/non-admin requests before parsing input, reading data or calling a provider. Existing scorecard/detail gates use the same policy.
- Names are clearer while URLs remain stable: AI Coaching Sales Impact, AI Coaching Rep Usage, AI Coaching Closer Scorecard, AI Coaching Team Insights, Sales Compliance Review, Sales Call Rep No-Shows, Sales FAQ Usage, Sales FAQ Conversations, Mock Call Agent Team Admin.
- FAQ usage/conversation analytics and quality-review exclusions use the same effective admin list. Newly approved admin activity is excluded by the existing default admin filter; Include admin activity continues to expose it. Coaching usage and Sales Impact calculations are unchanged.

## Boundaries

No n8n workflow, source Sheet/Doc, stored report, compliance/scoring policy, model, API credential or external Mock Call Agent setting is changed. No Slack message is sent. No local development server or full backup copy is created. Prior production deployment and Git history preserve rollback without duplicating source data on the laptop.

## Verification before release

- 68 focused tests passed: all approved accounts, exact exceptions, denial of unrelated Gmail/Rudysmarketing accounts, legacy manager/FAQ permissions, company-rep FAQ access, per-page authorization before data reads, and both API authorization paths.
- Additional existing FAQ admin filters/rep-review and Sales Impact factual-answer tests passed.
- Scoped ESLint, git diff --check and full Next.js production webpack build including TypeScript passed.
- Other people's OAuth logins cannot be claimed as tested through the owner's session; exact-email policy checks cover their configuration.

## Rollback

Base main commit before changes: `8396515df0b18b9865fae20fe02e5a45b71a7133`. Prior ready production: `dpl_H1VLBXPvJWkAeJNSBhxf6L41BeYV`. Revert the scoped release commit through GitHub to restore prior page names and permission behavior. No database rollback or environment-secret restoration is needed.

## Release and live verification

- Implementation PR293 merged: `c11b3357c27390c322b42fa1ea5e356b0ab7bc63`.
- Production `dpl_HAzjyH7TpMeXsDWnGhf3ohw5U2A8` reached READY and holds the rose alias for that exact merge commit.
- Preview `dpl_8cMWP5em6SgE5s5gSEsraAW2GKgA` failed with Resource provisioning failed before application build, consistent with the known preview infrastructure issue. The local production build and actual production release succeeded.
- Signed-in owner session: homepage Admin button opens `/admin`; all nine labels/links match their targets. All eight internal pages loaded with data under their new names. External Mock Call Agent Team Admin uses its exact supplied URL, `_blank` and `noopener noreferrer`; external permissions were not touched.
- Directory desktop screenshot: `/tmp/magic-mike-admin-directory-2026-10-14.jpg` (55KB). Mobile at 375px: all nine links remain present, no horizontal overflow, profile and content remain inside document bounds. Viewport reset after QA.
- Normal coaching home, official report7846 including score/outcome/improvements, self-submitted report listing, and FAQ landing page load. No report or AI answer was generated for this release verification.
- Anonymous homepage/directory/manager/FAQ-admin requests redirect to sign-in. Both manager-chat endpoints return401 before any provider invocation. Non-admin authenticated denial is covered by policy, direct-page and endpoint tests.
- The final combined test run passed68 tests across12 files. Scoped lint, full production build/TypeScript and diff checks passed.
- The four production access variables retain their original IDs and update timestamps; no configuration secret was changed. Existing exact-email and FAQ-only permissions are retained.
- FAQ default 30-day Usage now shows48 questions from15 people, excluding newly designated admin activity (including Jawad's previously counted41 questions). Saved history is intact and Include admin activity remains available. Coaching and Sales Impact calculations were not changed.
- Latest report inspected was generated before this deployment. This verifies report reading and existing delivery data, not a new post-release real-call execution. Workflow/report generation was outside this scoped change.
