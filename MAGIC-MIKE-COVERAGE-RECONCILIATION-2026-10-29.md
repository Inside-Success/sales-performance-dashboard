# Coverage reconciliation — October 29, 2026

## Findings

Two unresolved source records represented different cases. One duplicate intake row shared its exact Automation Key / recording file with an already excluded canonical row. The recording claim correctly prevented another run, but coverage joined receipts by source ID only. The other call failed at Airtable scorecard creation with a service-unavailable response; its error branch notified operations but did not persist a recovery receipt or settle ownership.

## Decision and safeguards

- Coverage may use an exact recording identity to locate a completed canonical claim, but must also verify an excluded canonical receipt. A done claim, missing execution, delivered receipt without dashboard evidence, similar client name, or elapsed time alone never closes a source.
- Bounded never-started reservation rotates candidates so one blocked identity cannot starve the others. Declined reservations expose the existing canonical source and status.
- Airtable scorecard-create failures persist an uncertain-write review receipt and settle only the matching source owner. Existing alerts and delivery paths remain unchanged. Do not blindly retry create operations: a timeout may hide a successful write.
- No AI stages, models, prompts, source calls, or sales rules change. Preserve existing caching and reviewed-output checks.

## Validation

Focused tests cover exact aliases, unmatched/active claims, non-exclusion receipts, and uncertain-write holds. Live acceptance and scoped recovery results are recorded below after deployment.

## Rollback

Revert the application commit; restore the previous coverage plan code. Restore Set: airtable_failed directly to Build Ops Alert, then remove the four newly added write-failure accounting nodes and their new edges only. Do not revert business artifacts or settled recovery receipts. Private baseline workflow snapshots are retained outside Git.

## Published workflow verification

Official published graph: `b99e27de-0323-4d5e-8af2-b2e1d5486105` (159 nodes; no added AI nodes). Coverage graph: `9600d728-5338-44f9-bfd7-88c048c8fbd1` (15 nodes). Both validate with zero errors and zero invalid connections. Existing official unreachable-legacy-node warnings remain unchanged.

The scorecard error path is sequential: prepare hold, persist receipt, settle matching source owner, restore the original alert context, then send the existing alert/continue the loop. Its added fallible stages route to the existing accounting incident handler. Exact saved and published graphs match, and all original nodes and unrelated connections are preserved. Exact Code payload replays verify source pairing and exclusion matching without external writes or AI calls.

## Live recovery and release acceptance

PR #348 merged as `ca01d3bc71c0ff20620dfcca53bfa2fa2573c5c0`. GitHub reliability checks, TypeScript and production build passed. Production alias resolves to Ready deployment `dpl_7XjbihMJjPKrPhn2xgiGzkX528sx`.

Scoped recovery of `recnuD90vDSDwLGUG` used the normal recovery worker and current official workflow. Execution `1411519` completed successfully on October 29 at 17:29:22 UTC. Ledger row 4425 is delivered and the matching source claim is done. Dashboard report [8857](https://sales-performance-dashboard-rose.vercel.app/call/8857) and its Google Doc exist; Slack send, document insertion, dashboard ingest, delivery receipt and settlement nodes succeeded. Authenticated UI verification confirmed the Enhanced report for The Barndominium Company / Cristian Turri. Exactly one dashboard report matches the source transcript.

Recovery was authorized only after confirming the original scorecard-create service-unavailable alert, no existing report artifacts, and no active checkpoint lease. A missing historical execution alone was not treated as permission to replay.

The temporary read-only diagnostic workflow was deleted after its two completed execution records and recovery evidence were saved privately. No unrelated executions were cancelled. No AI stages, prompts, models or sales FAQ behavior were changed. Source Airtable rows were not edited.

Coverage verification: scheduled execution 1411750 closed the delivered source while finishing the previous page. Two bounded follow-up pages ran through an exact clone of the production coverage graph (temporary webhook trigger only). Execution 1411822 confirmed the exact duplicate-to-canonical alias, canonical exclusion receipt, empty `missing_ids`, empty `queue_ids`, and empty notifications. The persisted unresolved list is empty as of 17:38:50 UTC. Pagination intentionally retains unresolved IDs until their source page is revisited; it does not infer identity for unread records. No duplicate report was generated. The temporary coverage verification workflow was removed after preserving execution evidence.
