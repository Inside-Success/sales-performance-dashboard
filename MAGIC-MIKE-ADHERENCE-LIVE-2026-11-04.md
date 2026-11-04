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
127 tests passed and TypeScript passed before release. Build, release, activation and first-run receipts will be appended after verification. The acceptance boundary is a live scheduler, acknowledged source coverage, durable provider submissions and authenticated UI; submitting a Batch is not proof that final call results have arrived.

Recording identity audit confirmed all 51 accepted rows use canonical workspace/recording identities. Discovery now marks an already-accepted recording complete in the queue instead of leaving an undownloadable phantom pending job. Existing paid/in-progress jobs cannot be reset by discovery. This preserves both no-recharge behavior and accurate backlog counts during backfill.
