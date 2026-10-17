# Daily attendance reliability — October 17, 2026

## Confirmed failure

Today/Yesterday read two date-keyed entries embedded in the large attendance-v3 history snapshot. Scheduled refresh requires recent page activity and stops after inactivity. On a later Miami calendar day, the saved rolling aggregates still exist, but the requested daily key may not exist (or yesterday may only have a partial live read). The page then reports unavailable until an entire history read completes. Returning a seven-day result as a daily result or showing zero would be incorrect.

## Scoped repair

- Date-specific daily snapshots read only the requested Miami day and its preceding comparison day. Live and completed-day keys are distinct; a partial live day cannot be reused as completed yesterday. Daily first access initializes synchronously from a small, fully paginated source read, rather than waiting for the full attendance history.
- Bound source reads use the existing processed/attendance-status selection, call-date fallback, classification and deduplication rules. Actual meeting date takes precedence over ingestion date so late-arriving records remain eligible. Empty successful daily results are valid zeros; malformed/failed/unfinished reads never publish zeros.
- Cold concurrent readers can wait briefly for the existing refresh lease owner. Last successful data remains intact on refresh failure. The valid existing daily entry can serve as a fallback only when its date and completed-day cutoff are correct.
- Existing cron warms recently used daily keys sequentially before attendance history to avoid competing readers on the same base. No continuous idle polling added. Daily source budget is 20 seconds; full history remains bounded at 240 seconds. Other source refresh and authentication policies remain unchanged.
- Bottom log Today/Yesterday filters use the same daily service through the existing authenticated evidence endpoint. Switching dates never reuses another date's client response. All-history retrieval is unchanged.
- Full weekly trend/history remains independent and retains its own quiet source-read timestamp. No new yellow banner. Rolling 7/14/30/90-day calculations and full source history are preserved.
- No source Airtable/Google Sheet edits, coaching/intake/scoring/compliance workflow changes, model changes, Slack messages, or report regeneration.

## Verification

Pre-release: 75 targeted tests across 10 suites pass, including inactivity across dates, live/closed separation, DST 23/25-hour days, pagination, evidence/count parity, zero/failed sources, concurrent cold initialization, source sync and admin access. TypeScript, scoped ESLint and production build passed. Hosted source-data and browser acceptance follows below; a local environment download does not expose secret-only Airtable credentials, so it is not claimed as a source integration test.

## Release / rollback

Baseline main 44a285020604b46bab2046ad07917527341374c4. Revert only this scoped repair and deploy to roll back; previous attendance-v1/v2/v3 snapshots remain intact. New daily snapshots are additive; no schema migration or bulk local backup is required. External outages remain possible; this fix removes the confirmed daily-date/full-history dependency, not every possible provider failure.

Live verification pending; do not interpret pre-release checks as production acceptance.
