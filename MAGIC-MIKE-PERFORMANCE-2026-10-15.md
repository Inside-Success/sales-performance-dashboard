# Magic Mike dashboard performance and reliable reads — October 15, 2026

## Scope and boundaries

Owner approved the read-only audit's plan: shared validated source reads, last-good fallback, faster filters, lean coaching library reads and nonblocking numeric-score display. No AI models/prompts, report generation, classification/scoring rules, usage definitions or source Sheet/Airtable data are changed. The source systems are read-only. Only dashboard-owned Postgres gets an additive `dashboard_read_snapshots` table. Git history is the backup; do not copy the checkout.

## Architecture

- One attendance snapshot is shared by 7/14/30/90-day calculations. The existing deduplication, tracking cutoff, weekly trend and historical access remain intact.
- Compliance stores all three validated tabs as one complete successful read. An incomplete/failed read cannot replace the preceding data. Existing reconciliation and category logic is preserved.
- Scorecard overview stores the complete overview for its exact scoring version/base. Individual scores continue to use exact-match checks. Overview pagination is complete instead of silently clipping at 5,000 rows.
- Snapshots have source/config/version keys, true success timestamps and distributed lease ownership. A slow/failed worker cannot overwrite a newer read; failed refreshes preserve payload/time and briefly back off.
- `/api/admin/read-cache/refresh` runs every five minutes through Vercel Cron. Compliance/scorecard are due every five minutes; attendance every fifteen. The endpoint requires the production server-only `CRON_SECRET`; normal browser/admin cookies alone cannot trigger it. Source readers have bounded time budgets. Preview does not run crons.
- Initial population is performed with the protected endpoint's `bootstrap=1` while `MAGIC_MIKE_READ_SNAPSHOTS_ENABLED=false`. Only after all three successful reads are verified is the flag enabled in a fresh Git deployment. Visitors retain legacy reads during preparation.
- Stale or failed refreshes show their actual last-success time and a warning. With no successful data, statistics are hidden and the page reports unavailable, never fabricated zero activity. No-show chat refuses an unavailable-data request before any provider call.
- No-show history is fetched on demand through an authenticated exact-email-admin GET route. Initial page payload contains only the selected period's evidence, while all-history counts/access remain available. Client requests cancel safely on filter changes.
- Coaching home skips unused full-call/latest-by-rep reads until a rep is chosen and uses compact card columns for that library only. Full report and other call readers retain their normal columns and access.
- Coaching reports stream existing feedback first; their optional numeric score is inside an independent Suspense boundary. Missing/invalid/excluded scores remain absent; no fallback score is invented.

## Verification and staged release

Record test/build, deployment, bootstrap results and authenticated UI timings here after they are observed. Initial audit measurements are individual samples, not percentile guarantees: compliance reload ~3.5s, cached no-show filter ~2.1s, coaching ~1.5s, existing report ~1.9s, scorecard ~3.6s. Seven-day no-show timeout was reproduced and had been cached as a successful empty result.

Acceptance covers all date ranges, stale fallback and refresh overlap, historical evidence, exact-email access, unchanged score matching, regular report/coaching/FAQ availability and source-read-only behavior. No paid AI evaluation is needed for this backend/UI change.

## Rollback

Set `MAGIC_MIKE_READ_SNAPSHOTS_ENABLED=false` and release a fresh deployment to return to legacy source reads while disabling scheduled refreshes. Preserve the snapshot table as an unused rollback artifact; do not drop source or dashboard data. Revert the scoped Git implementation if report/library presentation needs rollback. The new cron secret is server-only and must never be printed, committed or copied into browser URLs.

## Observed release evidence

- 99 targeted tests across 19 suites passed. Scoped ESLint, TypeScript and webpack production build passed. A final seven-test subset also passed after readable freshness timestamps and explicit cron/page scoring-version alignment.
- PR298 merged as `222396f3d03ec24f5ff334dfd384315a87ac1af8`; staged production `dpl_4rjJe8YsQoozGbJ3gTKLzNrFYdXp` is READY. Snapshot reads were disabled for population.
- Preview `dpl_AjzfThckfqujukfEtn36osyxNyQB` hit the existing pre-build “Resource provisioning failed” error. It was not counted as passing; the production build succeeded.
- Protected bootstrap completed in 118.42 seconds with HTTP200: compliance, scorecard and attendance all `refreshed`. Visitors did not wait on this background population. All writes are confined to the additive dashboard-owned snapshot table.
- Existing report `/call/7846` still rendered its feedback and matching 60.3 score during the staged release. A cold sampled report load was 5.5 seconds, so do not claim every route is universally sub-second. The score no longer blocks feedback structurally; end-user latency also includes database/session/network startup.
- Production flag has been set to true for the next Git deployment. Fresh authenticated UI and date-filter timings must be recorded after activation. No AI calls were used for this verification.

## Final efficiency safeguards

- Successful database reads use a shared 30-second cache across period filters. Payloads are losslessly compressed server-side and guarded below the framework cache-size limit; oversized datasets fall back to the successful database read instead of becoming an error. Only successful complete reads are cached.
- Scheduled refreshes run for datasets requested within the preceding 30 minutes, avoiding expensive full-history polling of unused dashboards. A stale first visit after inactivity shows its true source timestamp immediately and schedules a leased refresh after the response; cron remains the retry path. Active-dashboard refresh cadence is five minutes for compliance/scorecard and fifteen for attendance, with scheduling/source-read time and the brief shared cache potentially adding delay. These are refresh targets, not strict maximum data-age guarantees.
- Added one dashboard-owned `last_requested_at` column for refresh demand tracking; this is separate from rep usage/adoption events and never changes those metrics.
- Initial activated samples: no-show cold load 6.1s, compliance 2.7s, scorecard 0.7s. This prompted the bounded shared read cache; do not publish those as final acceptance timings.
- Fixed the period caption to compare the actual tracking cutoff, rather than the saved source refresh time. Counts/calculation rules are unchanged.

- Long no-show evidence lists render the first 100 matches with a clear Show 100 more control. Search and call-type matching still cover the entire loaded dataset; no history is discarded. This avoids mounting thousands of rows during date transitions.

## Compact attendance read

Protected live inspection found 32,155 records / 33,551,433 JSON bytes in the initial raw attendance snapshot. Compact v2 moves the unchanged four date-window calculations into refresh, saves one full no-show evidence history plus per-period results, and removes raw present-call records from visitor reads. Counts are fixed to the successful read's cutoff, appropriate to the stated source freshness. The previous v1 read remains available while v2 is populated, preventing a blank transition; it is retained as a dashboard-owned rollback artifact. All historical no-show evidence remains accessible.
