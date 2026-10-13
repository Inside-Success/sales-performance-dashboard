# Sales Impact: report opens and manager presentation

## Scope and boundaries

Authorized October 14, 2026. Improve `/manager/sales-correlation?days=7|14|30|90` using the existing payment snapshot and official report-open events. Keep the scatterplot, simple rep drill-down, before/after and subsequent-sales comparisons. No RPC on the main page, no engagement threshold on this page.

The company sales Sheet is strictly read-only. Its existing authenticated n8n read sync, snapshot ingest, coaching, scoring, compliance, report generation and source data are unchanged. No new AI stage or model change. Sales analytics chat uses the same new read model and now requires the existing signed-in session, matching report-chat's authentication pattern. No allowlist or authentication configuration is changed.

## Definitions

- Periods are 7/14/30/90 **complete America/New_York calendar days**, ending yesterday. Today's partial cash and opens are excluded.
- Roster: reps with official call activity in the past 30 days and an official report available before today. This is activity eligibility, not an employment roster.
- Opens: distinct `(rep, own official report)` pairs opened during the period. Repeat opens count once. Mapped owner, official source, report existence, availability timestamp and non-future event checks are mandatory. Self-submitted, peer, anonymous and ten-second engagement events are excluded.
- Sales: existing `New + Paid` positive finite amounts, by recorded payment date. Cash entries are not contracted value, closed-deal counts or revenue attributable to an individual call.
- Identity: exact normalized name matching with the existing Ollie alias. Rep report links preserve the actual saved slug. A rep with no matching sales identity/history is **not matched**, not $0; excluded from group comparisons and scatterplot, retained in the searchable table. A matched rep with no qualifying payment in the period is a genuine $0.
- Groups: top third of matched reps with opens, ranked by distinct report count, then days used, then stable name key. Remaining users are Some usage; matched zero-open reps are No recorded opens. Sales values never determine group membership.
- First recorded use: equal selected-length windows immediately before and after a rep's first recorded own open, excluding the opening day. Only completed follow-up and available sales-history periods qualify. Average and median paired differences, count and waiting count are shown. This is an observational comparison; first recorded use need not be the person's first ever use.
- Subsequent sales: fixed preceding 84 complete days in four non-overlapping 21-day blocks. First 7 days are usage exposure, next 14 are sales outcomes. Only blocks after recorded usage/source coverage with an already-available report qualify. Include only reps with both used and unused blocks. Each rep contributes one equally weighted pair of their mean outcomes. This contextual check is deliberately independent of the selected top chart period, explained in methodology.
- Methodology includes unmatched counts, coverage, refresh time, group medians, all-users average and high-group average without its largest revenue-total rep. These checks remain visible regardless of direction. No-open means no recorded own open, not proven non-use.

## Presentation

Same-rep before/after evidence leads the page when complete pairs exist. Same-period high/no-open group values remain directly beneath it. Prominent scatterplot, familiar red/amber/gray legend, fixed axes across group toggles, click or table alternative for overlapping points. Zero-cash matched reps remain plotted. Rep summary shows opens, cash, eight complete seven-day sales periods, comparison status and original coaching-report link. Searchable, sortable table includes unmatched identities; initially ten rows, with Show all. Detailed methods remain expandable below the main analysis. Chat uses current facts, not legacy engagement math, and states association rather than causal lift.

## Verification before release

- 49 targeted tests across the new pure analysis, data reader, chat failure/auth boundaries and existing usage, source sync and sales-sheet health suites.
- Independent production SELECT audit: all four periods' distinct owner opens reconcile with PostgreSQL; every matched rep's selected-period revenue reconciles with a separate JSONB SQL aggregate of the latest source snapshot.
- October 13 20:42 UTC evidence: 7,750 stored reports, 1,245 eligible owner-open events, 4,008 source rows; snapshot refreshed at 20:00 UTC. No source or report changes during audit.
- 30-day data: 77 matched, 54 unmatched active reps; 192 distinct own opens. 27 complete first-open pairs averaged $10,175.93 before and $18,037 after (+$7,861.07; median change +$7,500). Same-period high users averaged $8,071.43 vs no-open $10,115.52. Fixed subsequent-sales paired check across 23 reps was -$1,192.03. Evidence is mixed and does not prove causation.
- 90-day same-period high/no-open difference was +$17,908.69 across 11 high and 45 no-open reps. First-open paired difference +$7,388.83 across 18 reps. Values are snapshots and change with new activity/payments.

## Rollback

Baseline Git SHA `7faa669f769ad2dd177d3eeb9d002db4d734d1a0`; production deployment `dpl_3oQ8ZBhzmg83FpBUMFXsCNkJp2Z3`, `sales-performance-dashboard-4cem8d959-admin-insidesuccess.vercel.app`. Use a scoped Git revert of this release or promote that known deployment. No database migration, environment change, workflow update, full laptop backup or source-sheet edit is necessary.

## Deferred

After this improvement, revisit complete attended-call coverage and separating genuine closing Call 2s from the broad Call 2+ classification. These are necessary before credible RPC; RPC stays off the page. Compliance policy work and unrelated monitoring/intake tasks retain their existing deferred status.

## Release evidence

- Core PR286 merged `2077a7759274100055dbcb6cd1cdcce0e23c1bf9`. Git-sourced staged production build `dpl_72ypNsYwusP89Ly7zGcrZ24Subgz` READY, then promoted to the rose alias. Automatic PR preview failed during resource provisioning before app build; no infrastructure settings were changed.
- Mobile follow-up PR287 merged `210056794a1bd6baa86f34181b298720ff578d1a`. Production `dpl_AXuZBPpKs3nk9uNpaxspDkWqJtZv` READY. Actual 375px viewport checked: document width 360px, no page overflow; table remains separately scrollable. Filters wrap evenly and secondary copy has stronger contrast.
- Authenticated live checks: all four period links update figures; stable chart axes across group filtering; Annalia dot and table search agree (22 opens, $23,000, incomplete follow-up clearly marked); Rossini displays 7 opens with **Not matched**, never zero; both name-sort directions, report-count sorting, Show all131, and chat drawer verified.
- Existing coaching home, report7614, self-submitted picker, rep usage, FAQ admin usage and scorecard rendered successfully. This is scoped regression verification, not a claim to have re-run every production workflow or proved future availability.
- Rep Usage retains its own report-availability denominator and includes its existing rolling-date behavior; Sales Impact counts events within complete days, including opens of older available reports. Different totals between these pages are expected, not a label-only rename.
- Live sales chat initially returned an empty answer. Final follow-up explicitly requests DeepSeek non-thinking mode for the already-calculated facts, preserves the same model and output budget, and compacts the snapshot into named columns with identical rep and trend values. The first corrected live answer was non-empty but used the wrong comparator in one line. Final hardening generates the four preset numerical answers directly from verified page data, with no provider call; free-form context explicitly names the no-open baseline and distinguishes subsequent sales from before/after first use. Preset and free-form post-hardening replies remain to verify. The external provider request used by local diagnostic could not access the sensitive Vercel key; no credentials were copied or changed.
- Rollback still restores only this release; source Sheet/sync and production workflow state remain unchanged.
