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

Active processing leases are treated as owned work and skipped by overlapping retries. The dashboard also de-duplicates immutable assessments and quarantine rows by their stable IDs, so a retried request cannot inflate manager metrics.

Manager quarantine counts begin at the controlled backfill launch (`2026-07-30T17:09:57Z`) and exclude a quarantine when the same idempotency key later has a valid score. Earlier validation rows remain in Airtable for audit history but are not presented as live rep-performance problems.

Current scorer contract:

- Scorer: `rep-reviewer-v2`
- Prompt: `rep-prompt-v2`
- Config: `rep-scoring-config-v2`
- Model: `deepseek-v4-pro`, thinking enabled, medium reasoning
- Call 1 and Call 2+ use separate dimensions and weights.
- Prerecorded video statements do not earn rep-performance credit.
- Invalid dimension or critical-event evidence quarantines the call.
- A claimed met behavior with invalid evidence is downgraded to `not_observed` and the assessment is marked internally inconsistent.

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

The dashboard can derive safe provisional rollups directly from current-version immutable scores until the materialized `rep_rollups` table is populated. Call 1 and Call 2+ remain separate.

## Vercel environment

All values are server-only; none use the `NEXT_PUBLIC_` prefix.

- `REP_SCORING_ENABLED=true`
- `REP_SCORING_ADMIN_EMAILS`
- `REP_SCORING_AIRTABLE_TOKEN`
- `REP_SCORING_AIRTABLE_BASE_ID`
- Optional table overrides: `REP_SCORING_ROLLUPS_TABLE`, `REP_SCORING_CALL_SCORES_TABLE`, `REP_SCORING_QUARANTINE_TABLE`, `REP_SCORING_CONFIG_TABLE`

If the feature flag or token is missing, the page renders a clear safe-unavailable state and performs no writes.

## Verification and rollback

Verified without running a local development server:

- n8n workflow validation: zero errors
- Source Airtable and isolated store credential access
- DeepSeek V4 Pro request using the task-specific credential
- Exact-quote failure quarantine
- Call 1 invalid applicability quarantine
- Reasoning-token exhaustion quarantine
- Valid v2 Call 2+ score written with exact evidence
- One-week shadow backfill execution `413452`: 10 eligible calls examined, 7 new v2 scores, 1 quarantine, and 2 previously completed calls skipped
- Dashboard lint and production build
- Production Vercel deployment `dpl_VxUxmgzY8zmype1Noyn3j6CheC7P` reached `READY` and the hidden route returned the protected Magic Mike sign-in boundary

Rollback is independent by layer:

1. Disable the n8n schedule or deactivate `JQgSOlzomtjBotYJ`.
2. Set `REP_SCORING_ENABLED=false` or remove the Vercel variable.
3. Revert the dashboard release commit.

No rollback step modifies the production coaching intake, official scorer, source Airtable records, Slack, or Google content.
