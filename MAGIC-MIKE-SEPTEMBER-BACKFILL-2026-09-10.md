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
