# Magic Mike delivery and intake reliability — September 8, 2026

The authorized release updated the existing Coaching delivery and Zoom intake workflows. Ask Sales, dashboard application behavior, model prompts, manager access, and scoring rules were unchanged.

## Changes

- Preserve folder mappings when Google Drive verification fails. Replace a mapping only after a replacement folder is successfully created.
- Resume failed stages from saved, item-linked execution checkpoints with bounded delayed retries. Do not repeat completed analysis or delivery stages.
- Retry explicit quota rejection on non-idempotent writes; hold ambiguous timeout/server-error write outcomes for reconciliation rather than risking duplicate documents.
- Handle document failures even when document-building nodes never ran, and retain unresolved failures in a durable ledger.
- Recover transcript download, classification, document creation, and insertion stages while preserving existing source-record guards.
- Prevent late pending events from clearing completed transcript records.
- Use bounded keyset pagination for pending reconciliation, with separate recent-call and historical queues. Each account reads at most 25 rows per scheduled pass. Source timestamps and historical pending records are preserved.

## Verification and result

Local failure-policy, item-identity, graph, and successful-output fixture checks passed. An isolated n8n execution persisted a 65-second wait and resumed with the same synthetic identity. Read-only verification against the live source confirmed disjoint consecutive historical pages and a separate recent page.

Four interrupted Coaching deliveries were recovered from saved analysis. Three intake calls were restored in their existing source rows; their normal Call 1/Call 2 handling was preserved. Production delivery was verified after the release. One exact Zoom transcript remains unavailable: fresh authenticated downloads still return 404. Its pending source and durable review record remain intact. It is not marked resolved.

Intake full validation returned no errors. Coaching had no new validation errors; existing static-analysis findings in unchanged analysis nodes remain documented privately. Temporary test/recovery endpoints are inactive.

## Operational limits

This n8n instance publishes API updates to active workflows immediately. Validate before updating and verify the published graph afterward. Preserve linked-item identity, stage checkpoints, and the failure ledger. Ambiguous writes require reconciliation; this release does not claim global exactly-once processing or complete recovery of the historical backlog.

Configured workflow exports, incident identities, confidential fixtures, exact recovery evidence, and rollback versions remain in the private local workspace handoff and `.magic-mike-repair-2026-09-08/`. They are intentionally excluded from this public repository. The standalone policy modules in `scripts/magic-mike-reliability/` contain no credentials or call content. No production transcript or configured workflow export should be added to this repository.
