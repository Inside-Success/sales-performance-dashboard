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
- Production build and hosted desktop/mobile/filter/rep verification: pending at initial commit; acceptance evidence will be appended after deployment.

## Safety and rollback

Started from current `origin/main` (`d986bf0`) in the existing clean adherence checkout, on an isolated scoped branch. Reviewed open PRs for overlapping changes; no unrelated checkout was edited. No local dev server was started. No source calls, accepted results, n8n executions or provider requests were created/changed.

Rollback is a scoped Git revert of this overview change; existing data and processing continue unchanged.
