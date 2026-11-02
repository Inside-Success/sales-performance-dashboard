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
