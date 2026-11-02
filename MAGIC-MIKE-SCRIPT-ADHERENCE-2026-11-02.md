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

Install schema explicitly using `scripts/script-adherence/schema.sql`; page reads do not install or modify tables. Baseline comparison is retained in `scripts/script-adherence/pilot.ts`; the current classify/extract/review runner is `structured-pilot.ts`, and `publish-pilot.ts` is the reviewed-manifest publisher. Only the deployed dispatch route can claim current requests; do not manually mark them submitted. Do not publish model output merely because a request succeeded or a schema passed. Keep raw provider receipts for recovery.

## Required release evidence

Model comparison, source review, closer-membership verification and guarded infrastructure release are complete. Final manager-view verification and final spend reconciliation are recorded below. The full recurring collector/batch workflow is not released. Do not describe this pilot as a completed company-wide rollout.

## Rollback

Disable only the new adherence workflow; remove only the new manager link/route if needed. Retain isolated result and spend tables. No changes to existing reports or source records are required. Full backfill stays deferred.

## November 2 pilot infrastructure release

PR352 merged as `f5002eeb614c857d50a91cb9c4db07c2408459ab`; production manager route and isolated dispatch API deployed. The authenticated manager page was opened successfully. Existing coaching workflows were not modified. The initial route is intentionally not a claim that a full company-wide collector has been released.

One-time dispatch is database-enforced: only a reserved exact request hash may change to submitted. Duplicate dispatch execution 1489301 returned zero requests and never reached the AI node. The initial production dispatch batch is execution 1489293. No credential domain restriction was widened for preview testing.

Classifier uses full indexed source passages, not titles or prerecorded marketing language. A separate current-call-purpose field distinguishes prior-offer Q&A from a new offer presentation. Latest classification regression: twelve sampled calls; four supported checklists, four Reality Call 2, one later documentary follow-up, one early disqualification, two insufficient transcripts. All twelve hosts matched configured closer membership. Both fragment recordings were checked directly in Zoom and had only one tiny available transcript each; these are real evidence limits, not proof of no-show.

Provider structured-output limits rejected three extraction schema variants before generation (numeric bounds, nullable-field count, grammar size). Each was recorded and its reservation reconciled; these are pilot integration failures, not production coaching failures. The accepted transport uses a compact actions-array schema, then validates exact action IDs, component counts, source references and scoring rules locally. Current workflow preserves each provider error alongside successful sibling responses. No blind paid retries.

## Remaining rollout gate

This authorization is for a small initial test. Full one-week backfill remains deferred. The twice-daily automated collector and recovery/pagination integration are not yet enabled or accepted. Before company-wide use, retain account + recording identity, scan both closer groups with pagination, overlap readiness windows for delayed transcripts, persist cursors/holds, and account for every source recording including unsupported stages. Group membership is maintained by the owner. Use two bounded scheduled batch runs, not one n8n execution per call; retries must reuse receipts and must not replay uncertain provider submissions. Historical scores must retain their source-script version.

## Reviewed pilot results

Twelve calls were accounted for, with four scored calls spanning all three supported checklists. The reviewed checklist has 92 action slots: 60 Complete, 15 Not complete, 1 Not observable (internal prospect research), 16 Not applicable. Completion is 60/75 = 80% of assessed actions; this is a deliberately small pilot sample, not a company performance estimate. Two calls with insufficient source transcripts remain visible without fabricated scores.

Video results: both Reality Call 1 calls contain the show pitch (Video 2) but no distinct introduction playback (Video 1). Documentary Call 1 contains both introduction and congratulations videos. Documentary Call 2 contains both studio tour and license videos. Lower-bound playback evidence is retained; no invented exact playback duration.

Final source-bound classification execution: 1489315. Accepted extraction: 1489399. Initial model review: 1489431. Final targeted review using source-checked findings: 1489506. The final four results required source review beyond automatic schema checks: generic recorded narration, old versus new email checks, semantic discovery credit, and conditional partner attendance were corrected. This is a reviewed pilot, **not evidence of unattended model accuracy**. Preserve the private audit findings and original outputs. A fresh unseen sample is required before claiming that these corrections generalize.

The dashboard presents only clean labels, counts, video roles and expandable evidence. Raw model attempts, request hashes, provider usage, reservations and source versions stay in isolated storage. Publisher requires an exact reviewed manifest and publishes all twelve rows atomically. It cannot publish a supported classification without a validated action extraction.

Final recorded model usage: **$0.229374**, including invalid-output attempts and all paid reruns, against the $40 ceiling. No outstanding reserved/submitted model requests remained at reconciliation. This is token-receipt accounting at the verified provider rates, not an invoice or a steady-state cost-per-call estimate. Infrastructure subscription costs are not included. Provider schema rejections incurred no generation usage. Both new pilot/source-verification workflows are switched off after the pilot; no schedule or full backfill is running.

The pilot uses Haiku for separate classification and selected-script extraction, with medium-effort source review during evaluation. Luna remains a comparison option, not a selected unattended production configuration. Generic narration and previous-call evidence still required directed review in this sample; do not claim either model is flawless or auto-publish future runs. For expansion, use unseen calls to test these exact failure categories before enabling the twice-daily ingestion path.

## Live acceptance record

PR353 merged as `94cb236bac2515df86898d086c01f77bfc83352e`. Production deployment `dpl_2JM2P5RDgw6mGUxt8ZFTJJ4ueyY3` serves the manager page at https://sales-performance-dashboard-rose.vercel.app/manager/script-adherence . Authenticated verification showed all twelve saved calls, 60/75 assessed actions (80%), the pilot badge, incomplete-source count of two, and the correct per-script video pairs. Show filter Entrepreneurs Island returned five calls and 26/39; adding Call 1 returned two calls; adding Tara returned one call and 11/20. The Video 2 evidence drilldown displayed the saved timestamp and exact source passage. The complete desktop layout was visually checked. This does not claim a mobile-device acceptance test.

Final checks: 53 adherence/access tests passed, TypeScript passed, scoped ESLint passed, Vercel production build passed. PR352 also passed the existing coaching-reliability CI suite and production build. Credential-pattern scan found no API keys in the changed tracked files. The official coaching, manual coaching, Zoom intake and bounded recovery workflows remain active, with update dates preceding this pilot. No Slack messages were sent.

The reviewed pilot is available for owner assessment. Company-wide unattended operation is not accepted: it still requires the twice-daily collector/recovery integration and fresh unseen-call evaluation. The four final checklists include directed source-review corrections; presenting those as raw-model accuracy would be misleading. All original requests, paid usage, final results and review findings have been retained.


## Expanded pilot completed November 2
See `MAGIC-MIKE-SCRIPT-ADHERENCE-EXPANDED-2026-11-02.md` for PR355–357, improved rep drilldowns/date policy, 30 additional reviewed calls (42 total), Terra/Haiku comparison, $1.868395 cumulative API cost and authenticated acceptance. Original 12 saved rows are unchanged. No full-week backfill or twice-daily all-company activation.
