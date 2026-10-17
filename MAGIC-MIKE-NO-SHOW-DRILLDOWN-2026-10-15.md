> October 17: the daily source architecture below is superseded by [daily attendance reliability](MAGIC-MIKE-DAILY-ATTENDANCE-RELIABILITY-2026-10-17.md). UI and prior rolling-period behavior remain.

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

## Observed application acceptance

PR308 merged e65dba6b7a66526b9e29da453c68e84a7ac910c8; production dpl_D2Zo56SukZqik3qvD7MYhbSk4jYV is READY on rose. The new attendance-v3 source completed at2026-10-15T13:03:29UTC with no failure or remaining lease, confirmed by bounded read-only database metadata. During population weekly v2 remained available; daily views withheld incomplete totals. Signed-in Today showed1no-show/11tracked calls and Bryce's popup1call/3tracked calls; Yesterday15no-shows/348tracked calls, agreeing with the bottom log's15entries. Popup keyboard opening/Escape close worked. Exact counts are cutoff-specific, not enduring totals.

Owner's follow-up requested fewer top controls: Today/Yesterday remain visible; a single dropdown retains7/14/30/90-day ranges. Visual QA also removed internal status markers/repeated reasoning from popup text using the existing log's extraction pattern; original saved evidence is unchanged. Final scoped checks, deployment, full rep search, mobile UI and source-link verification are recorded after this follow-up release.

## Final follow-up verification

PR309 merged282e07d3536b9d91cde084dc67971212e9090747; production dpl_BWwUfSAuBSWSZx3iBEbTmjx65k1z READY on rose. Hosted build passed. Authenticated final checks confirmed Today/Yesterday plus one range dropdown, all four rolling selections, bottom Today/Yesterday/All history, call-type filters and100-to200 history display. Selected-day counts reconciled (Today1, Yesterday15; Yesterday Call2+1). Weekly list47reps: searched Marc beyond the old12-name cap and opened3matching calls. Bryce Today1 and Imad Yesterday2 also matched their evidence. Keyboard opening, Escape close and focus restoration passed. Mobile375px popup displayed the summary, full readable reason and both source links with no horizontal overflow; viewport reset. Existing report7846 and Compliance Review loaded normally. Anonymous history/refresh endpoints both401. No paid AI requests, Slack messages, source Sheet/Airtable edits, n8n, classification, scoring or permission changes. Git rollback and previous snapshot versions retained. Task build cache removed after verification; no checkout copies.

The first new-key population took a background read; weekly fallback stayed available until daily preparation completed. Live counts above are observations at that read cutoff. Future data follows the existing refresh schedule and quiet source timestamps; no yellow freshness banner was reintroduced.
