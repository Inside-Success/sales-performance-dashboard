# Rep Performance Reviewer

Production implementation record for the hidden Magic Mike manager page and its isolated scoring pipeline.

## Production boundaries

- Page: `/manager/rep-scoring`
- Access: exact allowlist from `REP_SCORING_ADMIN_EMAILS`; initial admin is `syed.haider@insidesuccess.com`.
- Source: the existing `Zoom Closer Calls` table is read-only. The upstream Zoom intake already restricts calls to the two approved Closer groups.
- Storage: separate Airtable base `appEQQkTlJnc7tJgi`.
- Google Docs: transcript reads only. No Docs or Drive writes.
- Slack: no credential and no reads or writes.
- Existing Magic Mike workflows `qMQYNQtQbRZWjtG2` and `L8Nn7xncA9ZPDdWA` are unchanged.
- The output is a coaching and review signal, never an automated employment verdict.

## n8n

Main workflow: `JQgSOlzomtjBotYJ` (`MM Rep Performance Reviewer - Isolated Shadow`).

The workflow reads a rolling seven-day source window, processes one call at a time, uses a processing ledger for idempotency, reads the transcript, calls `deepseek-v4-pro`, validates exact timestamp/speaker/quote evidence, computes the weighted score in code, and writes either an immutable assessment or a quarantine record.

Before applying the 15-call cap, each run reads all eligible calls in the rolling seven-day source window, collapses that multi-record read to one ledger request, and removes v3 idempotency keys that are completed or actively leased. This lets later hourly schedules advance through the backlog without multiplying Airtable reads or repeatedly selecting the same oldest rows. Active processing leases are treated as owned work and skipped by overlapping retries. The dashboard also de-duplicates immutable assessments and quarantine rows by their stable IDs, so a retried request cannot inflate manager metrics.

Every scheduled run now writes a separate coverage snapshot to `scoring_runs`. The snapshot records the exact seven-day candidate count, completed ledger count, active leases, waiting calls, selected batch size, and cutoff. It is a fan-out telemetry branch: it does not modify source calls or the existing score/quarantine/ledger path. The manager page uses the latest snapshot to state explicitly how much of the rolling week has and has not been processed.

V3 also treats a missing or `null` critical-event score cap as no cap. V2 is retained as immutable audit history but is excluded from the live manager view because JavaScript numeric coercion could turn a model-returned `null` cap into an incorrect zero composite.

Manager quarantine counts begin at the controlled backfill launch (`2026-07-30T17:09:57Z`) and exclude a quarantine when the same idempotency key later has a valid score. Earlier validation rows remain in Airtable for audit history but are not presented as live rep-performance problems.

Current scorer contract:

- Scorer: `rep-reviewer-v3`
- Prompt: `rep-prompt-v2`
- Config: `rep-scoring-config-v2`
- Model: `deepseek-v4-pro`, thinking enabled, medium reasoning
- Call 1 and Call 2+ use separate dimensions and weights.
- Prerecorded video statements do not earn rep-performance credit.
- Invalid dimension or critical-event evidence quarantines the call.
- A claimed met behavior with invalid evidence now fails closed as `internal_inconsistency` and the call is quarantined. Older inconsistent v3 rows remain immutable audit history but are excluded from manager rollups.

One-time setup workflows are retained inactive as rollback/audit records:

- Airtable schema: `9O3sc3jOAdUrwXmH`
- Initial configuration: `AhUI8s3XNYZ3x33y`
- Access verification: `r6ZoJQeh8RIbdAc0`

## Airtable tables

- `processing_ledger`: `tbl7YKjR3vsuyHynd`
- `call_scores`: `tblEcY6gKRxDUd5Li`
- `quarantine`: `tbl5TXjtjjSAXWjkb`
- `rep_identity`: `tbloXFrLtS3MnAY81`
- `rep_rollups`: `tbl8zsbIn77o80yF2`
- `config`: `tbl8sgHEgvEvn43Cc`
- `formal_reports`: `tbllnZTrnReUVQfy7`
- `scoring_runs`: `tblPadsfFbjxcCQz2`

The dashboard derives current seven-day rollups directly from current-version immutable scores and excludes internally inconsistent assessments. Call 1 and Call 2+ remain separate.

## Manager experience

The hidden page is intentionally a score-and-coaching hybrid:

- The factual 0–100 score and its band remain prominent.
- The page states that a call card is one call, not a weekly rep conclusion.
- Weekly coverage appears before performance metrics: eligible, completed, active, and waiting.
- Valid scores and unable-to-score calls are separate metrics.
- One or two calls are labeled exactly as limited evidence; a supported manager review signal requires at least three scored calls of the same type.
- Each rep row identifies the lowest-scoring coaching priority and strongest dimension.
- `/manager/rep-scoring/rep/[repKey]` provides a rep drill-down without pooling Call 1 and Call 2+.
- Call evidence pages show dimension names, weights, band points, score contribution, reasons, quotes, timestamps, behavior status, call context, and technical provenance.

Display bands for the current v3 scorer are factual labels for the assessed call:

- 0–24: Unacceptable
- 25–49: Needs Improvement
- 50–69: Developing
- 70–84: Meets Expectations
- 85–100: Excellent

The workflow, not DeepSeek, calculates the final numeric score from the stored band points and weights.

## Vercel environment

All values are server-only; none use the `NEXT_PUBLIC_` prefix.

- `REP_SCORING_ENABLED=true`
- `REP_SCORING_ADMIN_EMAILS`
- `REP_SCORING_AIRTABLE_TOKEN`
- `REP_SCORING_AIRTABLE_BASE_ID`
- Optional table overrides: `REP_SCORING_ROLLUPS_TABLE`, `REP_SCORING_CALL_SCORES_TABLE`, `REP_SCORING_QUARANTINE_TABLE`, `REP_SCORING_CONFIG_TABLE`

If the feature flag or token is missing, the page renders a clear safe-unavailable state and performs no writes.

## Review access

Use the canonical production route: `https://sales-performance-dashboard-rose.vercel.app/manager/rep-scoring`.

The initial administrator is exactly `syed.haider@insidesuccess.com`. That address is permitted by the global Google sign-in gate and separately required by the rep-scoring page allowlist. Preview deployments do not inherit production authentication secrets and are not valid review links. The sign-in page distinguishes an unconfigured preview from a genuine email rejection so infrastructure failures do not appear to be allowlist decisions.

## Verification and rollback

Verified without running a local development server:

- n8n workflow validation: zero errors
- Rep-scoring presentation unit tests: four passing tests covering contribution math, readable labels, evidence confidence, and strongest/weakest dimension selection
- Dashboard lint and Next.js production build after the manager-experience redesign
- Source Airtable and isolated store credential access
- DeepSeek V4 Pro request using the task-specific credential
- Exact-quote failure quarantine
- Call 1 invalid applicability quarantine
- Reasoning-token exhaustion quarantine
- Valid v2 Call 2+ score written with exact evidence
- One-week shadow backfill execution `413452`: 10 eligible calls examined, 7 new v2 scores, 1 quarantine, and 2 previously completed calls skipped
- Corrected v3 smoke execution `413836`: 1,106 eligible source rows collapsed to one ledger request, 1 new call selected, and a 70-point `Meets Expectations` score written despite a `null` critical-event cap
- Corrected v3 batch execution `413852`: 1,108 eligible source rows, 10 selected calls, 3 valid v3 scores, 4 evidence quarantines, and 3 calls safely skipped after a concurrent run completed them first
- Dashboard lint and production build
- Production Vercel deployment `dpl_FsiWwGNtTgfPynFZQyNE5TjUWnfL` reached `READY` and the hidden route returned the protected Magic Mike sign-in boundary

The one-time human calibration is intentionally separate from normal manager use. See `REP-SCORING-CALIBRATION.md`. Rubric weights or thresholds must not be changed merely to make current scores look better; calibration evidence controls any later scoring-contract revision.

Rollback is independent by layer:

1. Disable the n8n schedule or deactivate `JQgSOlzomtjBotYJ`.
2. Set `REP_SCORING_ENABLED=false` or remove the Vercel variable.
3. Revert the dashboard release commit.

No rollback step modifies the production coaching intake, official scorer, source Airtable records, Slack, or Google content.
