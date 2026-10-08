# Sales Impact authenticated read repair — October 8, 2026

## Scope and source boundary

User approved Sales Impact repair only. Company **Payment/Commission Tracking** spreadsheet remains private and read-only. Source ID: `1lBdE_LUKI8rzTvYc5vztSwKROJ7uIAOb5mNT9s4PeLA`, tab `Main`. No changes to source cells, sharing, tabs, formulas, sales workflows, coaching generation, compliance or prospect names.

## Diagnosis and repair

The dashboard's unauthenticated CSV export returned HTTP 401; the availability fallback was September 23. Existing n8n Google Sheets OAuth `admin@mawercapital.com` successfully reads the Sheet.

An isolated sync reads only A, C, D, H, I, J and K via Google Sheets API GET. It sends the seven ranges to `/api/sales-performance/sync` with a dedicated server-only bearer credential. No AI node, no customer emails. The endpoint validates the exact source ID, all seven range identities, headers and paid-sales structure using existing date/payment parsing, then saves to dashboard-owned Postgres snapshots. Failed reads/validation/persistence preserve previous data. Existing manager access remains unchanged.

After first authenticated sync, page requests use the validated saved read. Freshness is based on successful persistence, not attempted refresh; after two hours a warning marks last-good data as a fallback. Before first sync, the prior CSV/fallback behavior remains available.

## Release verification

Completed and verified October 8, 2026, around 16:22 UTC (21:22 Pakistan).

- Code PR269 merged `4bb63d710940e596bb7fecdba129104f7e6dc14e`; production deployment `dpl_HiBWoJCVPqsBFMu2kUrC2iQGrL3j` READY. The existing rose alias required explicit assignment; verified the live endpoint afterward. Preview failed before build with the pre-existing resource-provisioning limitation; no preview infrastructure was changed.
- Published isolated sync `g1NIBkWlOBFzbubI`, final active version `d14992b6-b9a4-479e-b9bc-edd49a6490bf`, four nodes, hourly schedule in America/New_York. Authenticated webhook is available for authorized refreshes. Source HTTP method is GET only; POST goes exclusively to dashboard-owned persistence. Both requests retry at most three times.
- Read-only source QA `1023197`, first save `1023524`, automatically triggered save `1023559`, and final restored-configuration save `1023663` succeeded. Final snapshot69: 3931 valid rows, 3731 paid rows, 1379 new paid rows, latest sale October 7. The automatic-trigger QA temporarily used a one-minute schedule; final published interval was inspected and is one hour.
- Invalid credential returned401; authenticated invalid payload returned400; database snapshot68 remained unchanged. Controlled workflow failures `1023611` and `1023647` were intentional QA. They produced no invalid snapshot. Failure workflow required publication on this n8n instance; published logger `s927mUKeEwKWwGKR` then ran successfully as error execution `1023650` and wrote an execution/node receipt to isolated table `KYCIQ3zrFIUcgrWg`. The valid payload mapping was restored, validated, published and successfully exercised as `1023663`. No Slack notification was sent.
- Ten sync tests plus six existing Sheet-health tests passed. TypeScript, scoped ESLint, and production webpack build passed; Vercel production Turbopack build also passed. Tests cover authentication, exact source/ranges, sparse row alignment, parser parity, invalid-data rejection, failed persistence, stale fallback and avoiding unauthenticated fetch after sync.
- Signed-in Chrome: live synced badge and authenticated source timestamp, 7/30/90-day filters, expandable detail and rep drilldown verified. The 30-day view showed $808,200 from164 new paid deals. Coaching selector and FAQ navigation loaded under the same signed-in account; no new AI request was submitted. This is bounded regression evidence, not a complete re-audit of every report or all workflows.
- No AI node added or paid AI calls made; additional AI testing cost USD0.00. Normal existing hosting/n8n/database consumption applies.

Sanitized published workflow definitions are stored in `workflows/magic-mike-sales-impact-read-sync.json` and `workflows/magic-mike-sales-impact-sync-failure-log.json`. They contain credential references only. The production-only `SALES_PERFORMANCE_SYNC_SECRET` is held in Vercel; its matching header is held in the dedicated n8n credential. Never commit secret values, private source data or webhook execution headers.

## Honest limits

This restores sales-data access and freshness. Existing association/rep-matching calculations are unchanged. The dashboard continues to disclose that engagement correlation does not establish causation, and lists unmatched sales names separately. Only two unmatched names with new paid sales appeared in the checked30-day view; this repair does not silently merge aliases or claim independent verification of every source entry. Future credential revocation or source outages can still delay refresh: after two hours the UI warns and retains the last successful read.

## Rollback

Deactivate only the isolated Sales Impact sync workflow; revert the scoped Git PR. Existing CSV reader and previous snapshots remain available. Do not change Google Sheet access or source contents, or revert unrelated production work. Dedicated credential/environment variable can remain inert until the repair is re-enabled.

## Pending work outside this approval

Incorrect prospect names and previously deferred compliance questions remain pending. Sales/engagement association does not prove that coaching caused sales; this repair fixes current source access and freshness.
