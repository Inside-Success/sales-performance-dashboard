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

## Verified production receipt

- PR317 merged f617593daec46e660b965b8bdf22583e5dad4aa1 (application a42aa2a19a46186a8021660992bfd926d5bb919c). Production dpl_7ejT1W7WaQgN3C181h36xGowMLUU is READY on the rose alias. The branch preview hit the existing resource-provisioning failure before build; production acceptance was verified directly, not inferred from that preview.
- Reproduced the unavailable Yesterday state on the exact production URL before release. After release, authenticated Yesterday and Today loaded from actual successful date-specific source reads, not the fallback. PostgreSQL receipts have payloads and no failed refresh markers.
- At October 17, approximately 08:28 Miami: Yesterday (October 16) has 257 tracked calls, 14 no-shows (13 Call 1, one Call 2+); Today has two tracked calls and zero no-shows. These are cutoff-specific figures. Both daily totals and the exact no-show evidence IDs agree with the independently saved full-history snapshot. Per-rep evidence counts, popup totals and the bottom log reconcile.
- Bounded source sizes: Yesterday read 603 rows including the preceding comparison day; Today read 276 rows including yesterday. Saved daily payloads were approximately 16 KB and 0.5 KB. First Yesterday hosted initialization plus load took about 10 seconds; Today navigation about three seconds. Do not promise universal instant first loads.
- Live rep popup keyboard open/close, Today/Yesterday bottom filters, switch-back without wrong-day reuse, all-history evidence (1,641 entries at cutoff), and all four rolling ranges verified. No fake zero substitutes for failed reads.
- Wider authenticated UI checks: homepage and all three tool links, admin directory, Rep Usage, Sales Impact, Objection Library, FAQ Usage/Conversations/chat entry, Compliance Review, Closer Scorecard, Coaching selector, latest official report, latest completed self-submitted report and submission form passed. No artificial submission, AI question or production workflow trigger was used.
- Compliance and scorecard saved reads refreshed successfully during the check with no failed markers. Sales source sync is current; source Sheets remained read-only for this work. Production error-log scan returned no errors in the checked window.
- n8n intake, official/manual, weekly compliance and internal provider remain active. Old replaced official/manual/weekly workflows remain inactive. Official/manual/weekly graphs validate with zero errors or invalid connections. Sampled latest runs succeed; 84 new official reports exist in the preceding 24 hours. Official delivery includes dashboard, document, stored score and Slack receipts; latest completed manual submission has saved delivery receipt. Weekly summary source reads and summary writes succeeded in the scheduled production run (read-only inspected, not triggered by this task).
- Two older execution errors were investigated: one Zoom token-request timeout was followed by later successful scheduled intake; an AI writer JSON failure completed on retry, passed its audits and produced report8050. Both provider failure counters are zero. The manual submission requiring a transcript paste is an explicit input-needed status, not a missing completed report.
- Recent FAQ activity has matching request/response counts; evidence routing is distinguished from provider failure. No current additional system defect was established. Deferred compliance policy, RPC/call-coverage topics, taxonomy and coaching-review specialist work remain unchanged.
- New paid AI test/recovery cost: zero. No source data edits, workflow/model/permission changes, or large local backup copies.
