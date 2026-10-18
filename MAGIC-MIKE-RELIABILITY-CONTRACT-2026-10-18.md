# Coaching reliability contract — October 18, 2026

## Release scope and status

Owner approved implementation and staged production release. The scoped reliability release is live and the three release-time recoveries are independently verified below. The first full source sweep also exposed older unaccounted candidates; these are explicitly separated from confirmed report failures and have not been replayed blindly.

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

- 147 coaching/checkpoint/coverage tests passed.
- Four workflow/retry/contract verification scripts passed; the contract verifier also compiled the candidate Code nodes against the compressed live baseline.
- Scoped ESLint, TypeScript and a production webpack build passed.
- The eight-node coverage workflow validated with zero errors/warnings. All five existing workflow patch sets passed dry-run validation.
- Read-only replay of 241 completed writer/repair stages: 230 unchanged, eleven exact alias normalizations. One separate historical draft lacked evidence references and remains invalid; no evidence is invented to accept it.
- Two existing rep-selector test expectations were updated for the already-live library-only query options. No selector runtime behavior changed.

## Rollback

Private baseline: `../.codex-backups/coaching-reliability-2026-10-18.json.gz` (approximately 194 KB). It contains baseline workflow definitions/selected official nodes, not credential values or copied transcript payloads. Git retains the previous dashboard version. Revert only this release's scoped workflow operations and dashboard commit; do not overwrite concurrent FAQ/scoring/access changes.

## Production acceptance

The production acceptance gates below passed. External provider/task/platform outages remain possible; this release improves validation, accounting and bounded recovery rather than promising that external failures cannot recur.

### Staged acceptance findings

- PR #319 merged after the coaching GitHub gate passed. Production deployment `dpl_Fkvq1KZEPt5674D69e4K5nYfuwRg` is READY for commit `02f0e94c213d139f815ddd5f4c9725656c42b7ce`, with the normal production alias. Preview provisioning failed before the app build; production deployment succeeded.
- Anonymous internal API requests returned 401. Authenticated n8n canary `1165758` successfully read source diagnostics and 500 source records; its read-only temporary helper was subsequently disabled. Local Vercel environment exports do not expose the sensitive ingest value, so those local authenticated attempts were 401 rather than acceptance proof.
- The source canary showed why intake exclusions must be explicit: attendance-only/short recordings can also carry Processed/Call 2+ source labels. Additional regression cases cover this. The source checker was kept inactive until this refinement was deployed and verified.
- Official, manual, reliability, provider and scanner workflows were surgically updated and published. Node/connection comparisons showed only intended changes; structural validation has zero errors. Existing unreachable legacy nodes remain unchanged (six official and four manual warnings). A new state-reader node was renamed to `MM Read Checkpoint State` to avoid a validator name heuristic that mistook a normal Set-node fan-out for an error-output branch. No branch semantics were altered to appease the heuristic.

- Live natural input also produced a parsed writer draft with contradictory `completed`/`transcript_too_short` statuses. Strict cache validation must not remove the existing targeted repair opportunity. Parsed invalid drafts are retained as **failed**, forwarded to the caller for its existing single repair, and never marked reusable completed. Transport/refusal/ownership failures still fail closed. Added a checkpoint storage and compiled-node handoff regression. The naturally affected source is included in release acceptance, rather than left behind.

## Final production results

- Functional PRs [319](https://github.com/Inside-Success/sales-performance-dashboard/pull/319) and [320](https://github.com/Inside-Success/sales-performance-dashboard/pull/320) merged. Final functional commit `dda6680aa04bf4de0ba0d9679763af0b601d50c5`; deployment `dpl_AKspENiWroRZL9t6qyuFTNvdopYx` READY and assigned to the normal rose production domain. PR #320 CI passed all 147 tests, workflow verifiers, TypeScript and production build.
- Published workflow versions and sanitized patch hashes are in `MAGIC-MIKE-RELIABILITY-MANIFEST-2026-10-18.json`. Official workflow has 139 nodes; provider 18; reliability 15; manual 55; scanner 17. Only the intended selected parameters/connections changed; the large official graph was not replaced wholesale.
- Original Matt/Bryce failure recovered as [report 8158](https://sales-performance-dashboard-rose.vercel.app/call/8158), official execution `1165815`. Saved writer/classifier reused; required factual audit, compliance/safety and any necessary existing safety repair still ran.
- Original Ro/Cristian task-timeout failure recovered as [report 8159](https://sales-performance-dashboard-rose.vercel.app/call/8159), execution `1165871`. Valid saved writer reused; expired audit lease reacquired and required audit completed.
- The natural Bre Michelle call affected during staged validation also recovered as [report 8160](https://sales-performance-dashboard-rose.vercel.app/call/8160), execution `1165909`. Its transport-valid malformed draft reached a recorded recovery outcome; the final code preserves the existing targeted-repair handoff for any future malformed draft instead of blocking it at provider validation. Compiled-node and checkpoint-storage regression tests prove that invalid parsed drafts remain failed/non-reusable while being forwarded for repair.
- Exactly one matching dashboard row per recovered source was independently read from Postgres. All three completion receipts are delivered; normal top-level/thread Slack nodes succeeded. Both original recovered Google Docs were independently fetched and contain populated coaching sections, correct identities and transcript links. No extra numerical scoring was run by recovery.
- Signed-in Chrome verified reports 8158/8159/8160, explanation expansion and actual transcript evidence loading. Rep usage, sales impact and Yesterday attendance loaded with data; existing admin access remained intact. Additional unaffected-page checks are recorded in the final handoff. No fresh manual human submission is claimed.
- The source checker `yL5XsZPtVP1rsW8X` completed its first fourteen-day sweep: 932 source records across two durable pages (`1165930`, `1165938`). Both pages were acknowledged only after accounting/notification. Exact stored intake no-show/too-short categories were respected. Normal cadence restored and read back as every fifteen minutes; no AI node was added.
- Temporary read-only canary `e2dzsGzWoegpSlV1` is inactive. Old official/manual/weekly production predecessors remain inactive; intake, official, manual, weekly, provider, recovery worker and both scanners are active.

### Older unaccounted candidates — separate follow-up

The independent sweep flagged **17 older source records without a matched dashboard artifact or completion/exclusion/recovery receipt**. This is not proof that all seventeen require reports: eligibility and any historical partial delivery still need checking. Seven first-page sources carry substantive valid-sales intake reasons; source-ID, source-transcript and same-rep/start-time dashboard matching, report-table identity searches and saved draft/cache checks did not find their artifacts. Other candidates include disconnected calls. They were reported through the existing operational alert channel and retained in the owned coverage cursor for deduplication, rather than automatically regenerated or labelled as confirmed failures. Do not call this backlog resolved or silently treat these candidates as delivered. This finding is distinct from the two original confirmed failures and the third release-time recovered call.

### Cost and storage

Configured-rate estimates from newly saved provider usage: original two recoveries approximately **$0.411990205**; the third recovery's new writer/audit/compliance/safety work approximately **$0.09572754**; combined new recovery work approximately **$0.507717745**. The third call's original natural classifier and first rejected writer add approximately $0.0294637 of ordinary production work. These are usage-based estimates, not invoice confirmation, and exclude previous failed-request charges. Saved stages were not charged again in the recovery totals. No paid synthetic model test was submitted.

Compressed rollback is approximately 196 KB; generated private operation files approximately 152 KB. No checkout/dependency copy or transcript archive was created. Temporary build cache created by this task is removed before handoff.
