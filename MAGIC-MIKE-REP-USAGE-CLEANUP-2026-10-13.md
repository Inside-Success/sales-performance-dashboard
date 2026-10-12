# Rep usage simplification — October 13, 2026

## Scope and authority
Moonis approved Tyler's October 13 PKT usage-page feedback and the proposed readable individual-rep report panel. Source: https://istvoffical.slack.com/archives/C0B402VSESY/p1791835244784639 (screenshots), plus messages 1791834781.275559 and 1791834849.674669. No Slack sends are authorized.

## Changes
- Main `/manager/usage` view shows Reports opened, Open rate, and Reps opening feedback.
- Removes engagement/10-second displays, 48-hour unopened displays and comparison panel, and redundant explanatory text from the main view. Actual distinct owner opens supply the opened count; engagement is not relabeled as opens.
- Table columns: Rep, Reports received, Reports opened, Open rate, Last opened, View reports. Meaningful headings toggle ascending/descending, with direction icons and aria-sort. Unknown rates/dates remain last in either direction. Default: lowest exact open rate first, deterministic name ties.
- Search plus All reps / Opened feedback / Has unopened reports filters work with sorting. The overdue-dependent Never/Inactive shortcuts are removed from this simplified UI.
- View reports opens an accessible Base UI modal with the selected rep, period, three matching totals, newest-first report links and explicit Opened/Not opened states. All/Opened/Not opened filtering applies to that rep's selected-period reports. Close button, Escape and focus restoration use the existing Base UI library.
- Team summary cards remain team-wide. Each selected rep has its own panel totals; search is not an identity/mapping repair.

## Preserved boundaries
Usage SQL, authenticated identity mapping, event tracking, historical events, access configuration, source reports, coaching/scoring/FAQ, n8n, Slack and Google content are unchanged. Existing technical diagnostics remain opt-in through `details=1`, using their historical definitions. No AI calls or testing charges. Existing 30-day manager roster rule is preserved; this is distinct from the coaching selector's 60-day rule.

## Verification
- 16 usage unit tests passed, including report-panel count/status reconciliation, period boundaries, duplicates, immutable numeric/rate/date sorting and missing values.
- Scoped ESLint and TypeScript passed.
- Production webpack build passed. Code PR #284 merged as `b3ad9094bcd9dcbabb9563e3fb2bf831a0f6a8f1`.
- Production deployment `dpl_GdwAkNRsXpyLxQBTHA3mqGUZaNki` READY; explicitly promoted and rose alias verified on this deployment. Previous rose rollback target: `dpl_45kRyQZQ8tZNL2WR8v4n64pijnPj`.
- Authenticated live page: removed metrics absent; all five headings toggle correctly in both directions; search and opened-feedback filter work; selected Irene row/panel agrees (32 received, 8 opened, 25%). Panel lists 8 opened / 24 not opened; Escape restores trigger focus.
- Independent SELECT-only database reconciliation: 7-day 28/398 opened; all-time 630/5646; Irene 8/32. 30-day 152 opened and 24/132 reps agree; report denominator moved 1687 to 1688 as a natural report arrived between observations.
- Actual report links, period controls, empty/no-report cases are covered by live inspection and unit tests.
- After release, authenticated Coaching, report 7736, FAQ, FAQ admin usage, scorecard, Sales Impact and Compliance pages loaded without page errors. Production error logs since release showed no error entries.
- Responsive CSS/table scroll and panel bounds reviewed. The browser viewport override did not apply (actual viewport remained 1425px), so a real phone-width browser check is NOT claimed. Override reset.
- Vercel preview failed before build with existing `Resource provisioning failed`; local production build and Git-backed production build succeeded. No environment settings changed.
- Small local screenshot (49 KB) retained for visual verification; no repository/transcript/dependency backup copies created.

## Rollback
Previous source: main commit `9f7c359ce9bf784d853943dc2de0db6a9f521c54`. Revert this scoped change or restore these four files from that commit, retaining unrelated FAQ changes. No database rollback or workflow changes required. Use the prior verified rose deployment captured during release if runtime rollback is needed.
