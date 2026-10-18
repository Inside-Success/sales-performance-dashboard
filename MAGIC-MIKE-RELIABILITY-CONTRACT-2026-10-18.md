# Coaching reliability contract — October 18, 2026

## Release scope and status

Owner approved implementation and staged production release. This document currently records the tested candidate; production acceptance will be recorded below after deployment and real-source recovery. Do not interpret local tests as proof of delivery.

### Confirmed causes

- A saved coaching writer/repair could put a strength in `action` instead of `observation`. Both drafts were cached, so subsequent retries consumed the same invalid shape. The new shared normalizer moves only this known alias, preserving the exact text and evidence. It never manufactures an observation or evidence.
- An unanchored HTTP-code regex interpreted `503` inside the transcript length `40503` as an outage, repeatedly retrying a content failure. HTTP classification now requires an explicit status context; bounded content retries and safety holds remain separate.
- A child task timeout could leave an owned provider checkpoint running while the parent saw only an uninformative child-workflow error. The parent now reads source-scoped checkpoint diagnostics and respects leases/backoff. Uncertain business writes, auth failures and refusals remain held.

### Changes

- Apply the same coaching shape contract to official/manual renderers, newly completed provider results and exact-request cache reuse. Evidence validation and the existing factual/safety audit still run.
- Add bounded native pagination to failed/crashed-execution inspection.
- Add an independent source-to-dashboard coverage checker. It reads processed Call 2+ records with transcripts, waits twenty minutes, and scans a rolling fourteen-day source-created window. It compares actual dashboard artifacts and completion/exclusion/recovery receipts. Exact recorded intake categories `sales_no_show`, `sales_rep_no_show` and `sales_too_short` are excluded from coaching expectations; narrative mentions and disconnected calls are not automatically excluded. It retains a pending cursor until acknowledgement and alerts only previously unreported gaps. It does not blindly create reports or resend uncertain deliveries.
- The checker uses source GETs and dashboard-owned cursor storage only. No source Google Sheet, source Airtable record, scoring rule, compliance rule, model selection, FAQ prompt, user permission or dashboard layout is changed.
- Add a GitHub coaching reliability regression gate alongside the existing FAQ gate. Runtime n8n edits are built from a private compressed baseline using the versioned builder, rather than replacing the large official workflow.

### Candidate validation

- 145 coaching/checkpoint/coverage tests passed.
- Four workflow/retry/contract verification scripts passed; the contract verifier also compiled the candidate Code nodes against the compressed live baseline.
- Scoped ESLint, TypeScript and a production webpack build passed.
- The eight-node coverage workflow validated with zero errors/warnings. All five existing workflow patch sets passed dry-run validation.
- Read-only replay of 241 completed writer/repair stages: 230 unchanged, eleven exact alias normalizations. One separate historical draft lacked evidence references and remains invalid; no evidence is invented to accept it.
- Two existing rep-selector test expectations were updated for the already-live library-only query options. No selector runtime behavior changed.

## Rollback

Private baseline: `../.codex-backups/coaching-reliability-2026-10-18.json.gz` (approximately 194 KB). It contains baseline workflow definitions/selected official nodes, not credential values or copied transcript payloads. Git retains the previous dashboard version. Revert only this release's scoped workflow operations and dashboard commit; do not overwrite concurrent FAQ/scoring/access changes.

## Production acceptance

Pending deployment, workflow publish/readback, source coverage canary, recovery of Matt/Bryce and Ro/Cristian, duplicate/artifact checks and authenticated UI verification. Recovery costs must distinguish reused saved results from newly billed provider work. External provider/task/platform outages remain possible; this release improves accounting and recovery rather than promising that external failures cannot recur.

### Staged acceptance findings

- PR #319 merged after the coaching GitHub gate passed. Production deployment `dpl_Fkvq1KZEPt5674D69e4K5nYfuwRg` is READY for commit `02f0e94c213d139f815ddd5f4c9725656c42b7ce`, with the normal production alias. Preview provisioning failed before the app build; production deployment succeeded.
- Anonymous internal API requests returned 401. Authenticated n8n canary `1165758` successfully read source diagnostics and 500 source records; its read-only temporary helper was subsequently disabled. Local Vercel environment exports do not expose the sensitive ingest value, so those local authenticated attempts were 401 rather than acceptance proof.
- The source canary showed why intake exclusions must be explicit: attendance-only/short recordings can also carry Processed/Call 2+ source labels. Additional regression cases cover this. The source checker remains inactive until this refinement is deployed and verified.
- Official, manual, reliability, provider and scanner workflows were surgically updated and published. Node/connection comparisons showed only intended changes; structural validation has zero errors. Existing unreachable legacy nodes remain unchanged (six official and four manual warnings). A new state-reader node was renamed to `MM Read Checkpoint State` to avoid a validator name heuristic that mistook a normal Set-node fan-out for an error-output branch. No branch semantics were altered to appease the heuristic.

- Live natural input also produced a parsed writer draft with contradictory `completed`/`transcript_too_short` statuses. Strict cache validation must not remove the existing targeted repair opportunity. Parsed invalid drafts are retained as **failed**, forwarded to the caller for its existing single repair, and never marked reusable completed. Transport/refusal/ownership failures still fail closed. Added a checkpoint storage and compiled-node handoff regression. The naturally affected source is included in release acceptance, rather than left behind.
