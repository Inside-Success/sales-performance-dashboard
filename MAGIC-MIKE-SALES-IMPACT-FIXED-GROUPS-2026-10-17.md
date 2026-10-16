# Sales Impact fixed groups — October 17, 2026

## Authorized scope

Owner approved the October 16 meeting/Slack follow-up: fixed usage buckets, simple sales comparison bars, preserve scatterplot, and account accurately for five opens out of ten versus fifty opportunities. Implementation is restricted to Sales Impact UI, its shared pure analysis and chat facts. No source spreadsheet writes, workflow/provider changes, report regeneration, permission changes, or RPC addition.

## Definitions

- Distinct mapped owner opens of official reports within complete Miami days ending yesterday. Repeated, peer, manual, anonymous, pre-availability and future opens excluded by the existing read path. Older reports opened in the window still count toward usage.
- Fixed, mutually exclusive groups: **0; 1–5; 6–20; 21+**. Exactly 20 belongs to 6–20. No relative top-third ranking remains on this page or its chat.
- Bars show mean New + Paid recorded cash per matched rep, not total group revenue. Every bar states matched sample size; matched genuine zeros remain included. Empty groups have null values and say no reps, rather than $0.
- Rep detail **report coverage**: distinct reports made available in the selected window AND opened by their owner in that window, divided by all official reports made available to that rep in the same window. 5/10 = 50%; 5/50 = 10%. Old-report opens are excluded from the numerator. With zero received, percentage is unavailable. This measures report coverage, not all Call 2 attendance or every sales call. It does not prove learning. End-of-window cutoff applies even when viewing historical windows.
- Database bigint identifiers are normalized to numbers before cohort intersections and open deduplication; production reconciliation caught the string/number mismatch before release.
- Page, scatter legend/filters, rep details, deterministic chat presets and freeform chat context use the same definitions. Four compact bars; no additional main-page percentage controls or competing chart axes.
- Existing active-rep roster, exact normalized sales matching, full-day periods, default 30 days, paired first-use comparison and non-overlapping subsequent-sales comparison are preserved.

## Verification before release

- 57 tests pass in seven suites: analysis, chat facts/route, data reads, source sync/health, admin access. New cases cover boundaries 0/1/5/6/20/21/100, unmatched and zero-sales reps, empty groups, 5/10 versus 5/50, duplicate/older/today/peer opens and string bigint IDs.
- ESLint and TypeScript pass; production build passes. Final post-normalization checks and live receipt recorded below.
- `scripts/verify-sales-impact-readonly.cjs` independently reconciles source sets, cohort intersections, all rep revenues, group counts and means. It executes SELECTs only and prints no credentials or rep names. Run through `vercel env run -e production --scope <linked-team> -- node scripts/verify-sales-impact-readonly.cjs`.
- At 2026-10-16 20:21 UTC: 8,056 official report rows, 1,287 qualified owner-open events, 4,051 sales rows; source snapshot 20:00 UTC. All 134 eligible rep coverage checks pass for each 7/14/30/90-day period. 79 matched and 55 unmatched identities.
- Independent reconciliation confirms each group count and average against source sets. Before/after and subsequent-sales values agree with the pre-change audit for all four windows. Exact production revenue remains in the authenticated page, not this public repository.
- The 30-day 21+ group has only two matched reps; the same-period pattern is not monotonic. Do not present the observation as proven sales lift.

## Rollback and boundaries

Baseline production: commit e7ab38b05131916d1b2b8a0d1bd30646db2a81fc; deployment dpl_6noZv1BFnXjVzgLgCdwWtJmwhR1e. Revert the scoped release commit through Git and deploy, preserving concurrent specialist changes; no database rollback or Sheet restoration required. Existing checkout reused without a large backup. No paid model benchmark or new AI node needed.

## Live release receipt

- PR [315](https://github.com/Inside-Success/sales-performance-dashboard/pull/315) merged as 99471ac23fd142a822da65e057ed66b445ed2821 (implementation e05c3742e416581e85c37b4a52f63298e79e54dc).
- Production deployment dpl_7hj6V1rRNKLgarVRzihGpX5BESfY is READY / PROMOTED and assigned to the rose production URL. Production build succeeded. The branch preview failed before build with the existing infrastructure error “Resource provisioning failed”; this was not treated as successful preview verification.
- Authenticated company Chrome: all four period filters match independently reconciled source values. Seven/fourteen-day empty 21+ groups say no reps, not zero revenue. Thirty-day default, scatterplot filter (two matched 21+ reps), dot selection, search-to-rep navigation, owner coverage and complete-period recalculation verified.
- Verified real examples where total opened includes older reports: report coverage numerator stays restricted to reports received in the selected window, rather than exceeding 100%.
- Deterministic live chat preset returns all four groups with means/counts matching the page. No paid AI test needed. Provider/model settings were not modified.
- Mobile layout tested at requested QA viewport 390×844 (rendered client width 375): no page overflow; new bar labels and values remain readable. Override reset afterward. Desktop visually inspected; browser errors empty.
- Admin directory, Rep Usage, Coaching rep selector and FAQ entry page smoke checks passed. No new report generation or workflow executions were triggered by this scoped verification.
- Production error-log scan for the preceding 15 minutes returned no errors. This is scoped post-release verification, not a claim that every future pipeline execution is guaranteed.
- Source Google Sheet remained read-only. No database migrations, bulk backups or model evaluation charges. Git and the prior deployment remain available for rollback.
