# Coaching report reading layout — September 23, 2026

## Scope

This release changes the dashboard presentation of official coaching reports. The score is prominent at the top when an eligible saved score exists. The report then leads with Call outcome followed by What to improve. Meeting details and the existing document, recording, transcript, and Ask Magic Mike controls move to a left sidebar on wide screens and below the report on narrow screens. The newer coaching sections use clearer bullets and distinct quote styling. Evidence times display as `6:49` rather than `00:06:49.580`.

Evidence time links open the existing Zoom recording. Zoom share links do not support a reliable playback-position parameter, so the UI explicitly tells the reader to seek to the shown time. When no recording link exists, evidence times remain text. The original source timestamps and report fields are untouched.

This is a display-only release. It does not change stored reports, score calculation or eligibility, generation prompts, n8n workflows, API contracts, access rules, feedback submission, usage event names, or report chat. Historical reports retain their original body layout; the shared top layout and sidebar still apply.

## Rollback point

The GitHub tag [`backup/coaching-report-ui-before-2026-09-23`](https://github.com/Inside-Success/sales-performance-dashboard/tree/backup/coaching-report-ui-before-2026-09-23) points to production commit `18b99e5602bb48671915934a276b49a144670acf` before this redesign. To roll back only this change after release, revert its merge commit on current `main`, build and deploy through GitHub/Vercel, then check an authenticated report. Do not reset `main` to the tag if unrelated commits landed afterward. The tag is also a source comparison point for individual files.

## Verification boundary

Check the official report on desktop and phone, including score and score-absent reports, section order, timestamp evidence, source links, chat, feedback controls, and return navigation. Check a manual report because it shares the enhanced-section component. A successful build alone is not visual or live behavior proof.
