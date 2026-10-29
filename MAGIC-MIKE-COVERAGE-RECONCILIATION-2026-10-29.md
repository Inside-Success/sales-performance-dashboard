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

Revert the application commit; restore the previous coverage plan code. Remove the two newly added write-failure accounting nodes and their new edges only. Do not revert business artifacts or settled recovery receipts. Private baseline workflow snapshots are retained outside Git.
