# Provider Batch pilot — November 3, 2026

## Scope and current status

Moonis authorized a small end-to-end provider-batching pilot before deciding on company-wide activation or backfill. Neither is authorized by this pilot. No production workflow, accepted call, source document, or Slack message is changed.

The cohort is twelve previously reviewed holdout calls (indices 0,1,2,4,5,6,7,8,9,10,11,15), covering reality Call 1, documentary Calls 1 and 2, follow-up/unsupported stages, and calls without an assessable script. This is a transport and quality consistency pilot, not a new unseen accuracy benchmark. Complete saved transcript text and the existing v5 Terra prompts/schema are reused. The provider-specific `service_tier` field is omitted because work is submitted through Batch.

- Model: `gpt-6.1-terra`, medium reasoning, unchanged 16,000-token output ceiling, both stages.
- One cohort, two dependent provider jobs: draft, then full-source review of the resulting draft.
- Dedicated owner-provided credential; no credential is committed or printed.
- Existing project budget: $40 maximum, $6.504344 settled before this pilot. Reserve up to $0.50 per request, at most $12 across 24 requests. Settle once from actual usage at published Batch rates; the database is the cost ledger.
- Accepted production calls remain unchanged; results are private pilot artifacts, not dashboard publications.
- First batch accepted: `batch_6ae8ee9dc4dc81908d8a906ac8bf5bfe`. Completion and quality acceptance are still pending.

## Recovery and evidence

`scripts/script-adherence/provider-batch-pilot.ts` exposes prepare, submit, status and collect, separately for draft/review. It requires `DATABASE_URL` and `ADHERENCE_OPENAI_API_KEY` from the authorized runtime environment. Run using the repository's vite-node binary; never start a dev server.

Private state lives in ignored `.private-adherence/provider-batch-pilot/` with mode-600 JSON artifacts and atomic local replacement. State retains manifests, transcript hashes, input file ID, submission intent, provider batch ID, output/error files, original receipts and parsed results. Requests and reservations also persist in existing isolated experiment tables. No accepted-call rows are updated.

A second submission with an existing batch ID reuses that ID. An interrupted submission with no returned ID is held for reconciliation by provider metadata, not replayed. Provider result order is irrelevant: custom IDs map to exact source requests. Unexpected/duplicate results are rejected; missing results retain their budget reservation. Usage settlement is conditional on an unsettled request, preventing repeated collection from charging twice. A malformed draft with complete raw JSON may be reviewed; missing transport results block the second stage. Review results must pass the existing source/evidence/rubric validation.

This is a manually operated bounded pilot harness, not a deployed unattended scheduler. No n8n execution is held open while provider work runs. Daily scheduling, automatic reconciliation and production publication remain rollout work after the pilot decision.

## Verification so far

- Existing model, contract and cost checks: 30 tests pass.
- New batch receipt and cost checks: five tests pass (shuffled IDs, duplicate/unexpected IDs, missing receipts, cache rates, invalid billing input).
- TypeScript: passes.
- Live database read confirms company-wide enable flag false and empty canary allowlist.

## Acceptance still required

Both batches must finish; evaluate classifications, action-status changes and video omissions against saved reviewed results and original evidence. Record actual cost, cached tokens, stage and overall turnaround. Recollect a completed stage and confirm no duplicate charge. Check accepted-call totals and activation flags remain unchanged. Do not describe a submitted batch as a successful pilot.

Official references: https://developers.openai.com/api/docs/guides/batch and https://developers.openai.com/api/docs/pricing .

## Asynchronous continuation checkpoint

Draft batch passed provider validation and reached 10/12 completed, zero failed; remaining requests are still provider-pending. Accepted-call baseline is 46 rows with result digest `48346bfb7b1aeb35173847865a53999a`. The $6 draft reservation is not actual spend; pre-pilot settled spend remains $6.504344 until usage receipts are collected. Full local adherence suite: 70 tests pass; GitHub adherence/reliability checks and preview build passed. A duplicate submit invocation returned the existing batch ID without another provider request.

Scoped chat heartbeat `finish-magic-mike-batch-pilot` checks every ten minutes, continues to the single review batch when ready, verifies all results and ledger idempotence, and pauses after completion or an actionable blocker. It must remain quiet on unchanged pending states. This continuation does not authorize company-wide processing or backfill. Draft PR: https://github.com/Inside-Success/sales-performance-dashboard/pull/362 .

## Draft completion and review submission

All twelve draft requests completed with zero provider failures and all twelve passed source/schema validation. Provider draft turnaround: 2,453 seconds (40 minutes 53 seconds). Usage-priced Batch cost: $0.126193. The same twelve drafts and full transcripts were submitted for Terra review under batch `batch_6ae8f9d1a2148190a36587363cdc417a`, initially validating. No duplicate draft or review jobs were submitted. Review completion, substantive comparison and final ledger replay checks remain pending.

## Interim draft comparison and recovery verification

At the user's request to finish the remaining checks, review batch was confirmed in progress with zero completed/failed at that read. Draft recollection was exercised against the live isolated ledger: before/after budget and request totals were identical; settled draft cost remained $0.126193, with twelve review reservations outstanding. All 46 accepted-call results retained the original digest and activation remained false.

Draft comparison against the saved earlier reviewed outputs: 11/12 classifications, 172/176 existing reference action statuses, and 16/16 video statuses matched. One newly assigned documentary Call 2 checklist is not included in that 176-action denominator because the old reference classified the call as follow-up. These figures are consistency measurements, not accuracy. Private details: `draft-comparison.json`.

Differences requiring final source adjudication: call 5 invite applicability after lost connection; call 6 challenge discovery versus the rep's own business-maturity assessment; call 9 conditional financial-fit applicability before interruption; call 10 Call 2 versus follow-up (casting approval/media pack do not by themselves prove a prior full presentation); call 15 whether the payment/onboarding proposal satisfies the proceed request. The prior reference must not be assumed correct. Review receipts and inspection of all final differences are still required before any rollout recommendation.

## Final pilot result — completed November 3 Pakistan time

Both batches finished successfully: 24/24 provider requests, 12/12 final outputs passed the existing source/schema/rubric validator. Draft cost $0.126193; review cost $0.127989; combined $0.254182, or $0.021182/call ($21.18/1,000 at this sample's mix). These are usage-derived charges at published Batch rates, not a reconciled provider invoice. Overall project settled spend is $6.758526 of $40; all pilot reservations are settled.

Draft provider processing took 40m53s; review took 66m18s. First submission to final provider completion was 1h54m06s, including 6m55s between stages. This is one observed run, not a latency guarantee. Both stages used 365,105 input tokens, including 160,550 cached tokens (44.0%), and 48,927 output tokens including reasoning. Cache savings are already included. This mixed sample includes short/unsupported calls and must not replace the earlier longer-call planning estimate with a guaranteed cheaper production forecast.

Final consistency against earlier reviewed outputs: 11/12 classifications, 174/176 previously scored action statuses, and 16/16 comparable video statuses. The changed classification adds a 29-action documentary Call 2 checklist that is outside the old 176-action denominator; do not call this a 98.9% accuracy score. It is a small previously reviewed cohort, not an independent unseen accuracy study.

### Source adjudication of all differences

- Call 5, calendar invitation: source ends with the rep losing the prospect after the video. Reviewer correctly changed the draft's `Not applicable` to `Not observable`; the missing continuation cannot establish whether booking occurred.
- Call 15, proceed request: at approximately 01:03:20 the rep presents the alternative package and asks whether the prospect is interested; at 01:11:46 proposes locking the spot with $2,000, then discusses Monday onboarding at 01:14:31. Reviewer restores completion under the existing substantive/paraphrase rule. This does not imply the buyer paid.
- Call 6, challenge exploration: the older baseline credited the rep's own business-maturity assessment at 00:20:27 as problem and desired-change discovery. The actual discovery asks business stage, TV-worthiness and why TV; the prospect describes wanting to grow, but there is no substantive exploration of a concrete problem and cost of inaction. The final `Not complete` aggregate is better supported than the old `Complete`. A broad growth aspiration alone cannot satisfy two of three components. The prior reference is preserved, not silently rewritten.
- Call 10, documentary Call 2 versus follow-up: reading the full live exchange shows initial casting approval, discussion of the media package, the actual $8,000 offer and refusal, followed by an alternative-production discussion. No earlier full offer presentation is established. The old follow-up classification was not better supported; Call 2 is defensible under the existing decision-stage rule. The 29 added action states were inspected: no videos play; payment/onboarding-dependent actions are not applicable after refusal. This remains a semantic edge case, not proof of a classification error.
- Call 9, conditional affordability: the recording ends during discovery and explicitly notes the prospect's phone apparently died. The final output calls financial-fit `Not applicable` because no triggering difficulty was observed. Conservatively `Not observable` is preferable for the complete-call view because the recording is interrupted before the condition could be established. Both statuses exclude the action from the completion denominator, so this does not falsely penalize the rep or change the adherence percentage. This is a narrow label/uncertainty consistency issue to standardize before unattended rollout, not evidence that batching damages video detection.

No false video omission was found among the comparable video decisions. Two further no-playback video decisions belong to the newly classified Call 2; no playback is present in that complete live transcript. No claim of perfect accuracy or company-wide readiness follows from this pilot.

### Safety and final recommendation

Recollecting both completed stages leaves actual charges unchanged. Final budget/read snapshot exactly matches the pre-replay snapshot. Accepted call count remains 46 and result digest remains `48346bfb7b1aeb35173847865a53999a`; activation stays false with empty canary keys. There are no unresolved pilot cost reservations, no running provider batches, and no n8n executions created by this pilot. Code and evidence remain isolated; no production merge, schedule activation, dashboard publication or backfill occurred.

Recommendation: provider batching with Terra/Terra is viable and worth retaining. Proceed to a scoped production-integration phase only after the user's decision, with an explicit interrupted-call applicability rule, durable hosted batch state/reconciliation, and once-daily intake plus independent completion checks. The current harness demonstrates the two paid stages and result validation, not an already deployed unattended scheduler. Keep rollout and backfill off until that integration is verified. The scheduled pilot follow-up is removed now that the authorized pilot and verification are complete.
