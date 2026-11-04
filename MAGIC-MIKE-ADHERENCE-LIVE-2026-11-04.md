# Script adherence production activation — November 4, 2026

User authorized daily production processing and the previous week's backfill. Subsequently explicitly removed the $40 spending ceiling; continue exact cost tracking and monitor the rollout. No source edits, Slack messages, or coaching/FAQ changes.

## Operating design
- Both configured Zoom closer groups, all call stages, daily intake at 06:00 America/New_York. Unsupported scripts remain classified and unscored.
- Two-pass Terra v9 through the provider Batch API. A fifteen-minute checker collects saved receipts, advances reviews and publishes validated results without keeping n8n executions open during provider waits.
- At most four active provider manifests, each at most 100 requests. Review-ready work is claimed before new drafts. Due manifests are ordered by next-check time so older in-progress batches cannot monopolize collection.
- Durable source/request identity, full transcripts, leases, submission intent, idempotent receipt settlement and publication are retained. Uncertain submissions are reconciled without paid replay. Missing sources and invalid final outputs remain visible.
- Explicitly uncapped cost configuration uses NULL, not a fabricated large ceiling. Actual spending and reservations remain separate in owner diagnostics. A schema migration only permits NULL; the activation command makes the authorized setting change.
- The checker discards successful n8n execution payloads to reduce storage/write load; failures remain retained. Database receipts preserve the audit trail.
- Backfill uses an explicitly recorded seven-day window and resets only these two adherence scan cursors after preserving the previous state. Accepted pilot data are not deleted or rerun.

## Verification
The final regression gate passed on commit 73aed1d (including the additional accepted-recording regression); TypeScript and production build passed. PR377 merged as 59e7074d and Vercel production deployment dpl_7v1XqgXArkwdDii9E4nER3JfqveZ is Ready on the canonical alias. The acceptance boundary is a live scheduler, acknowledged source coverage, durable provider submissions and authenticated UI; submitting a Batch is not proof that final call results have arrived.

Recording identity audit confirmed all 51 accepted rows use canonical workspace/recording identities. Discovery now marks an already-accepted recording complete in the queue instead of leaving an undownloadable phantom pending job. Existing paid/in-progress jobs cannot be reset by discovery. This preserves both no-recharge behavior and accurate backlog counts during backfill.

## Activation evidence
At 2026-11-04 19:03 UTC, enabled=true, transport=batch, empty canary restriction, and no spending cap were verified. The preserved baseline contains 51 accepted results, checked by source identity, request ID and result digest. The one-week Miami backfill starts October 28 at 00:00 EDT (04:00 UTC).

The daily coordinator and fifteen-minute provider checker are active. Successful payload retention is disabled on both; errors remain retained. The existing protected coordinator webhook was invoked once, with saved submission intent and HTTP acknowledgement. Recording discovery is advancing; this acknowledgement is not a completed backfill.

Authenticated live UI confirms the October28 coverage start, existing 51-call summary, increasing incoming-call queue, and owner diagnostics showing $8.33 actual / $0 reserved / No spending cap at activation. The existing attention indicator includes old retained source items; it must not be represented as an all-green health result. Production runs in hosted n8n and Vercel independently of this chat.

Both coverage receipts advanced through 2026-11-04T19:03:44.705Z after the complete closer-page scan. Discovery accounted for 2,933 queue entries (504 main / 2,429 legacy); 50 already-accepted recordings were recognized as complete without another paid request. All 51 historical accepted rows remain unchanged (one is outside this scan). At the initial source-availability snapshot, 1,273 recordings had no transcript files; these remain retained and cannot honestly be called analyzed. Two transcript-download failures were deferred for retry, not sent as empty transcripts.

Verified live schedules: coordinator `0 6 * * *`, checker `*/15 * * * *`, timezone America/New_York. Both active; no new error execution returned. Background processing is hosted and does not depend on a Codex heartbeat or an open local session.

## First unattended processing verification
At approximately 19:15 UTC, the coordinator completed its first source-preparation pass and the scheduled checker independently ran. 1,576 full transcripts had reached ready/draft-pending, 1,307 source jobs remained awaiting transcript/readiness/retry, and 50 rediscovered historical results were complete. The accepted-results table remains at 51, with every preserved result unchanged. Awaiting sources included 1,273 without a transcript file, seven with unsettled/incomplete transcript segments, and three failed downloads retained for retry. These categories overlap and are not all failures.

The provider accepted the first 100-request draft manifest (`batch_6aeb840f5c648190bc0202fac93e2dbf`); a second 100-request manifest was durably prepared. These exact submissions must not be replayed. At that snapshot, project actual settled spending was $8.330047 and pending reservations were $100 (200 requests at the conservative $0.50 reservation); reservations are not charges or cost estimates for the complete backfill. The runner had no provider/source error.

Honest completion boundary: production activation, both-workspace discovery, source preparation, first provider acceptance, scheduled continuation and authenticated dashboard are verified. Full backfill analysis/review is still asynchronous. Final accuracy and total cost for new calls cannot be asserted before the provider returns reviewed outputs. Missing sources remain visible and retried through normal intake. No Slack, coaching or FAQ changes were made.
