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
