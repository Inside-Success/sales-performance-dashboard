# Closed Sales Library — October 22, 2026

## Scope

Admin Insights links to `/manager/closed-sales`, using the existing exact-email manager authorization. The page offers client/rep/show search, show-family and rep filters, a reports-available filter, 25 entries per page, and clearly expandable call details. Existing coaching reports open at their original `/call/:id` URLs.

The library is an isolated research snapshot, not a coaching workflow or sales ledger. It has no AI calls, scheduled jobs, source writes or automatic report generation. No permissions were expanded. Source Google Sheets, Docs, Slack, Zoom and n8n workflows were not modified.

## Collection and evidence

- Source: Pay Me channel `C07TQKSJ5J8`, posts from April 22 through October 22, 2026 (Miami dates).
- Paginated monthly reads collected 1,811 unique channel messages, including 1,120 Pay Me forms. All 570 available form threads were retrieved with no reported connector errors or remaining pagination.
- Grouping identical normalized rep/client/show/purchase-date entries produced 1,117 library entries. This is an entry count, not an audited unique-deal or revenue count.
- 1,107 entries contain source recordings; 396 have related existing coaching reports. Ten contain no supported recording URL; one lacks a client name in the source.
- 26 entries have replies discussing a refund/cancellation; the library tells readers to check the linked source for current status. It does not infer a refund outcome or quietly delete history.
- Show labels: Documentary, Reality, DJ / NLCEO, Other. Unknown source show names remain Other, rather than being guessed.
- Three repeated same-day entries are grouped, preserving all source links.
- Existing report metadata was read in one database query. No reports were regenerated or manually rewritten.

## Matching limits

Name matches require both normalized rep and client, and a bounded sale-date window (30 days before through two days after the form purchase date). Name-only matches are explicitly disclosed. Recording-link matches normalize Zoom host aliases and query metadata. Onboarding/script/fulfillment report titles are excluded. Existing close outcomes prioritize likely sales conversations; common payment-only/onboarding outcomes are not prioritized.

**A last numbered recording is not assumed to be the closing call.** Existing outcome summaries and source recording numbers do not independently prove that a particular conversation is the final substantive sale. The page retains related conversations and source evidence, and labels candidates accordingly. Six months of raw recordings have not all been watched or transcribed. Zoom playback/access and passcodes remain subject to the original sharing settings.

Follow-up links are retained, explicit correction wording replaces the superseded Recording 2, and forwarded forms belonging to other clients are excluded. An incomplete client identity remains visibly incomplete and is never merged with another incomplete entry.

## Storage and refresh

`closed_sales_library_snapshots` is the only table written. Snapshot key: `six-month-2026-10-22`. The validated JSON payload is about 1.2 MB. Publication is a single atomic upsert after schema validation. The application only reads it after authorization; it never creates tables or contacts Slack/Zoom on page views. Only 25 selected entries are rendered per response. Raw email/phone/payment/contract fields are not included in the published payload or Git.

The source extract stays in the private local task folder outside Git. To rebuild, supply private `slack-entries.json`, `reports.json`, and `threads.json` to:

```sh
npx vite-node scripts/import-closed-sales.ts /absolute/private/input
```

This writes a local validated snapshot only. `--publish` explicitly enables the isolated table upsert and requires `DATABASE_URL` in the environment. It does not update source systems. The page displays the collection period/date; it is not an automatically refreshing feed.

## Verification

- Parser tests cover blank-field boundaries, identity/date matching, onboarding exclusion, payment-only outcome handling, missing identities, duplicate provenance, corrected reply links, forwarded-client isolation, category labels and unsafe URLs.
- Read-model tests cover authorization before DB access, isolated read-only storage, filtering before pagination and out-of-range page correction.
- Existing admin authorization tests remain included in the verification run.
- Local webpack production build passed. Default local Turbopack cannot resolve the pre-existing shared `node_modules` symlink; no project configuration was changed to work around that. Vercel uses its normal fresh install/build.
- 37 focused tests passed, along with scoped ESLint and the local production webpack build.
- Isolated snapshot publication and read-back count passed (1,117 entries).
- Signed-in existing Admin Insights and coaching homepage remained accessible during verification.

## Release status: live

The Git-source staged production deployment `dpl_5LPrdbK5BwtuCh1F34HDW1vgEVbf` (commit `65c36fca5e3d9e8301267a3bd7cf805e8bd9828b`) passed the Vercel production build and was promoted after the existing tests and snapshot read-back checks. Automatic custom-domain assignment was disabled during staging. Previous preview attempts failed before application build with `Resource provisioning failed`; the staged production build succeeded without changes to application code, billing or project settings.

Live page: https://sales-performance-dashboard-rose.vercel.app/manager/closed-sales

Authenticated live verification confirmed 1,117 entries, expandable recording/report/source details, DJ / NLCEO filtering (five entries), page-two pagination and exact client search. The staged hostname redirected sign-in to the main domain; authenticated UI verification was therefore performed immediately after promotion. Previous production deployment `dpl_HGsE8u9pcqPDCEgnjGRhH62Vcnir` remains the rollback reference. PR #337 records the scoped implementation. Source systems and coaching generation remain unchanged.

## Cost and rollback

No paid AI inference, report generation or transcription was used: $0 incremental AI cost. Existing hosting/database usage is not claimed to be free.

Rollback: revert this scoped release to remove the directory link and route. The isolated snapshot can remain unused. Do not roll back coaching workflows, access settings, source data, or unrelated deployments.
