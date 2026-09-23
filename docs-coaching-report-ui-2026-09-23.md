# Coaching report reading layout — September 23, 2026

## Scope

This release changes the dashboard presentation of official coaching reports. The score is prominent at the top when an eligible saved score exists. The report then leads with Call outcome followed by What to improve. Meeting details and the existing document, recording, transcript, and Ask Magic Mike controls move to a left sidebar on wide screens and below the report on narrow screens. The newer coaching sections use clearer bullets and distinct quote styling. Evidence times display as `6:49` rather than `00:06:49.580`.

Evidence time links open the existing Zoom recording. Zoom share links do not support a reliable playback-position parameter, so the UI explicitly tells the reader to seek to the shown time. When no recording link exists, evidence times remain text. The original source timestamps and report fields are untouched.

This is a display-only release. It does not change stored reports, score calculation or eligibility, generation prompts, n8n workflows, API contracts, access rules, feedback submission, usage event names, or report chat. Historical reports retain their original body layout; the shared top layout and sidebar still apply.

## Rollback point

The GitHub tag [`backup/coaching-report-ui-before-2026-09-23`](https://github.com/Inside-Success/sales-performance-dashboard/tree/backup/coaching-report-ui-before-2026-09-23) points to production commit `18b99e5602bb48671915934a276b49a144670acf` before this redesign. To roll back only this change after release, revert its merge commit on current `main`, build and deploy through GitHub/Vercel, then check an authenticated report. Do not reset `main` to the tag if unrelated commits landed afterward. The tag is also a source comparison point for individual files.

## Verification boundary

Check the official report on desktop and phone, including score and score-absent reports, section order, timestamp evidence, source links, chat, feedback controls, and return navigation. Check a manual report because it shares the enhanced-section component. A successful build alone is not visual or live behavior proof.

## Release receipt

- PR [#227](https://github.com/Inside-Success/sales-performance-dashboard/pull/227) merged as `4a6769dfe63335822ce9ab8e5d78eb0dfa99d027`; visual polish PR [#228](https://github.com/Inside-Success/sales-performance-dashboard/pull/228) merged as `687c58be14009fb708d4e930ab44e75ede89f477`.
- Final production deployment `dpl_86nb5vynH1wimTr4fUdjpdykD6Yf` was READY and aliased to `sales-performance-dashboard-rose.vercel.app`.
- Focused coaching presentation suite: 14 passed. Scoped ESLint and `next build --webpack` passed after the final visual refinements.
- In a signed-in Chrome session, `/call/6540` displayed the saved 70.8 score, Call outcome before What to improve, and the preserved source links. Desktop and 390px phone screenshots showed the intended sidebar/stacked layout. The phone Call details jump worked. Expanded evidence displayed short `42:16`-style links to the existing Zoom URL with a manual-seek explanation. Ask Magic Mike opened without sending a message; the needs-changes form opened without submitting feedback.
- Browser automation was subsequently interrupted by another Chrome extension UI, so a second score-absent report and a manual report were not independently opened in this release check. Their compile and shared-component contract checks passed; do not treat that as a live visual check of those two variants.
