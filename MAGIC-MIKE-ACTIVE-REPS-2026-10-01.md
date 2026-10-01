# Coaching rep selector — October 1, 2026

## Approved behavior
Only names with an official Call 2 coaching report dated within the preceding 60 rolling days appear in the coaching-home selector. The date is the original call_date, not report creation or update time. The existing official pipeline emits scored coaching reports after its Call 1/no-show/exclusion gates; manual submissions use separate storage. A new qualifying official report automatically restores a name on the next page load. This is activity-based visibility, not an employment roster.

The 60-day window applies only to name choices. Qualifying reps retain their older reports, original all-time report counts, date/search filters and direct report links. Archived rep bookmarks still resolve their name and reports without putting that name back into the choices. No records are deleted or regenerated.

## Implementation
- CoachingHome filters the complete official RepSummary roster using latest_call_date, before passing choices to RepPicker. getDashboardData and every report query remain unchanged.
- Case-insensitive alphabetical ordering and existing name search retained.
- Removed the first-80 restriction from RepPicker for both empty and populated searches. Its shared manual-report consumer receives its existing full roster, with no activity filtering.
- Explicit selectedRepSummary preserves the selected-name display for old bookmarked rep links.
- No schema, n8n, model, auth, scoring, compliance, manager filters or FAQ changes.

## Verification before release
18 targeted tests passed, including seven new cutoff/returning-rep/all-time-count and rendered-page regression checks. Rendered-page tests prove that an active rep's historical date request is passed unchanged and its old report remains rendered; an archived bookmark preserves its name and report. TypeScript, scoped ESLint and diff checks passed. Production webpack build passed. Hosted verification is recorded below when complete.

Read-only production baseline: 277 names, 155 with saved official coaching activity in 60 days, 122 outside. Counts are a snapshot, not permanent. No call_date is missing. All 7,063 rows currently have scored status. The activity measure relies on delivered official reports; an upstream call without a delivered report cannot contribute to this roster. Preserve the separately deferred intake work.

## Rollback
Initial baseline main: 1d9f56a7e367b2ce163e1dfc55fffe4ed9c04555. Concurrent FAQ PR250 was incorporated and rebuilt before release; immediate pre-release main is 65c2e62bf2cd6d67d67f6952a568528dcc9a82f3, production dpl_3zvM2oASaiPmUXsDUQSQD3wpRX6q. Preserve that FAQ update when rolling back. Revert only this selector release. No database or workflow rollback is required. Existing reports and source data were not changed.

## Final live verification
PR251 merged at 0fe0be14639bbd0085deff32746cddb9517ca86c. Production dpl_E3VBwjaBtjYsoodUSiHBeyHaTzp4 is READY and owns sales-performance-dashboard-rose.vercel.app. Fresh main was incorporated and the production webpack build rerun successfully; seven selector checks plus five current FAQ-knowledge checks passed together. Eighteen targeted coaching tests passed before that unrelated merge.

Authenticated Chrome: homepage shows 155 names; the open list contains exactly 156 options including All reps. All 155 rep choices render, including Matthew Jones at position 101 and final Yanni McLean. Adam Pellegrino is absent and search produces no match. Searching/selecting Matthew Jones loads all 36 saved reports, including May/June dates. Active Adetokunbo's historical 2026-07-31 date filter returns report4516, which opens with its original detailed legacy coaching. Adam's archived bookmark still displays his name and seven retained reports. Self-submitted reports still load their separate 26-name selector. No captured browser console errors in the checked flow. Screenshot saved privately in .magic-mike-active-reps-2026-10-01/selector-production.png.

Preview dpl_gPkodzfem1zGDRqYzo8vBHHj8Hu2 failed with Resource provisioning failed before an application build; preview success is not claimed. Local and production builds succeeded. There were no business-data writes, paid AI tests, workflow triggers, Slack sends or Google source edits. Normal signed-in page/selection telemetry can be recorded by existing tracking.

Eligibility is derived on each dynamic coaching-home request from the original official latest_call_date summary. Existing per-request report batching remains unchanged; date/search/direct links retain historical access. This release does not classify undelivered calls or fix upstream intake gaps. Reality/compliance and other deferred work remain deferred.
