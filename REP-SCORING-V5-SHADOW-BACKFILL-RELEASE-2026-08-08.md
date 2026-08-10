# Rep Scoring V5 Shadow Backfill Release

Status: live shadow validation and cumulative backfill started on 2026-08-08

## Purpose

V5 is now running against the complete eligible call population from the fixed July 18, 2026 launch date. It remains a shadow validation system while its score distribution and manager usefulness are evaluated. V4 data and workflows are retained as rollback evidence; the V5 idempotency and scorer version keep all new results isolated.

## Live architecture

- Coordinator: `uWfyXPrNDzQ2Eixe` — intentionally inactive pending DeepSeek recharge; its prepared schedule is every 15 minutes.
- Worker: `XPFqJlWGRRCiNqDn` — published as the cost-safe sub-workflow; it has no independent schedule.
- One-time inventory workflow: `0N7dBA07pMToS76S` — inactive after recording the baseline.
- Scorer version: `rep-reviewer-v5-shadow-1`.
- Fixed source start: July 18, 2026. Calls before that date are excluded.
- Stable launch inventory: 3,328 eligible calls under the existing processed-transcript, valid-sales-call, normal-attendance and confidence rules.

Each clear coordinator run admits at most 80 calls. It creates no more than eight worker executions, with ten calls processed sequentially inside each worker. The coordinator reads a rotating two-day historical shard plus the newest two hours. The next 15-minute slot performs a lightweight lease check first; if any prior V5 worker is still active, that slot succeeds as a safe no-op instead of starting an overlapping batch. With every slot clear, the dispatch ceiling is 320 calls per hour; skipped busy slots intentionally reduce that rate to protect n8n and prevent duplicate work.

## Cost-control update — August 10, 2026

The coordinator is intentionally inactive while the dedicated DeepSeek balance is unavailable. The validation backfill now has a hard ceiling of 1,500 finalized calls rather than attempting the complete 3,328-call inventory. Before any future dispatch, the coordinator checks the official DeepSeek balance endpoint, the latest coverage snapshot and active leases. Unavailable balance, unavailable coverage, an active worker wave or a reached target all fail closed without dispatching calls.

Provider failures are retryable outcomes and no longer inflate completed progress. A primary provider failure bypasses the verifier, preventing a second unnecessary model request. Existing provider-error quarantine records remain available for diagnosis but their calls become eligible again after recharge; a later valid score safely shadows the earlier failed attempt.

Every call keeps an immutable scorer-version idempotency key and a one-hour recoverable lease. Network reads and writes use bounded retries. A worker failure therefore cannot duplicate a completed assessment, and an abandoned lease becomes eligible for a later retry.

## V5 fairness contract

- Transcript reliability is evaluated before rep performance. Missing, corrupted or unfairly incomplete evidence cannot become a low rep score.
- Prospect opportunity and external factors are recorded separately from controllable rep execution.
- Call 1 rewards the correct progression decision. Advancing a suitable prospect and intentionally rejecting an unsuitable prospect can both be excellent.
- Difficult prospects, repetition and call duration are judged contextually rather than penalized automatically.
- Only applicable and fairly observable script-aligned checkpoints enter the deterministic score.
- Primary findings require an independent verifier. Material disagreement withholds the number from rep averages instead of manufacturing a low score.

## Main manager page

The production manager route remains `/manager/rep-scoring`. It now supports V5 checkpoint fields, excludes withheld results from averages, exposes the full 3,328-call progress denominator, and adds a visible score-distribution check. The page labels V5 as shadow validation until the accumulated evidence shows that the scorer separates stronger and weaker calls credibly.

## Verification completed before launch

- The worker and coordinator both validated with zero errors and zero invalid connections.
- A two-call batch completed sequentially in one worker execution in 74 seconds; both leases reached a terminal state and two assessment outcomes were written.
- The first full 80-call wave was dispatched as eight isolated ten-call workers.
- The temporary coordinator webhook was disabled after launch, leaving only the 15-minute schedule active.
- The one-time inventory webhook was deactivated after recording the stable baseline.
- Rep-scoring tests passed 26/26, focused ESLint passed, and the production Next.js build passed without running a local server.

## Rollback

Do not delete V4 data or workflows. If V5 must stop, deactivate coordinator `uWfyXPrNDzQ2Eixe`; running workers can finish their already-leased calls. The previous dashboard scorer version was `rep-reviewer-v4.3`, and the retained V4 coordinator and worker are `dSULjXP2oh1kXeRb` and `KncPcmxT0xDQcEds`.
