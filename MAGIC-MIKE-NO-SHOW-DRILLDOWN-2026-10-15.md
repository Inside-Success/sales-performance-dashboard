# Rep no-show daily views and rep evidence — October 15, 2026

## Approved scope

Owner approved Mike's no-show navigation request: clickable rep summary, compliance-style popup, daily filters, and Today/Yesterday in the bottom detected-call log. Pass-off detection remains explicitly out of scope. No Slack messages, automatic digest, provider/model change, n8n change or source write is authorized by this scope.

## Implementation

- The right-hand Rep No-Show Summary lists every rep with detected no-shows for the selected period, sorted as before. Removes the silent top12 cap; provides name search in a bounded scroll area.
- Clicking a rep opens the existing Base UI dialog primitive with managed focus/Escape/backdrop close, visible close control and matching styling. Shows period-specific totals, tracked-call denominator, rate, Call1/Call2+ split, full detection reasons and original transcript/Zoom links. Evidence is already in the page's successful read; no provider/API call occurs on popup open. Long evidence lists progressively display100 calls.
- Today/Yesterday use America/New_York calendar midnights, including daylight-saving boundaries. Today is in progress and is not compared with an entire completed yesterday. Yesterday compares with the preceding complete calendar day when tracking coverage permits. Existing7/14/30/90 calculations stay intact.
- Background attendance-v3 adds the two date-keyed daily results and complete rep lists. Previous v2/v1 successful reads remain weekly fallback during population and rollback. New-key refresh is leased; old successful data is not overwritten by errors. A saved read from before Miami midnight is due for refresh. If a requested daily result is not available, it is unavailable rather than an invented zero.
- Bottom log has independent Today/Yesterday, selected rolling period when applicable, and All history. Original call-type/search/history controls are preserved; historical reads are still authenticated and read-only. No yellow freshness banners return.
- Existing no-show chat carries the selected daily scope into its factual context and filters example calls to that period. No model, key, new AI stage or paid test submission.

## Release and verification

Pre-release: 50 tests across9suites, scoped ESLint and TypeScript passed; webpack production build passed. Live acceptance and exact deployment receipt are recorded in the local continuity packet after release. Tests cover midnight inclusivity/exclusivity, DST23/25-hour days, daily denominators, deduplication, popup count parity and access to reps beyond12; existing rolling-window and authorization regression gates remain required. No dev server or full repository backup copy.

## Rollback

Revert the scoped Git release. Previous attendance v2 data remains in the dashboard-owned snapshot table, so the previous application can resume without source writes or deletions. Source attendance classification, identity resolution, scoring, coaching content and admin permissions remain unchanged.
