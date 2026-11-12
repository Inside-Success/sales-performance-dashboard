# Script Adherence management overview — November 12, 2026

## Scope

Moonis authorized a simple top-level overview on the existing `/manager/script-adherence` page. Voice feedback is deferred. This is presentation-only: no workflow, AI model, provider request, scoring, policy, database schema, backfill, permissions or historical result changes.

## Behavior

- Existing overall action completion, assessed-call count and calls without a score remain at the top.
- Team overview shows completion by script family / call stage, followed by the five most frequently missed actions across all reps.
- Follow-ups rank by **number of calls** with an incomplete action, not by percentage. Each entry also shows its assessable-call denominator and rate. Script context and earlier/updated version labels prevent similarly named actions or changed requirements from being merged.
- Existing Video 1 / Video 2 cards now appear before the long rep list. Rep links, per-rep action details, recording evidence and pagination remain available.
- All new summaries derive from the existing full-filter aggregates, never the current twenty-call page. Date/show/stage filters apply consistently.
- Completed and incomplete actions form the denominator; unclear, deferred, not-required and historically excluded actions do not become failures. No assessable denominator displays a dash, not a fabricated zero or perfect score.
- Completion is the percentage of assessable **actions**, not the percentage of reps following the script. Incoming source/analysis status remains a separate disclosure; it is not mixed with assessed calls without a score.

## Verification

- 156 automated adherence/admin tests passed; the production-data integration test is opt-in and skipped in ordinary CI.
- TypeScript and scoped ESLint passed.
- Explicit read-only live integration passed: 3,517 saved calls; 1,746 assessed; 24,237 complete and 6,556 incomplete actions, 30,793 assessable. Script summary sums match overall totals, and changing call-detail pages preserves the same full summary. This is a time-specific observation, not a frozen production count.
- Production build passed. GitHub adherence regression gate passed (156 tests plus TypeScript); Vercel preview build passed.
- PR #431 merged as `3700b14f6f11ce3bc027e63116cb26e34a2a6f75`. Vercel production deployment `dpl_7ziktqK1qUHxnKeuW3oKxcxGC9v4` is READY on the expected project/team.
- Authenticated production verified at `https://sales-performance-dashboard-rose.vercel.app/manager/script-adherence`. Overall figures matched the pre-release baseline (24,237 / 30,793 actions; 1,746 / 3,517 assessed calls). Seven script/version rows and all five follow-ups displayed before the existing videos/rep list. No captured console errors.
- Live filter check: November 10–11, Entrepreneurs Island, Call 1 returned 1,508 / 1,875 actions and 102 assessed / 107 calls. The earlier and updated rows reconcile to that total; follow-ups show the selected script context. Page 2 preserved exactly the same team summary.
- Clicked Ahmed Iftikhar from that filtered view: filters survived in the URL, the rep page retained its individual 14 / 20 actions and both video statuses, and an individual call expanded with its recording link and action details. The new team overview does not appear on rep detail pages.
- Future empty date range returned a dash for completion and explicit no-assessable-data messages. Clear filters restored the full overview.
- Desktop visual check passed. At 390px, the new panels stack and remain readable; 320px had no document-level horizontal overflow. Temporary viewport overrides were reset. The existing rep table retains its own horizontal scroll on narrow screens.
- Local screenshots: `/tmp/magic-mike-adherence-overview-desktop.png`, `/tmp/magic-mike-adherence-overview-mobile.png`.
- Preview sign-in is intentionally unavailable on this project, so authenticated UI acceptance was done on production after the passing checks and scoped merge. No auth configuration was changed.

## Assessment

The requested management overview is live and the checked totals and navigation work. It adds no AI or n8n execution cost. This verification establishes accurate presentation of saved results; it is not a new accuracy audit of every historical AI classification. Existing owner processing-health warnings remain separate and were not changed or claimed resolved by this UI-only release.

## Safety and rollback

Started from current `origin/main` (`d986bf0`) in the existing clean adherence checkout, on an isolated scoped branch. Reviewed open PRs for overlapping changes; no unrelated checkout was edited. No local dev server was started. No source calls, accepted results, n8n executions or provider requests were created/changed.

Rollback is a scoped Git revert of this overview change; existing data and processing continue unchanged.
