# Script Adherence pilot — November 2, 2026

## Scope

Owner authorized a small pilot, not the full one-week backfill. New manager route `/manager/script-adherence`; isolated Postgres tables `script_adherence_*`; existing coaching and recovery workflows unchanged. The source scripts are linked by immutable document IDs in `src/lib/script-adherence/rubric.ts`. Their main tabs were read on November 2. Internal research and unobservable playback remain evidence gaps, never automatic failures.

The dedicated OpenAI credential and approved Sales call analyzer Anthropic credential are held in n8n. Credentials, transcripts and provider receipts stay outside Git under ignored `.private-adherence/` and `.env.adherence.local`.

## Measurement

- Documentary Call 1, documentary Call 2 and Reality Call 1 have separate checklists. Unsupported stages and non-conversations have no invented score.
- Complete is at least half the applicable components; below half is Not complete. An unresolved component which could change the result makes the action Not observable. Not applicable and Not observable are excluded from the assessed denominator.
- Each completion requires a source quote and timestamp; quotes and timestamps are checked against the input. Structural validation is not semantic accuracy proof.
- The show-pitch video and its embedded network tail are one playback. They do not establish the separate introduction video.
- Totals sum action counts across calls. No unweighted averaging of rep percentages. Show, stage, rep and Miami-date filters share the same underlying records.

## Pilot execution and cost

Workflow `2xX5gVtc1BKlhyG3` is an authenticated isolated pilot transport with no schedule. It compares Luna and Haiku without calling the production coaching workflow. The runner reserves a conservative amount in a persistent $40 project ledger before submission. Ambiguous submissions are held; never blindly replay them. Actual usage includes cached reads, cache writes and reasoning within output tokens.

Install schema explicitly using `scripts/script-adherence/schema.sql`; page reads do not install or modify tables. Prepare and reconcile with `scripts/script-adherence/pilot.ts`. Do not publish model output merely because a request succeeded or a schema passed. Keep raw provider receipts for recovery.

## Required release evidence

In progress: model comparison, semantic review, Zoom closer membership verification, authenticated deployed UI review and pilot publication. The full recurring collector/batch workflow is not yet released. Do not describe this document as evidence of completed rollout.

## Rollback

Disable only the new adherence workflow; remove only the new manager link/route if needed. Retain isolated result and spend tables. No changes to existing reports or source records are required. Full backfill stays deferred.
