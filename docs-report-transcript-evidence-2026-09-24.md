# Coaching transcript evidence — September 24, 2026

## Behavior

In the newer official and completed self-submitted coaching reports, selecting a cited evidence time opens the full transcript in a side panel and highlights the line with that same timestamp second. When the export has no exact timestamp, the panel labels a closest line within ten seconds as nearby. If there is no close match, it says so and leaves the transcript browsable. The timestamp is never represented as an exact match when it is not one.

The source Google Doc/transcript and Zoom recording remain separate links in the report details. The panel also links to the full source transcript where available. Historical report bodies keep their existing layout. Report content, scoring, chat, feedback, source documents, and n8n workflows are not changed.

The panel fetches transcript text only when opened. `/api/report-transcript` requires an authenticated session, accepts an existing official or completed manual report ID, reuses the transcript loading path already used by report chat, and returns `private, no-store` text. It does not write transcript text to the database or send it to a model. If the source transcript cannot be loaded, the panel reports that error and retains the source link.

## Rollback

The GitHub tag [`backup/report-transcript-before-2026-09-24`](https://github.com/Inside-Success/sales-performance-dashboard/tree/backup/report-transcript-before-2026-09-24) points to prior production `main` commit `5778fe48cd64f0d79e04c90d3774f52885da6735`. If reverting this release, revert its merge commit on current `main` and redeploy through GitHub/Vercel. Preserve later unrelated commits.

## Verification

Before release: run the scoped transcript matching and API route tests, the coaching presentation tests, ESLint, and a production build. After release: check several authenticated reports with different evidence times, the match label and highlighted text, source links, and unchanged report controls. Record any source transcript whose timestamp format prevents an exact match. Successful compilation is not proof that a particular external transcript can be loaded.
