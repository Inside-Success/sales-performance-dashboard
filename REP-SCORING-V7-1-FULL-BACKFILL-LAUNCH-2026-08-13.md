# Magic Mike Rep Scoring V7.1 — Full Backfill Launch

Date: 2026-08-13
Status: completed and reconciled

## Authorized cohort

- Fixed source window: `2026-08-03T04:00:00.000Z` through `2026-08-13T07:14:07.298Z`.
- Source inventory: 1,660 eligible calls.
- Finalized before this launch: 400.
- Authorized historical remainder: 1,260 calls.
- The historical cohort is fixed. Newer live calls are not admitted into this backfill.

## Launch architecture

- Worker: `QPUh149BvYlqhKOq`.
- Earlier one-time coordinator: `qGlK24KCNt42BlZ5`.
- Earlier coordinator execution: `493013` (cancelled after 600 of its 1,060-call remainder was admitted).
- Atomic run key: `v7.1-full-backfill-remaining-v3-2026-08-13`.
- Remaining run: 1,060 calls in 106 workers of at most 10 calls each.
- Dispatch: six sequential waves, with 20 workers per full wave and 6 in the final wave.
- Guard interval: 15 minutes between waves.

The first 200-call wave was supervised to completion before the remaining run was launched. It finalized all 200 calls and moved the ledger from 400 to 600 settled calls with zero active leases. The replacement run then reserved exactly the remaining 1,060 calls under one database-backed atomic lock.

The earlier coordinator is webhook-only and has no schedule. It was deactivated immediately after the one-time launch so a second request could not be admitted. After it was cancelled, an exact continuation re-read the fixed inventory and V7.1 ledger and found 460 unfinished calls.

The final continuation is workflow `80MLVQW3SdmxZzNH`, execution `494026`, and database run key `v7.1-final-460-continuation-2026-08-13`. It selected exactly 460 calls, built 46 batches, and successfully dispatched guarded waves of 20, 20, and 6 workers. Execution `494026` completed successfully at `2026-08-13T12:14:16.602Z`; all 46 workers subsequently completed successfully and the webhook-only coordinator was deactivated. The V7.1 worker remains active as the bounded worker for the separately isolated live coordinator.

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

## Completion check

1. The fixed inventory contains 1,660 unique source calls and all 1,660 have a terminal V7.1 result.
2. Final continuation execution `494026` dispatched all three waves without an error.
3. All 46 final-continuation workers succeeded.
4. The terminal result contains 1,483 scores and 188 fair exclusions; earlier retry activity created 11 additional stored rows without leaving any source unfinished.
5. Duplicate reads now fail closed: identical retries collapse, while conflicting retries are omitted from manager and Coaching output. Historical evidence was preserved rather than deleted.
6. No provider, balance, timeout, or worker-error cluster remained.
7. The one-time coordinator and audit workflow are inactive. The V7.1 worker remains active only because it now serves the approved live coordinator.

The completion audit supports manager use: scores span 12.3–85.4, 428 are below 75, 206 are below 60, and sufficient-evidence aggregation produces 57 needs-attention results without forcing a percentile rule.
