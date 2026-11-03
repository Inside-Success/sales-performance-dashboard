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

Scoped n8n resources: daily coverage `hb3M0O7fYx04oVEs` (inactive), provider checker `8OFKaWAX89AsgpoG` (inactive until hosted verification), error recorder `ReqYiNj0X6YHOSKe` (published, no schedule or messaging nodes). Dedicated production secret installed on Vercel project `prj_DwQt5q1eNv9WZwwc1IIa5zQvIH5e`, team `team_qG4moATpNnuhyxhDJjdvqZYY`.

## First production verification and intake correction

PR #362 merged as `0e1deb4119d4ed17280fc18d756434cd2c031a77`; Vercel production `dpl_CpaQj65Wz8BgYmhzsW3ot62NmpF5` is Ready. Authenticated owner UI showed Paused; unauthenticated provider POST returned 401. All release CI checks passed.

A metadata-only source refresh completed both accounts through 2026-11-03T11:43:11Z (run 1509471; 202 durable page records). Existing 46 accepted results and $6.758526 spending remained unchanged.

The four-source canary (two recordings per workspace) then exposed the pre-existing monolithic scanner's 60-second n8n Code task timeout in execution 1509617. No transcripts, AI requests or accepted results were created by that failed run. The checker was paused while fixing ingestion. This is an actual live finding, not an inferred defect.

The scanner now prepares a list of closer/pending-recording tasks and uses a native one-item loop. Each Code invocation handles one closer's paginated recordings or one retained pending recording, with a 35-second pagination guard and 10-second HTTP timeout. Every result page is acknowledged before advancing the loop. The final per-account cursor receipt cannot run before all preceding work. This remains one coverage workflow execution, not one execution per call. Source failures are recorded separately from provider-check failures, so a healthy provider poll cannot hide failed intake. A completion event clears the source fault only after intake/source processing finishes.

Validation adds pagination, empty/repeated group, pending-recording retention, loop completion ordering and independent source-fault tests. The loop validator's warning about the coordinator on the Done output is intentional: source workers must start after coverage tasks finish, not once per closer.
