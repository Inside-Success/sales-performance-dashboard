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
