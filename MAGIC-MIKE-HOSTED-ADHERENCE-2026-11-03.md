# Hosted script adherence — November 3, 2026

## Scope and current status

Implementation authorized November 3 following the completed 12-call provider Batch pilot. Hosted integration and a bounded live cohort are in scope. Company-wide intake and the full one-week backfill remain disabled pending acceptance. Existing coaching, report delivery, FAQ policy and historical results are not rewritten.

**In progress — not yet release acceptance.** Tests and the webpack production build pass; hosted end-to-end verification follows deployment.

## Processing

- One daily source coverage scan at 06:00 America/New_York (schedule remains inactive during verification). Both configured Zoom closer groups, complete pagination, retained missing transcripts and full recording segments use the existing source worker.
- Separate short provider checks every 15 minutes. No n8n execution waits for provider completion. At steady state this uses 96 lightweight checks/day, plus the daily coverage/source workers, instead of an execution per call.
- Both analysis and factual review use Terra. A review requires the saved draft and full transcript, so the two provider stages are sequential; daily cohorts can overlap. Neither stage is a mandatory 24-hour wait.
- SQL-backed manifests, unique request membership, provider IDs, immutable receipts, atomic budget settlement and publication survive chat shutdown and process restarts.
- Submission intent is saved before the paid create request. An uncertain submission is reconciled by exact metadata; absence from a bounded list never authorizes replay.
- A global expiring runner lease excludes overlapping processors. Collection resumes per request, and duplicate collection cannot charge or publish twice. Errors have backoff and visible operator status. Missing/uncertain receipts retain reservations and hold affected calls.
- Batch pricing is calculated from provider usage with cached-token discounts. Dedicated server-only ADHERENCE_OPENAI_API_KEY; no fallback to another feature's credentials. Existing project ceiling remains $40 for the limited validation; baseline spending $6.758526.
- v6 adds explicit interrupted-call conditional applicability guidance. It preserves positively established non-applicability and observed actions. Historical accepted analyses remain unchanged.

## Presentation

Overall totals, date/show/stage filters, clickable reps, individual calls and evidence remain available. Incomplete or unreviewed calls do not enter adherence percentages. A compact owner-only status control distinguishes Paused, Limited test, Processing and Needs attention, with diagnostic details on activation. Other managers receive no operator diagnostic payload. No status is inferred from a merely green workflow execution.

## Safe deployment and rollback

Apply `scripts/script-adherence/provider-batch-schema.sql` before deploying the queue changes. The migration is additive and does not activate processing. Keep `enabled=false`; only selected exact source keys may be processed during validation. Set transport=batch only after the dedicated secret and deployment are verified. The old realtime worker does not claim models in batch mode.

Pause new work by clearing the canary list and leaving enabled=false. Keep the batch checker available until already-paid requests have been collected and settled. Do not switch transport or roll back collection while paid jobs are unresolved. Existing accepted reports remain readable throughout. Disable the scoped checker once limited validation has settled, unless continuous processing is separately accepted.

## Validation so far

- 83 script-adherence regression tests passed, including duplicate/missing/reordered receipts, submission reconciliation without paid replay, paused intake with active collection, secret isolation and truthful status states.
- TypeScript and `next build --webpack` pass. Default local Turbopack cannot follow this worktree's external node_modules symlink; no application workaround or local dev server was introduced.
- Three scoped n8n workflow definitions validate without errors.
- Pre-change accepted baseline: 46 calls; digest `48346bfb7b1aeb35173847865a53999a`; no pilot reservations unsettled.
- Additive schema applied with enabled=false, transport=realtime, empty canary list. No accepted call changed.

Final deployment, cohort receipts, quality review, spend and authenticated UI evidence will be appended after verification. This document does not assert company-wide readiness from tests alone.
