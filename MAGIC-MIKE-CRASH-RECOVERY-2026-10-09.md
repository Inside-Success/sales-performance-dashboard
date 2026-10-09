# Magic Mike crash recovery — October 9, 2026

## Authorized scope

Recover Bryan Gonzalez's missing official Call 2 report and harden existing recovery against crashed executions and abandoned claims. Naming refinements and the previously deferred reality/compliance policy remain separate. No model, prompt, rubric, FAQ, access or application UI change. No writes to the company sales spreadsheet.

## Findings

Official execution `1033745` crashed during the existing factual-audit child. Its classifier, numerical scoring and coaching writer had already completed; the report, coaching document and normal coaching Slack delivery had not been created. Other unrelated workflows crashed at the same time. The execution message mentions possible out-of-memory; the actual infrastructure cause is not established.

The old scanner listed only `error` executions. It never inspected `crashed` executions. A worker crash could also leave a delivery claim in `processing` without reaching its final receipt/alert path.

## Published changes

| Workflow | Published version |
| --- | --- |
| Official coaching `L8Nn7xncA9ZPDdWA` | `f0816056-fb12-41da-bafc-3677d1ddaaae` |
| Bounded worker `Zx3S5B1gYHRrbv2F` | `51160baf-9c41-4d19-b2bc-395f27d20f26` |
| Failure scanner `mIsdpJO71D8DMrxe` | `7c7f39e2-7518-4cbd-b1c5-75dff2d0f33c` |

- Scanner merges error/crash lists, checks source-level completion receipts, and processes at most five failures per scheduled run. Existing cutoff September 16 is preserved. Known writes are reconciled per source; uncertain write identity is held for review.
- Saved writer output is stored before queueing in isolated backend table `iFcrgEAW8UIowGti`. It is explicitly **unreviewed**. The old verified-output table is unchanged.
- Recovery reuses a draft only when source identity, complete current provider request, successful parsed output and request identity match. A mismatch runs the current writer. A reused draft still runs the existing factual audit, compliance and delivery stages. Numerical rescoring stays skipped.
- Worker checks claims older than 25 minutes, verifies the owning worker execution is terminal, and uses ID/status/execution compare-and-set before holding and alerting. Active/waiting executions are not reclaimed. Potential partial writes are not blindly replayed.
- The scanner and worker retain their existing error workflow, schedule, timeout and alert destinations. No extra AI stage or normal-call backend write was added.

## Verification

Local tests cover alignment, corrupt/stale drafts, duplicate scan receipts, per-source partial writes, ambiguous writes, fresh claims, active executions, crashed executions and ownership mismatch. Real execution `1033745` also passed the saved-draft alignment test without storing its transcript locally.

Candidate graph/configuration validation passed. Worker and scanner live validation passed with zero errors. The official validator retains the same eight pre-existing static return-shape findings in unchanged Code nodes; no new findings were introduced. Original official nodes/settings and normal connections were compared directly with the rollback snapshot. Worker original nodes/settings are unchanged; scanner only its two intended Code bodies changed.

Scheduled scanner `1045732` successfully inspected the real crashed execution, saved the unreviewed draft and queued Bryan once. Worker `1045832` and recovery child `1045833` both finished successfully. The exact-match unreviewed branch was used; the writer and numerical scorer did not run again. The existing factual audit, compliance and safety stages completed. Subsequent scanner `1045863` finished without queueing Bryan again.

## Rollback and storage

Small private compressed baseline snapshots are in `.magic-mike-crash-recovery-2026-10-09`, outside Git. Keep existing n8n native version history. Restore only this release's changed Code fields and recovery connections, remove its added nodes, validate and republish. Do not overwrite newer unrelated edits with a full old export. Do not replay a source that already has a report or final delivered receipt.

The Git builder and deterministic helpers contain no credentials, transcripts or raw execution exports. No checkout, node_modules copy or local server was created. Backend draft storage is separate from laptop disk usage.

## Limits

This repairs recovery visibility and resumption safety; it cannot prevent an n8n instance or external provider from crashing. Partial-write cases intentionally require examination rather than a duplicate-producing automatic retry. No new instance crash was intentionally induced in production.

## Recovery receipt

- Source `recaw44cfmqZDqG84`; generated report `rec6yBXVUPVETdfak`; dashboard [report 7573](https://sales-performance-dashboard-rose.vercel.app/call/7573).
- Delivery ledger row1476 is `delivered`, attempts1, with execution1045833. No queued/review receipt is being called a successful delivery.
- Independent Postgres read found exactly one matching Bryan report with the original October8 call date, Tara Reszitnyk and source metadata.
- Coaching document `1RNdj4IjVxUQSV8PX7m_gzcqf0boNRD5Hsj09fQyq61g` was independently read through connected Drive: nonempty, correct rep/client, complete sections and transcript references in the existing Tara folder.
- Both normal coaching Slack stages returned `ok:true` in channel `C0B0VJHTPTK`. No synthetic business report or test notification was sent.
- Signed-in dashboard loaded the correct report, existing37.8 score, three grouped improvements and source links. Explanation expansion and timestamp evidence controls were checked.

New recorded AI usage estimate: **USD0.287570525**, about29cents. Classifier0.0547647; factual audit0.113567; compliance0.10767; safety0.011568825. The old saved writer's0.097755 is excluded from new recovery cost. No fresh numerical scoring or writer charge. This is provider-usage accounting, not an independently reconciled provider invoice.

The ordinary intake and official schedules continued succeeding after publication. Naturally arriving full Call2 completion under the unchanged normal path is recorded only if observed; the recovered real Call2 is the verified end-to-end acceptance case here. The newly added stale-claim terminal/active guards were tested deterministically, not by deliberately crashing a production worker.
