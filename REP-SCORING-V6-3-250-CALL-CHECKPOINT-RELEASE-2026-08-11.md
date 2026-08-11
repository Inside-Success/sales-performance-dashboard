# Rep Scoring V6.3 250-Call Checkpoint — 2026-08-11

## Authorized scope

This release starts exactly 250 new V6.3 scoring attempts from the most recent seven-day eligible source window. It is a checkpoint before any larger backfill. It does not publish scores into Magic Mike Coaching, modify the source Airtable base, write to Google or Slack, alter the existing V6.3 scoring contract, or authorize the remaining backlog.

The previously completed 30-call V6.3 calibration remains preserved and excluded by the processing ledger. Successful checkpoint calls are immutable V6.3 score rows and therefore will not need to be purchased again if a later backfill is approved.

## Selection

- Launcher execution: `470533`
- Selected: exactly 250 unseen eligible calls
- Call mix: 180 Call 1 and 70 Call 2+
- Source coverage: seven Call 1 dates and eight Call 2+ dates in the rolling seven-day source window
- Selection is deterministic, balanced across source days and rep counts, and does not inspect score or sales outcome.
- Every existing V6.3 ledger key is excluded, including completed, quarantined, stale, or currently processing attempts.
- Any unexpired V6.3 lease stops the launch before dispatch.

## Safe concurrency architecture

### Existing V6.3 scorer

- ID: `w8JaLibcm8zqVGP1`
- Name: `MM Rep Scoring V6.3 - Realistic Anchors + Fair Attribution Worker (NO BACKFILL)`
- Change: none
- Behavior: processes ten calls sequentially, uses an idempotent processing ledger, and writes only to the isolated rep-scoring base.

### Five-lane coordinator

- ID: `jWbarQK4Bmw1u6pN`
- Name: `MM Rep Scoring V6.3 - Five-Lane 250 Checkpoint Lane Runner (NO SCHEDULE)`
- Trigger: Execute Workflow Trigger only; no schedule or webhook
- Layout: five batches of ten calls per lane, processed sequentially
- Parallel ceiling: five V6.3 scoring workers total
- Runtime ceiling: two hours per lane
- Failure behavior: a worker must return its successful terminal contract before that lane admits the next batch. A failed lane stops without starting its remaining batches; the ledger preserves completed calls and prevents duplicate charging.

### One-time launcher

- ID: `tR8o0NOmYvg1SDCz`
- Name: `MM Rep Scoring V6.3 - One-Time 250-Call Five-Lane Checkpoint Launcher`
- State after dispatch: inactive
- Safety gates: DeepSeek balance preflight, exact 250-call invariant, unique source-call invariant, exact 25 batches, exact five lanes, 50 calls per lane, five dispatches, and no active V6.3 leases.
- It cannot admit additional calls unless deliberately reactivated and invoked again.

Five workers were chosen instead of more than five. Five concurrent V6.2 workers had already completed successfully in production; a higher count has not been proven and would reintroduce avoidable n8n memory and crash risk.

## Dashboard

The hidden route `/manager/rep-scoring/v6-3-calibration` now shows only the approved checkpoint results in its main call lists and reports:

- terminal checkpoint progress out of 250;
- scored versus quarantined attempts;
- Call 1 and Call 2+ mix;
- median and score range;
- selective-verifier count and exact-100 count;
- criterion-status counts;
- individual evidence pages for scored calls.

Checkpoint quarantines are separated from the earlier calibration using the checkpoint launch timestamp. The earlier 30-call results remain stored and are summarized as preserved comparison evidence.

## Verification boundary

The launcher and lane coordinator validated with zero errors and zero invalid connections. The existing V6.3 worker also validates with zero errors. Advisory warnings are n8n Code-node and Split-in-Batches heuristics already reviewed against the intended fail-closed loop structure.

The launcher was disabled immediately after execution `470533` returned exactly five lane dispatches and 250 selected calls. The first observation window verifies that five lane executions and five V6.3 workers started concurrently. Final quality approval and any remaining backfill require a later read-only audit and explicit authorization.

Local verification completed without starting a development server: all 38 rep-scoring tests passed, scoped ESLint passed, and the Next.js production build passed with both protected V6.3 routes present. GitHub PR `#152` merged as `65af58b79d75193179745f401ce178b72bb22d3b`. Production deployment `dpl_9SWbhNP3EepsLa95TnVJFN8WW57j` reached `READY` and owns the canonical `sales-performance-dashboard-rose.vercel.app` alias. The protected checkpoint route returned the expected sign-in redirect when requested without a session.

The branch preview failed at Vercel resource provisioning before an application build began (`0ms` build). The same code passed the local production build and the subsequent Git-triggered production deployment completed successfully.

## Stop and recovery

To stop admission, deactivate lane coordinator `jWbarQK4Bmw1u6pN`. In-flight V6.3 workers remain bounded to ten calls and can finish safely. Re-running this checkpoint is not an approved recovery step; inspect the failed lane and ledger first, then construct only the missing-call recovery scope.

## Final recovery and checkpoint audit

The initial five lanes each reached the effective n8n execution ceiling after roughly 40 minutes. Twenty complete ten-call workers and partial fifth workers safely finalized 217 calls: 194 scores and 23 quarantines. The failed parents did not duplicate or corrupt stored results, but 33 selected calls remained unfinished.

The one-time launcher `tR8o0NOmYvg1SDCz` was converted into an exact recovery launcher with a preserved workflow-version rollback path. It reconciled the original 250 idempotency keys against the current ledger, hard-stopped while five stale leases were still active, and then dispatched only the 33 unresolved calls as four independent worker batches of 10, 10, 10, and 3. The successful launcher execution was `470988`; worker executions `470989`, `470990`, `470991`, and `470992` all completed successfully. The launcher was deactivated immediately after dispatch.

Final read-only audit workflow `tsXL87GX0C22DScl` is inactive and has no schedule. Its completed audit confirmed:

- 250 terminal calls: 226 scored and 24 quarantined;
- 160 scored Call 1 calls and 66 scored Call 2+ calls;
- mean score `80.5`, median `83.1`, range `49.0–88.2`, and 22 calls below 70;
- no scores at or above 95 and no exact 100s;
- no duplicate score keys, duplicate source records, score/quarantine overlap, or internal inconsistencies;
- high speaker-resolution confidence on all 226 scored calls;
- 17 selective reviews required and all 17 applied;
- six scores below a 0.60 weight denominator;
- 24 quarantines, primarily ambiguous multiple-rep attribution (16) or insufficient speaker mapping (5);
- 89 reps represented, but only 11 rep-and-call-type groups currently have at least three scored calls and none have ten.

The checkpoint supports proceeding to a bounded V6.3 backfill without another scoring-rubric iteration. Future backfill admission must use independent short workers or short waves rather than long-lived parents that wait across five sequential workers. Low-coverage scores must remain excluded or clearly withheld from rep-level decisions, quarantines must remain fail-closed, and score publication into Magic Mike Coaching remains a separate approval gate.

## Overnight bounded backfill launch

The approved unattended continuation is active in workflow `EghbY2jr86yjJl4d`, named `MM Rep Scoring V6.3 - Overnight 1500 Backfill + Live Refill (BALANCE-GATED)`.

- It scans only the approved source window beginning `2026-08-03T04:00:00.000Z`.
- Calls before the fixed launch cutoff `2026-08-11T00:59:55.000Z` count toward a maximum of 1,500 terminal historical V6.3 calls. If the approved source window contains fewer eligible calls, it stops when that source scope is exhausted.
- Calls arriving after the cutoff are prioritized and remain uncapped so live coverage continues independently of the historical limit.
- A clear wave admits at most 50 calls as five independent workers of at most ten calls each. The schedule checks every five minutes, but any active V6.3 lease causes a successful no-op; overlapping waves cannot be admitted.
- DeepSeek availability and an $8 balance floor are checked before source admission. Source, balance, and ledger failures fail closed and retry on a later scheduled slot.
- Completed idempotency keys are excluded, active leases are excluded, and stale or failed attempts remain safely recoverable.
- Historical selection balances rep and call-type coverage; it does not select by score or outcome.
- The existing V6.3 scoring worker, rubric, model, deterministic calculation, selective-review gate, quarantine behavior, and isolated Airtable destination are unchanged. V6.3 scores are not published into Magic Mike Coaching.

Workflow validation returned zero errors and zero invalid connections. The remaining warnings are reviewed Code-node, IF-branch, and long-chain advisories; the published graph contains 15 valid connections.

The first scheduled execution, `471271`, succeeded in about 16 seconds. It found 1,268 eligible source calls, observed 280 existing terminal V6.3 records, selected 50 unique historical calls, and asynchronously dispatched worker executions `471272` through `471276` as five batches of ten. Scheduler executions `471287` and `471300` each detected five active leases and exited successfully with `skip_active_wave`, proving the single-flight guard prevented overlap across two consecutive checks. During the ten-minute supervised launch window, all five workers remained healthy and had finalized 30 calls: 29 valid scores and one intentional fail-closed quarantine.
