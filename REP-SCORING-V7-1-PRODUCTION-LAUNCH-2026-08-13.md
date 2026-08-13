# AI Closer Scorecard V7.1 — Production Launch

Date: 2026-08-13
Status: release verification in progress

## Approved outcome

This release replaces the V6.3 manager and live-scoring path with the validated V7.1 scorer. It completes the fixed historical cohort, presents a deliberately simple manager scorecard, continues scoring eligible future calls, and exposes the exact matching V7.1 score on existing Magic Mike Coaching Call 2+ reports.

## Historical cohort

- Fixed start: `2026-08-03T04:00:00.000Z`
- Fixed end: `2026-08-13T07:14:07.298Z`
- Source inventory: 1,660 eligible calls
- V7.1 worker: `QPUh149BvYlqhKOq`
- Final continuation: `80MLVQW3SdmxZzNH`
- Final continuation execution: `494026`
- Final continuation run key: `v7.1-final-460-continuation-2026-08-13`
- Final continuation admission: exactly 460 previously unfinished calls
- Dispatch: 46 batches of at most ten calls, in guarded waves of 20, 20, and 6 workers

Execution `494026` successfully dispatched all three waves and finished at `2026-08-13T12:14:16.602Z`. The one-time coordinator was then deactivated. Wave 1's 20 workers all completed successfully; the remaining bounded workers are reconciled before production cutover.

The continuation is webhook-only and protected by a database-backed atomic run key, exact per-call idempotency keys, active-lease checks, and a DeepSeek balance check. It cannot admit the cohort a second time after dispatch.

## Live architecture

- Live coordinator: `gXGkKGtsXPudAePR`
- Schedule: every five minutes
- Per-slot limit: 50 calls
- Worker concurrency ceiling: five workers
- Calls per worker: at most ten

The schedule frequency is not the concurrency level. A single-flight gate skips a scheduled slot whenever any unexpired V7.1 processing lease exists. Source or ledger read errors, provider balance failures, invariant violations, and duplicate candidates fail closed rather than dispatching uncertain work.

## Manager experience

The manager route remains `/manager/rep-scoring`, but its purpose is narrowed to a scorecard:

- closers are sorted from lowest to highest score;
- the default view requires at least 15 reviewed calls;
- search and 15+, 8+, 3+, and all-evidence filters remain available;
- the first table shows only closer, score, reviewed-call count, and review link;
- technical versions, backfill mechanics, validation counters, and priority jargon are removed;
- rep detail shows the score, Call 1 and Call 2+ split, evidence-supported recurring weaknesses and strengths, and lowest-scoring calls;
- call detail shows a manager takeaway, opportunity/outcome context, material improvements, strengths, and an optional collapsed score audit;
- raw JSON and empty technical sections are not rendered;
- route navigation has immediate progress feedback and deterministic scroll-to-top behavior.

The scorecard never forces a bottom percentile to look bad. Ordering is relative, while the displayed score and recurring findings remain absolute and evidence-backed.

## Magic Mike Coaching score overlay

The existing Coaching workflow and feedback generation are unchanged. The application performs a read-only lookup for Call 2+ and shows a V7.1 score only if all of these are true:

1. source Airtable record ID matches;
2. automation key matches;
3. scorer version is exactly `rep-reviewer-v7.1-shadow-1`;
4. call type is exactly `Call 2+`;
5. status is scored and the numeric score is valid;
6. the assessment is not internally inconsistent;
7. exactly one matching assessment exists.

Any lookup error or ambiguous result fails open: Coaching renders normally without a score.

## Rollback

- V6.3 workflows are preserved and are not edited in place.
- The V7.1 live coordinator is a separate workflow.
- Reverting the application commit restores the earlier manager and Coaching score source.
- If live scoring has a material fault, deactivate `gXGkKGtsXPudAePR` and reactivate the preserved V6.3 coordinator and worker.

## Completion evidence

Final cohort reconciliation, production deployment, live schedule proof, V6.3 deactivation, and production-alias verification are recorded here after the cutover gates pass.

Pre-cutover application verification: all 76 rep-scoring tests, ESLint, and the Next.js production build passed without a local development server. Draft PR `#162` contains the intended application and documentation scope. Vercel's Git integration returned an infrastructure-level preview error without build output, while an explicit deployment of the same commit built successfully and reached `READY` as `dpl_B2n27WiAwQECw8gU4sh6PwRjvNgU`; production is not promoted until cohort reconciliation passes.
