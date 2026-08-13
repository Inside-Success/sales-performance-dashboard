# AI Closer Scorecard V7.1 — Production Launch

Date: 2026-08-13
Status: live production cutover complete

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

Execution `494026` successfully dispatched all three waves and finished at `2026-08-13T12:14:16.602Z`. The one-time coordinator was then deactivated. All 46 workers completed successfully. The final reconciliation found all 1,660 unique source calls in a terminal V7.1 state: 1,483 scored calls and 188 fair terminal exclusions, with 11 extra stored rows caused by earlier calibration retries. The application collapses identical retries and excludes conflicting duplicates from manager and Coaching output; no historical row was deleted.

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
7. any retry rows agree on the assessment identity and score; a conflicting duplicate hides the score.

Any lookup error or ambiguous result fails open: Coaching renders normally without a score.

## Rollback

- V6.3 workflows are preserved and are not edited in place.
- The V7.1 live coordinator is a separate workflow.
- Reverting the application commit restores the earlier manager and Coaching score source.
- If live scoring has a material fault, deactivate `gXGkKGtsXPudAePR` and reactivate the preserved V6.3 coordinator and worker.

## Completion evidence

- Historical completion: all 46 final-continuation workers succeeded; no provider, balance, timeout, or worker-error cluster remained.
- Final score distribution: 12.3–85.4, median 80.6, mean 75.1; 428 scores are below 75 and 206 are below 60. No score is 90 or higher.
- Manager signals with sufficient evidence: 57 needs-attention, 1 coaching-focus, and 12 monitor results. These are absolute evidence rules, not a forced bottom percentile.
- Fair exclusions: 71 unmapped/insufficient speaker-resolution cases, 82 ambiguous multi-rep cases, and 35 calls with too few valid dimensions.
- Selective verification: all 246 calls which crossed the material-risk gate received the short verifier; ordinary calls were not double-scored.
- Live schedule proof: coordinator execution `494326` succeeded and admitted two post-cutoff live calls while admitting zero historical calls. Worker execution `494328` scored both calls successfully and finished in 139 seconds.
- Cutover state: V7.1 coordinator `gXGkKGtsXPudAePR`, V7.1 worker `QPUh149BvYlqhKOq`, and Coaching `L8Nn7xncA9ZPDdWA` are active. Preserved V6.3 coordinator `EghbY2jr86yjJl4d` and worker `w8JaLibcm8zqVGP1` are inactive. One-time launch and audit workflows are inactive.
- Application verification: 36 test files and 372 tests passed, ESLint passed, and the Next.js production build passed without starting a local server.
- GitHub: PR `#162` merged as `b82f0cfff9135eb539595606ad51a20432d37581`; duplicate fail-closed PR `#163` merged as `d0df69af92d8ef72291f160527787600ba63bf36`.
- Production: deployment `dpl_21Ak9JzkPWjmhZXu6p3QFgPkNHA5` is `READY` at `https://sales-performance-dashboard-rose.vercel.app`. The protected manager route redirects unauthenticated traffic to sign-in, and the post-deployment runtime-error query returned no errors.

The manager scorecard is ready for evidence-led review. It is useful for deciding whom to inspect and what to coach, but it remains supporting evidence rather than a standalone personnel-decision system.
