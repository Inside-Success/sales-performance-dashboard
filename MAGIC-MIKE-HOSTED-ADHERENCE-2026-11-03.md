# Hosted script adherence — November 3, 2026

## Scope and current status

Implementation authorized November 3 following the completed 12-call provider Batch pilot. Hosted integration and a bounded live cohort are in scope. Company-wide intake and the full one-week backfill remain disabled pending acceptance. Existing coaching, report delivery, FAQ policy and historical results are not rewritten.

**Hosted bounded run finished; wider rollout held for a deferred-action presentation issue.** All five two-pass results are saved and cost-settled. Infrastructure and authenticated UI verification passed. A paused sales conversation exposes a distinction between actions not yet completed and actions skipped; resolve this before company-wide scoring.

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

## Successful bounded intake and provider processing (pending review)

PR #365 merged as `6987e16398001f3321e7ed3ff7cd0a23bcd41317`; Vercel production `dpl_5ERhHa5b7hvtMMwGoYmgXcGr185f` is Ready. The corrected full scan/source run 1509805 completed successfully. The coordinator is inactive between scoped verification runs; the provider checker is active only to finish the bounded cohort.

The initial four recordings yielded three transcripts and one confirmed upstream Zoom 404. Two transcripts contain only two short utterances. The cohort was therefore expanded to six exact recording keys, adding one interrupted audition and one substantial documentary follow-up, without enabling general intake. Source-only resume 1509895 successfully collected the two added transcripts without rescanning all closer accounts. This authenticated resume does not clear a coverage fault; only a complete source scan does. The daily schedule always takes the full coverage path.

Five draft requests are pending in provider batches `batch_6ae9cf70f6708190acf6cfcb9b5bc31e` and `batch_6ae9d099ef6c8190af7586ca705f17d3`. The unavailable recording remains retained with backoff and has no AI request. No reviewed result or live cohort accuracy claim is made yet. The two-line sources must not produce invented adherence scores; interrupted calls must preserve observed actions without treating unobserved later actions as omissions.

At 2026-11-03T12:25Z the original 46 accepted calls still match digest `48346bfb7b1aeb35173847865a53999a`. Actual settled project spend is $6.758526; $2.50 is reserved for the five new draft requests (reservation is not actual cost). All five are submitted, none duplicated, with no provider error. Source-only execution 1509895 is complete, and the checker execution 1509874 completed in under one second. No n8n execution is held open waiting for the provider.

Authenticated live UI verification: owner status changed from Needs attention during the failed scan to Processing after successful recovery; overall historical totals remain 313/409 assessable actions across 23 assessed of 46 saved calls. Clicking Samantha Forcash opens her two-call summary (25/38), filtering to America's Best Doctors yields one call (12/19), and expanding it shows action-level details and the source link. This is the previously saved first call, distinct from the new follow-up under analysis.

Independent source review is saved privately in `.private-adherence/hosted-manual-review.md`. Use `.private-adherence/hosted-audit.mjs` for read-only preservation, request, cost and batch checks and `.private-adherence/hosted-export.mjs` for complete sources/results. Never rerun a paid request or reset an unresolved submission. After all five reviews settle, compare every action against the full sources; clear the exact canary list, keep general intake disabled, and deactivate the scoped checker only after all paid work is accounted for. Preserve the unavailable sixth source for later retry.

## Final bounded verification — November 4 Pakistan time

PR366 merged as `01f7802360187a3d004493c709763703e376e7ed`; production deployment `sales-performance-dashboard-dbptyr7f9-admin-insidesuccess.vercel.app` was verified Ready. Ten requests (five draft, five factual review) completed across four batches with no provider request failures. All five reviewed records were published. The sixth source remains awaiting its unavailable Zoom transcript, without an AI request.

Usage-priced incremental cost: **$0.089707**; settled project total **$6.848233**; reservations **$0**. Input129,106 tokens, including43,516 cached (33.71%). Provider durations: first draft10m35s; second draft5h28m34s; first review7h1m51s; second review2h0m43s. Final collection at20:00UTC, approximately7h49m after first submission. The long waits were independently verified directly through provider GET responses, not inferred from workflow success. Repeated scheduled checks did not duplicate request membership, settlement or publication.

Independent source assessment:
- Derrick: reality Call1, both separate videos observed;15/20 actions complete under the user-approved50% rule. Review corrected general praise being counted as a prospect-specific selection reason.
- Thomas and James: insufficient conversation evidence, no invented score or attendance outcome.
- Chris: actual speaking rep Baker correctly attributed; interrupted audition with unknown offer family receives no matching checklist rather than a fabricated score. Earlier private notes considered the title as show context; the model correctly follows the stricter transcript-only classification rule.
- Jessica: documentary Call2 correctly recognized despite the Casting Call title; no studio-tour or license-video playback. However, the call explicitly pauses for patient appointments and a same-day continuation. Its pending payment/onboarding steps are presented as Not complete in the14/26 score. This accurately describes the current recording but does not distinguish deferred work from an omission, which risks misleading rep follow-up. Wider rollout is held until this distinction is handled and tested; the51-row pilot remains labeled as a sample. No historical accepted output was overwritten to hide this finding.

Authenticated dashboard verification:51 saved calls,25 assessed,342/455 actions,75%; owner status Paused,0 in analysis. Original46 results retain digest `48346bfb7b1aeb35173847865a53999a`. Five new results and the unavailable source are preserved.

Cleanup verified: enabled=false, transport=batch, empty canary list; both scoped coordinator and provider checker inactive; coordinator successful-execution retention restored to none. No unresolved paid work remains. No company-wide intake, backfill, Slack messages or coaching/FAQ changes. The next focused correction should preserve completed actions and observed videos while keeping explicitly deferred steps out of misleading omission follow-up; it must not infer completion from a promise or require arbitrary chronological script order.

## November 4 follow-up
The interrupted-call scoring issue was addressed and deployed through PR371. See MAGIC-MIKE-ADHERENCE-DEFERRAL-2026-11-04.md for the general deferral/applicability rule, fresh normal-API evaluation, exact single-record correction, costs and authenticated dashboard verification. Original Batch receipts remain settled and untouched. Broad intake/backfill remain disabled.
