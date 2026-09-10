# September scoring backfill — September 10, 2026

## Authorized scope and queue

User authorized hosted execution, five workers, initial verification followed by autonomous continuation without Codex waiting for the full run. September 1 cutoff uses America/New_York: 2026-09-01T04:00:00Z. Live inventory contained 295 distinct scored source calls since that boundary; three already had passed bounded review and were omitted. Frozen queue: 292. Later natural calls continue through the unchanged production scorer.

Budget ceiling: $81. Measured historical estimate approximately $67–81. Each claimed job temporarily reserves $5 of worst-case headroom; this is not a charge. Actual provider-reported cost replaces the reserve on completion. The run pauses conservatively when there is insufficient remaining allowance. Uncertain failed requests retain a conservative estimate until execution reconciliation. No automatic repeat of an uncertain paid job.

## Hosted execution

- Dispatcher: QqO9VopWcGUOXslV — authenticated one-shot start, one-minute durable waits, at most five available slots, stops when the run pauses/completes or a stalled execution is detected. No recurring schedule/Codex automation.
- Worker: iC8zguHy3SbFc122 — restricted to that dispatcher, exact copied released scorer parameters, transcript read using Syed's existing Google Docs credential, result persistence through the dashboard's existing scoped credential.
- Failure recorder: sN4Nry0lnFoNcz5E — pauses the backfill and preserves reconciliation state; no notifications.
- Temporary inventory eoRTZ2o8y4XeO3Bh is inactive.
- Production scorer 35bFcPYdHSADpyTN remains version 06611470-8c48-4c12-989c-7531dfc848df; official coaching, provider, and persistence are unchanged.

Postgres tables mm_september_runs and mm_september_jobs hold the frozen queue, atomic claims, execution IDs, paid results, spend and progress. Claim SQL admits at most five jobs and reserves budget atomically. Claims are never automatically reclaimed. Computed results are stored before Airtable upsert, allowing storage-only recovery without another model call. Upsert targets the exact V2 Assessment ID and checks source, rep, date and returned score. Earlier V2 values are backed up privately; V1 records stay archived. Paid result failures are not misrepresented as passed reviews.

The first five calls are an automatic checkpoint (dispatch_limit=5). Full continuation must only be enabled after native output/persistence verification. To pause, set this run's state to paused; do not interrupt already paid in-flight work. To resume, inspect saved executions first, then raise dispatch_limit and set running. Start the authenticated dispatcher only if no previous dispatcher remains running/waiting. Do not reset all jobs or replay the paid scoring graph.

## Display

PR #182 merged; production deployment dpl_GrpuNwpQ1fUEzeERrK7hB43pu7kw is READY. The existing /manager/rep-scoring page shows a temporary auto-refreshing progress box. Only September 1 onward V2 scores whose factual-review revision is bounded-claims-2026-09-10 and status passed appear. This is stricter than the V2 version key alone. Older scores do not enter manager totals or rep-facing numeric scores. Coaching reports remain unchanged. Previous calibration routes redirect to the current manager scorecard. Manager evidence stays behind existing access checks.

## Verification

23 identity/display tests passed. A real database concurrency test sent 20 simultaneous claims, admitted exactly five distinct jobs, blocked further admission and restored all unspent test claims before paid work. TypeScript, scoped lint and webpack production build passed. Local default Turbopack could not follow the worktree node_modules symlink; the hosted production build succeeded. Preview resource provisioning failed independently before compilation, as prior previews also did; the production deployment used existing resources successfully.

Worker/dispatcher validation had no errors. Read-only native dry runs exposed n8n HTTP response serialization; dedicated parsers now read only the response buffer as JSON, never unused output-buffer memory. Dry run 703833 correctly reported paused. Authenticated browser verification showed progress 0/292, $0/$81 and only current reviewed scores. No paid work preceded that successful check.

Private operational evidence and rollback snapshots: ../.magic-mike-backfill-2026-09-10/. The baseline scores.json contains original score rows. Database queue schema and seed are in private seed.py; all connection secrets are loaded at runtime, never committed. Production rollback deployment before this release: dpl_8qX8SNDWjzRPp9mvXa1aUL6knJQd. Restoring old display should not be done silently: the user explicitly requested current-only scores.

## Canary passed; full queue released

Executions 703839–703843 completed all five initial jobs with passed factual reviews and scores 49.3, 60.3, 60.3, 37.8 and 64.5. Combined reported provider cost $0.962697. Independent Airtable re-read confirmed one exact V2 Assessment ID per source and exact score/review matches. Browser confirmed progress 5/292 with zero failures/exclusions and report /call/5679 showed 49.3 alongside unchanged historical coaching. Natural incoming calls also continued appearing in the scorecard. Official scorer, coaching and persistence active versions were independently rechecked unchanged.

Canary dispatcher 703838 completed normally at the automatic pause. The queue was then resumed with dispatch_limit=292, retaining the $81 ceiling and maximum five active claims. A new authenticated dispatcher was started; the run continues on n8n without Codex or this Mac. No recurring scheduler exists; its durable wait loop ends on completion, pause, or stalled work.

The control HTTP nodes use explicit response-buffer JSON parsing due to observed n8n serialization behavior; changing compression/version alone was insufficient. Do not remove that parser without native proof. Failure/storage uncertainty must be reconciled from saved job results/executions, never by blindly re-running the AI chain.

## Recovery update — 2026-09-10

Dispatcher 703917 hit a 40-minute timeout at 16:27:59Z. At interruption: 93 completed, 3 excluded, 12 review-required, 184 pending; $22.3590024 spent. The old `running` label did not prove active dispatch. Queue was explicitly paused for repair.

See `n8n/backfill-recovery/README.md` for the completion-driven dispatcher and bounded reviewer fixes. All 93 completed scores passed cached regression with identical numeric scores and unchanged coaching. Eleven held calls passed recovery; the remaining recording is an internal practice call, excluded using transcript evidence. Primary assessments were reused; extra recovery API cost is $0.510486. Temporary recovery workflows have no coaching/Slack/Google Doc mutation path.

Release/resume verification will be appended after the initial production batch. No full-backfill completion is claimed here.

## Verified recovery and autonomous resume — September 10, 17:32 UTC

- All 12 originally held jobs reconciled: 11 genuine calls recovered and saved; 1 internal practice call excluded with transcript evidence. Existing 93 completed numeric scores were not rewritten or regenerated.
- Ten resumed jobs completed under the published worker: 8 scores and 2 legitimate exclusions, zero review failures. Completion callbacks launched subsequent jobs successfully; dispatcher executions ended in seconds.
- Full remaining queue resumed with five workers and the original $81 ceiling. Latest database check: running, 124 started, 112 completed, 7 excluded, 5 claimed, 168 pending; $24.8428752 spent. These are point-in-time counts, not completion claims.
- Live score execution 704739 also recovered from its cached primary assessment after resolving Greg/Gregory's display-name alias. Score remains 65.5; Airtable upsert verified record rec3qsbjUOlNRfTaI. Incremental live-call recovery cost $0.055731 is separate from the September backfill ledger; no coaching report or Slack message was resent.
- Published scorer c2702d7e-b343-48de-9e67-5af48515d751; worker dfd874d1-1ca3-4918-a604-9e8fa4e50ee7; dispatcher 00a0e8fa-7bb4-4052-9d39-8f7dab4bedde.
- Official coaching, provider and persistence workflows retain their pre-repair published versions. Temporary cached-test and storage-recovery workflows CzkB25n8WqRruViG, KU7rP1IfIb8KwA9R and II41uKXUbEw0RX6z are deactivated.
- PR184 merged. Production deployment dpl_FD7bSY3LNGAV9MwSrB6ZP67cG5yx is READY. Fresh live scorecard browser showed five active workers, zero need-review jobs, and the correct spend/progress. 49 targeted tests and webpack production build passed. Preview deployment failed before build, consistent with the existing preview provisioning problem; production deployed successfully.
- Stop active observation after initial verification, as requested. The completion-driven queue runs independently, stops when exhausted, and keeps failed/uncertain records for review rather than silently assigning a score. No recurring Codex automation was added.

## Final review recovery and completion — September 11 PKT

The frozen September queue is fully reconciled: 292 processed, 280 scored, 12 ineligible, zero review-required/pending/active jobs. Provider-derived ledger total $63.9980676, including $0.341502 for this final repair; reserved=0, in_flight=0, run state completed. Fresh authenticated production scorecard independently displayed these totals.

Four held jobs were resolved from cached primary assessments: one incomplete reassessment decision set, two overly restrictive reviewed-citation heuristics, and one real stand-in closer attribution mismatch. Job211 is correctly attributed to Mark Jefferson based on his explicit introduction at transcript 00:03:54.230; original Louis attribution is preserved in the recovery audit. This is a scoped scoring correction, not a global alias or upstream transcript/compliance edit.

Published scorer 35bFcPYdHSADpyTN version 29b014fe-59bc-46f5-ac4b-96b72cd458ac and worker iC8zguHy3SbFc122 version 9d3e54a8-a5d9-4e11-983b-77efdf92443c now use n8n/review-completion. A known incomplete factual-review response receives at most one targeted Sonnet4.6 completion repair. Code requires every decision and limits changes to explicitly accepted fields; extra model fields cannot expand correction authority. Short quotations require exact source-turn support; unindexed evidence remains stricter. No extra AI call on the normal successful path, no retry loop, and no automatic resend after uncertain provider failure. Rubric/version, numeric weights/caps and current display policy are unchanged.

Validation: 57 scoped tests passed; all 276 previously completed scores passed cached regression with identical numeric values. All four repairs passed native n8n cached-input execution and verified persistence completion. Temporary CzkB25n8WqRruViG and KU7rP1IfIb8KwA9R are inactive. Official coaching, provider and persistence published versions remain unchanged. No coaching regeneration, duplicate Slack delivery, Google Doc edit or full backfill rerun.

Latest natural scorer execution checked,707435, passed review and validation before this final publication. No natural call on the newly published repair branch was observed at this checkpoint; native isolated execution verifies that branch. Unexpected source identity conflicts or unavailable evidence still fail safely rather than manufacturing a score. The known four-job backlog is cleared; this does not promise that every future external-data failure can be resolved without investigation.

Rollback snapshots and exact cached evidence remain private under ../.magic-mike-backfill-2026-09-10/review-final/. To roll back workflow code, restore that baseline and publish it; do not revert saved scores or run the paid queue again. Git changes contain node sources, tests and handoffs only; main merges still trigger the existing Vercel deployment.
