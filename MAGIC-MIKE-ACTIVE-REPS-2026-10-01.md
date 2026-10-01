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
Baseline origin/main: 1d9f56a7e367b2ce163e1dfc55fffe4ed9c04555; previous production dpl_7wDaHu2mvprVQshzQjD2GaPbBZKj. Revert only this selector release. No database or workflow rollback is required. Existing reports and source data were not changed.
