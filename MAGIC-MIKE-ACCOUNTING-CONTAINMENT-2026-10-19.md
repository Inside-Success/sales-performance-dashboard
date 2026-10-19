# Coaching accounting containment — October 19, 2026

## Cause and scope

The previous source-accounting release accepted `call_1`, but the actual terminal Set node emits `call_1_skipped`. The new bookkeeping node therefore threw on legitimate discovery calls. Because the graph has parallel delivery branches, this could interrupt another call's document/dashboard delivery after its report and Slack messages had already been written. This was an integration regression introduced by the prior change, not a provider outage.

The original tests compiled the added node but omitted the real Set output from the fixture. That coverage gap is now explicitly tested in CI.

## Published repair

- Official workflow remains `L8Nn7xncA9ZPDdWA`, active; published version `de4bd985-80e8-401c-9f39-8e135d9237ac` at 17:21:29 UTC.
- Normalize the existing terminal status to the canonical receipt status without changing business labels or exclusion policy.
- Preserve classifier reason, original status/reason and guard revision through the current item's Set handoff. Classifier Call 1 uses only the terminal receipt writer; other classifier exclusions retain their existing writer.
- Invalid source identity, unknown status or conflicting provenance cannot produce a false exclusion. Explicit error outputs route accounting failures to an owned recovery event and the existing operations channel. Logging/notification failures cannot abort the sibling delivery branch; native execution errors remain inspectable.
- Receipt-store operations have bounded retries. No bookkeeping/error branch returns to the loop; the original single continuation remains.
- No changes to intake, source transcripts, company sales Sheets, model configuration, numerical scoring, compliance policy, FAQ or access controls.

## Reconciliation and recovery

The final pre-publication inventory covered **59 affected executions and 71 distinct input sources**:

- **68 Call 1 sources:** source records already classified them as discovery calls. Reconciled their missing bookkeeping receipts to `excluded`; independently read back 68 unique receipts. These are not 68 missing coaching reports.
- **Three Call 2 sources:** one report had completed normally before the error. Two had completed AI review, report storage and both Slack messages, but not document/dashboard delivery.
- Restored only those two missing delivery tails as dashboard reports **8208 and 8209**, using the saved reviewed output and the existing report records. No model rerun, numerical rescore, replacement report record or Slack resend.
- Guarded resumption re-read the existing report/source identity, rejected an already linked document, verified the existing rep folder, checked for an existing matching file, and used the normal document renderer and ingest mapping.
- Native recovery executions `1178950` and `1178968` completed successfully. Each source has exactly one dashboard record and a delivered receipt; both Google Docs were independently fetched and contain coaching content.
- Additional AI/testing/recovery charge: **$0 in new model calls**. Ordinary platform execution/storage usage is not claimed to be free.

## Verification

- New regression first failed using the actual `Set: call_1` configuration, then passed with the repair.
- `verify-accounting-handoffs.mjs` executes actual Set expressions, checks source pairing and provenance, unknown-status/identity rejection, one writer, error wiring, and mixed-batch orders with injected store failure.
- Native isolated n8n execution `1178904`: four Call 1 items interleaved with three Call 2 delivery stubs; one injected receipt-store failure was captured, all seven loop items completed and all three delivery stubs ran. This is a runtime branch/continuation test, not seven real generated reports.
- 151 existing tests passed; source-accounting, crash-recovery, durable-provider, retry-policy and reliability-contract verifiers passed; TypeScript passed.
- Structural validation: official, manual and weekly workflows have zero errors and zero invalid connections. Existing disconnected legacy audit nodes are unchanged; the active review remains in the current validator path.
- Restored report content, source identity, populated document links and one-record-per-source checked independently. Final natural-run/coverage and hosted-release receipts are recorded in the follow-up below.

### Natural acceptance

Execution `1179002` at 17:26 UTC was a newly arriving production Call 1. Its actual Set, early-outcome accounting and durable exclusion write all completed successfully under the new published version, with no accounting incident. Signed-in report 8208 loaded its existing numeric score and the explanation control expanded correctly. Both restored Docs were independently confirmed populated through Drive.

## Rollback and operation

- Scoped rollback is stored privately outside Git at `.codex-backups/coaching-accounting-containment-2026-10-19.json.gz` (4,738 bytes, mode 0600), containing the selected baseline and inverse operations. Existing earlier backup remains intact. No new dependency copy or transcript archive was made.
- Two one-off helper workflows remain inactive with their manual triggers disabled, clearly named COMPLETED, preserving execution evidence. They have no schedules, webhooks or automatic business deliveries.
- Use `build-accounting-containment.mjs` for this release. The historical `build-source-accounting.mjs` and its baseline describe the prior release and must not be blindly reapplied to production.
- External outages and crashes cannot be guaranteed impossible. This repair specifically prevents tracking status/store failures from terminating the remaining normal delivery branches, while preserving visible failure evidence and the independent coverage checker.
