# Sales Impact authenticated read repair — October 8, 2026

## Scope and source boundary

User approved Sales Impact repair only. Company **Payment/Commission Tracking** spreadsheet remains private and read-only. Source ID: `1lBdE_LUKI8rzTvYc5vztSwKROJ7uIAOb5mNT9s4PeLA`, tab `Main`. No changes to source cells, sharing, tabs, formulas, sales workflows, coaching generation, compliance or prospect names.

## Diagnosis and repair

The dashboard's unauthenticated CSV export returned HTTP 401; the availability fallback was September 23. Existing n8n Google Sheets OAuth `admin@mawercapital.com` successfully reads the Sheet.

An isolated sync reads only A, C, D, H, I, J and K via Google Sheets API GET. It sends the seven ranges to `/api/sales-performance/sync` with a dedicated server-only bearer credential. No AI node, no customer emails. The endpoint validates the exact source ID, all seven range identities, headers and paid-sales structure using existing date/payment parsing, then saves to dashboard-owned Postgres snapshots. Failed reads/validation/persistence preserve previous data. Existing manager access remains unchanged.

After first authenticated sync, page requests use the validated saved read. Freshness is based on successful persistence, not attempted refresh; after two hours a warning marks last-good data as a fallback. Before first sync, the prior CSV/fallback behavior remains available.

## Release verification

In progress; fill live workflow, deployment and end-to-end verification receipt after release. Read-only QA execution `1023197` succeeded: 3931 valid rows, 3731 paid, 1379 new paid, latest sale October 7 (source read at 15:57 UTC October 8).

## Rollback

Deactivate only the isolated Sales Impact sync workflow; revert the scoped Git PR. Existing CSV reader and previous snapshots remain available. Do not change Google Sheet access or source contents, or revert unrelated production work. Dedicated credential/environment variable can remain inert until the repair is re-enabled.

## Pending work outside this approval

Incorrect prospect names and previously deferred compliance questions remain pending. Sales/engagement association does not prove that coaching caused sales; this repair fixes current source access and freshness.
