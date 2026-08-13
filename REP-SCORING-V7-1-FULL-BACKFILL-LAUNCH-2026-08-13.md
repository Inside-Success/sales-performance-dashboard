# Magic Mike Rep Scoring V7.1 — Full Backfill Launch

Date: 2026-08-13
Status: in progress; final audit pending

## Authorized cohort

- Fixed source window: `2026-08-03T04:00:00.000Z` through `2026-08-13T07:14:07.298Z`.
- Source inventory: 1,660 eligible calls.
- Finalized before this launch: 400.
- Authorized historical remainder: 1,260 calls.
- The historical cohort is fixed. Newer live calls are not admitted into this backfill.

## Launch architecture

- Worker: `QPUh149BvYlqhKOq`.
- One-time coordinator: `qGlK24KCNt42BlZ5`.
- Active coordinator execution: `493013`.
- Atomic run key: `v7.1-full-backfill-remaining-v3-2026-08-13`.
- Remaining run: 1,060 calls in 106 workers of at most 10 calls each.
- Dispatch: six sequential waves, with 20 workers per full wave and 6 in the final wave.
- Guard interval: 15 minutes between waves.

The first 200-call wave was supervised to completion before the remaining run was launched. It finalized all 200 calls and moved the ledger from 400 to 600 settled calls with zero active leases. The replacement run then reserved exactly the remaining 1,060 calls under one database-backed atomic lock.

The coordinator is webhook-only and has no schedule. It was deactivated immediately after the one-time launch so a second request cannot be admitted. Its already-running waiting execution continues to release the remaining waves. The V7.1 worker remains active only so those bounded sub-workflows can run.

## Initial verification

- Coordinator validation: valid, zero errors, 35 enabled nodes, and 34 valid connections.
- Worker validation: valid with zero errors.
- Production run-control deployment: `dpl_FnGjmXmEdEha7R2RGC1ERAqjrAyz`, `READY`, canonical alias attached.
- Run-control reservation: 1,060 selected calls and 106 worker batches recorded as `dispatched`.
- First remaining-run wave: exactly 20 workers dispatched.
- Early observed progress: ledger increased from 600 to 650 settled calls; 19 worker leases remained active; no duplicate or provider failure was observed.
- Existing V6.3 coordinator `EghbY2jr86yjJl4d`, V6.3 worker `w8JaLibcm8zqVGP1`, and Coaching workflow `L8Nn7xncA9ZPDdWA` were not modified.

## Safety behavior exercised

The first launcher layout exposed an n8n branch-order issue during the observation window. Its untouched waiting execution was cancelled after its initial bounded wave, before later waves could dispatch. A replacement attempt was then blocked by the active-lease guard, preventing duplicate scoring. The corrected coordinator uses a strict sequential chain and was launched only after the first wave reached zero active leases.

## Required completion check

After the expected processing window, verify all of the following before calling the backfill complete:

1. The fixed inventory reports 1,660 settled calls, zero active leases, and zero remaining eligible calls.
2. Coordinator execution `493013` has dispatched all six waves without an error.
3. All 106 remaining-run workers have reached a terminal state; fair transcript exclusions count as finalized, not failures.
4. No provider, balance, timeout, or duplicate-write failure cluster occurred.
5. The one-time coordinator and inventory workflow remain inactive.
6. Deactivate the V7.1 worker after the backfill is fully settled unless it is explicitly retained for a separate approved live path.

This launch record is operational evidence only. Final manager-readiness and score-distribution conclusions must wait for the completion audit.
