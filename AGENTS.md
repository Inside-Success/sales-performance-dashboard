<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Deployment Rule

Do not start or run a local dev server for this dashboard project unless the user explicitly overrides this rule.

For dashboard/web changes:

1. Make scoped code changes.
2. Run non-server checks such as lint/build when appropriate.
3. Push changes to GitHub.
4. Let Vercel deploy from GitHub and verify the deployment there.

## Current Production Notes

- Dashboard brand is Magic Mike Bot.
- Magic Mike is live on the new multi-stage production workflow `L8Nn7xncA9ZPDdWA`.
- Forward-only scoring V2 is authorized for numeric-only display on matching coaching reports. The coaching writer itself still does not generate the numeric grade. Missing, excluded, invalid or historical scores remain blank; never invent a fallback. Manager reasoning remains restricted. See MAGIC-MIKE-SCORING-FORWARD-2026-09-10.md.
- Official crash recovery now detects both error and crashed executions, reuses exact-match unreviewed drafts through the existing factual audit, and holds terminal stale worker claims before retry. See MAGIC-MIKE-CRASH-RECOVERY-2026-10-09.md; preserve source/report deduplication and do not bypass review.
- Recovery execution-history 404s are explicit review holds, not proof of failure or replay permission. Rotate bounded stale inspections and preserve owner-specific receipt closure; see MAGIC-MIKE-RECOVERY-LOOKUP-2026-10-29.md. Verify the actual child, current source owner and artifacts before recovering a held call.
- Prospect identity is resolved in intake and official coaching from transcript/title evidence, including corroborated nicknames and compound titles with known reps. Assistant/meeting labels are fallbacks, never canonical person evidence. Preserve raw speaker aliases, exact matched manual names, item pairing and duplicate controls. Retain an external device/display label when identity evidence is insufficient. See MAGIC-MIKE-PROSPECT-IDENTITY-2026-10-09.md for versions, tests and scoped rollback.
- Final names must survive unchanged-name handoffs and empty Airtable fields. Recent report outcomes are parsed by semantic labels before duplicate comparison; preserve very old layouts and structured reviewed sections. See MAGIC-MIKE-NAME-OUTCOME-CONTRACT-2026-10-12.md for this scoped repair and rollback.
- Compliance categories and risk values feed manager dashboards, weekly summaries, and Google Sheet views. Be careful with schema or label changes.
- Hidden manager pages are `/manager/usage` and `/manager/sales-correlation?days=7|14|30|90`.
- Additional hidden manager pages include `/manager/compliance` and `/manager/rep-no-show`.
- The admin-only rep performance reviewer is `/manager/rep-scoring`. It reads the isolated Airtable scoring base, is exact-email allowlisted, and must never write to source calls, Slack, or Google content.
- Sales Impact now counts distinct mapped own official report opens, uses complete Miami-date periods, keeps unmatched sales identities separate from zero, and presents paired before/after and non-overlapping subsequent-sales checks. See MAGIC-MIKE-SALES-IMPACT-2026-10-14.md. Its chat must use the same read model and an authenticated session. Do not reintroduce the ten-second engagement threshold on this page.
- `/manager/sales-correlation` reads the company sales Google Sheet through an isolated authenticated, read-only n8n sync. Validated reads are saved in dashboard-owned Postgres snapshots; the page shows refresh freshness and warns after two hours without a successful refresh. Legacy CSV remains a fallback before the first authenticated sync. It must never write to the company sales spreadsheet.
- Official coaching usage, manual self-submitted feedback usage, and compliance feedback must stay separate.
- Report chat uses `gpt-6-luna` through server-only `OPENAI_API_KEY` and requires a signed-in session. Sales-impact and rep-no-show chats still use `deepseek-v4-pro` through `DEEPSEEK_API_KEY`; do not commit keys.
- Report chat is coaching-only and must not answer compliance/legal/red-flag questions.
- Do not run local dev servers for this project unless the user explicitly overrides that rule.

## Admin directory and leadership access (October 14)

- `/admin` is the authorized admin directory, linked from the homepage only for eligible admins. All `/manager/*` views require the shared exact-email manager policy; data pages and chat endpoints also check access before reading data or calling a provider.
- `src/lib/approved-admin-emails.ts` contains the owner-approved leadership roster plus Dagim. Preserve configured manager and FAQ admins additively. FAQ-only legacy admins retain their existing FAQ permissions; they are not promoted to manager access.
- Rudy and Mike have exact-email sign-in exceptions. Never authorize the Gmail domain broadly. Source Sheets, coaching workflows and external Mock Call Agent permissions remain unchanged.
- See MAGIC-MIKE-ADMIN-DIRECTORY-2026-10-14.md for scope, verification and rollback.

- Admin UI follow-up: see MAGIC-MIKE-ADMIN-UI-POLISH-2026-10-14.md. Never use a full-page minimum-height class on the compact directory return nav. The directory is named Admin Insights; its link order and page URLs are deliberately separate.

## Dashboard performance reads (October 15)

- See MAGIC-MIKE-PERFORMANCE-2026-10-15.md. Source Sheets/Airtable remain read-only. Successful snapshots and timestamps must survive failed refreshes; never cache empty failure results or show them as genuine zeros. Preserve auth before all admin reads. Attendance history and score matching remain complete and exact.

- Daily rep no-show UI: see MAGIC-MIKE-NO-SHOW-DRILLDOWN-2026-10-15.md. Today/Yesterday use Miami calendar boundaries; selected rep popup counts must reconcile with evidence from the same read. Preserve prior rolling windows and authenticated full-history access.

## Durable coaching recovery (October 15)

- See MAGIC-MIKE-DURABLE-RECOVERY-2026-10-15.md. Official/manual coaching provider paths now use native internal workflow X9L4JtDbpkSCflxZ with exact-request Postgres checkpoints, owner leases and outage cooldown. Keep the normal factual/safety audit and source/report duplicate guards. Do not reintroduce same-instance public-webhook calls or nested provider HTTP retries.
- Completion is confirmed from matching source receipts and actual report artifacts, not execution status alone. Transient failures stay queued with due-time backoff; uncertain writes/refusals/auth failures stay held for review. Preserve the source claim attempt check and accurate zero-new-cost accounting for reused results. Source Sheets, scoring and deferred compliance-policy work remain separate.

- Sales Impact October 17: fixed 0/1–5/6–20/21+ distinct-open groups replace the old top-third rule. Bar means/counts and chat use the same read model. Rep report-coverage percentages use only same-window received/opened reports, never all opens divided by new reports. See MAGIC-MIKE-SALES-IMPACT-FIXED-GROUPS-2026-10-17.md.

- October 17 daily attendance repair: Today/Yesterday use bounded date-specific daily snapshots with separate live/completed-day keys, independent of the full-history refresh. Bottom daily evidence uses the same service. Preserve source read-only boundaries and last-successful data; see MAGIC-MIKE-DAILY-ATTENDANCE-RELIABILITY-2026-10-17.md.

- Coaching reliability contract October 18: see MAGIC-MIKE-RELIABILITY-CONTRACT-2026-10-18.md. Shared strength-alias normalization must preserve exact text/evidence; validate cached results as well as new results. Source diagnostics must respect active checkpoint leases and uncertain-write holds. Independent coverage scans must acknowledge their durable page only after accounting/notification, and must never write to source Sheets or automatically replay unknown business deliveries.

- October 18 acceptance: transport-valid malformed coaching drafts must reach the existing bounded targeted repair while their provider checkpoint remains failed/non-reusable. Do not mark them completed or stop the transport path before repair. The first independent source sweep flagged seventeen older unaccounted candidates. Approved October19 investigation/recovery subsequently closed them as thirteen verified reports8191–8203 and four justified exclusions; see the October19 source-accounting release and manifest. Preserve the fifteen-minute checker cadence and do not replay resolved sources.

- October 19 source accounting: see MAGIC-MIKE-SOURCE-ACCOUNTING-2026-10-19.md. Preserve original classifier reasons and guard revisions; whitespace/role labels must not falsely establish absence. Early transcript failures use loop-paired source IDs and the existing bounded recovery. The coverage cursor discovers by readiness and retains unresolved calls beyond its rolling window; source data remains read-only.

- October 19 accounting containment supersedes the early-outcome handoff from that release: see MAGIC-MIKE-ACCOUNTING-CONTAINMENT-2026-10-19.md. The actual Set emits `call_1_skipped`; normalize it at the receipt boundary. Preserve current-item classifier provenance and a single receipt writer. Accounting errors route to recovery events/operations notification and cannot restart the loop or stop sibling deliveries. Delivery-only recovery reuses reviewed output and must not resend Slack or rerun AI.

- October 21 handoff/freshness: see MAGIC-MIKE-HANDOFF-FRESHNESS-2026-10-21.md. Normal/recovery runs share recording-identity claims; never steal an active owner by elapsed time. Coverage may reserve only verified never-started calls, one per sweep. Keep uncertain deliveries held. Dashboard snapshots use one DB read layer and visible-page version checks; preserve scheduled warm reads, auth, source read-only access and failed-refresh data retention.

- October 22 upstream no-show accounting: see MAGIC-MIKE-UPSTREAM-NO-SHOW-ACCOUNTING-2026-10-22.md. The upstream no-show true branch writes an excluded receipt before owner-specific claim settlement. Preserve exact source pairing and upstream reason; do not add another receipt writer to the shared `Set: rep_no_show`, because AI-classified exclusions already have one.

- Closed Sales Library page retired at Moonis’s request on October 27, 2026: route and Admin Insights link removed; data retained for future documentary/other winning-call research. See the retirement and reuse notes in MAGIC-MIKE-CLOSED-SALES-LIBRARY-2026-10-22.md. Preserve `closed_sales_library_snapshots`, the private extracts, import/read-model code and tests. The October 22 snapshot is not a live feed; recording order does not establish which call closed the sale.

## Objection-first coaching (October 29)

- See MAGIC-MIKE-COACHING-UPGRADE-2026-10-29.md for rollout evidence and rollback. Official/manual coaching now uses generation `magic-mike-objection-coaching-2026-10-29` and source-bound `objection-coaching-v2`. Only this generation is Enhanced; older and in-flight prior generations are Legacy without rewriting history.
- Keep Tyler V3 objection classification separate from observed handling, resolution, questions and payment outcome. Report prose hides internal metadata; evidence remains available. Report chat, Docs and dashboard derive from the same reviewed, safety-repaired record. Never bypass a safety edit with stale structured content.
- Enhanced safety repairs target only explicit prose paths. Show identity, category labels and evidence metadata are not repairable sentences; explicit metadata findings or unmapped findings stay held. Preserve the safety finding rationale and current offer knowledge in the existing repair stage. See MAGIC-MIKE-RECOVERY-LOOKUP-2026-10-29.md.
- Sonnet 5.5 writes and Opus 5.5 reviews within the existing stages. Preserve caching, exact request/source identity, bounded repair, scoring/compliance separation and original node count. The current scoped three-family policy pack is versioned; later source changes require an explicit policy refresh and validation.

- October 29 coverage reconciliation: exact-recording aliases require a completed canonical claim plus its exclusion receipt; never infer delivery from a claim alone. Scorecard-create failures must persist an uncertain-write hold and settle the matching owner. See MAGIC-MIKE-COVERAGE-RECONCILIATION-2026-10-29.md.

- November 3 coaching safety boundary: see MAGIC-MIKE-SAFETY-BOUNDARY-2026-11-03.md. Enhanced repair paths canonicalize numeric bracket indexes before prose-only targeting. Final wording and placeholder cleanup must never edit show identity, classification or evidence metadata. Preserve fail-closed safety checks and exact-source duplicate controls. Apply the scoped boundary builder after historical coaching builders when regenerating compatible workflows.

- November 5 coaching repair contract: see MAGIC-MIKE-COACHING-REPAIR-CONTRACT-2026-11-05.md. Preserve explicit per-candidate safety adjudication, whole-field atomic repairs, matching request IDs and fail-closed metadata/evidence boundaries. Manual repairs use the existing durable provider only when needed; do not restore the single-phrase local-only path. Apply the scoped repair builder after compatible historical builders, never over an unverified live baseline.

- November 6 empty safety review/intake update recovery: see MAGIC-MIKE-EMPTY-REVIEW-INTAKE-RECOVERY-2026-11-06.md. An omitted L1 list is empty only for zero candidates; actual candidates and L2 findings remain strict. Apply the empty-adjudication follow-up after the repair-contract builder. Exhausted Airtable updates retain exact source/document payloads; the existing bounded worker reads, guards, updates and verifies the same record without rerunning AI or document creation. Preserve claimed-event CAS, newer manual edits and ambiguous-write holds.

- November 8 exclusion citations: see MAGIC-MIKE-HELD-COACHING-2026-11-08.md. Move only exact parenthetical transcript citations from exclusion prose into structured evidence; unknown IDs and unfinished text remain held. Preserve the independent eligibility confirmation and owner-specific recovery/artifact checks.

## Coaching foundations release (November 9)

- See docs/coaching-lab/PRODUCTION-RELEASE-2026-11-09.md for authorized rollout status and rollback. Keep the v3 reviewed source-bound record authoritative across Docs, dashboard, chat and insights. Core default remains isolated; production binding requires explicit mode and the existing durable provider.
- Preserve current governed knowledge precedence and request identity across JSONB roundtrips. Do not replace approved policy revisions with fetch timestamps or repeat paid reviews on reordered JSON keys. Keep compliance/scoring separate and retain v3 readers if reverting generation after v3 artifacts exist.

- November 10 admin navbar: see MAGIC-MIKE-ADMIN-NAVBAR-2026-11-10.md. The application header receives server-filtered destinations from the same registry as Admin Insights. Preserve FAQ-only scope, ordinary-rep exclusion, nested active matching, keyboard/mobile behavior and existing page/API authorization. Keep admin-link prefetch disabled; no data/workflow changes belong in navigation work.

## Script Adherence prospective versions (November 10)

- See MAGIC-MIKE-SCRIPT-VERSIONS-2026-11-10.md. Saved calls and metrics are immutable; use their stored rubric version for detail and aggregates. New draft selection uses call-start time against the activation timestamp; review/publication use the original durable request version. Never apply current global rules to in-flight or scored historical calls.
- Preserve full-source context bounds and explicit holds; omit optional prior-model text before source evidence. Daily Google Doc monitoring flags changes for review and never automatically promotes rules. Coaching and FAQ remain separate.

## Tyler coaching release (November 10)

- See `docs/coaching-lab/TYLER-PRODUCTION-RELEASE-2026-11-10.md`. New generation is `magic-mike-tyler-coaching-2026-11-10`; historical foundations payloads remain readable and must not be rewritten. Keep the old core available for in-flight execution/rollback.
- A confirmed first-stage terminal safety format failure can return as `repair_required` with its exact retained receipt, but its checkpoint stays failed. It is never cached approval. The core enforces one bounded format review; unknown paid outcomes, refusal, stale candidate and unmapped findings remain held. Do not reissue the original paid request during resume.

- November 10 terminal coaching recovery: see `docs/coaching-lab/TERMINAL-RECOVERY-2026-11-10.md`. Preserve aggregate contract diagnostics, one bounded repair, exact failed-receipt reuse at zero new cost, and independently reviewed exclusion routing. Excluded results are not scored reports; unknown outcomes and repeated repair failures remain held. Use the scoped terminal-recovery builder against freshly verified parents rather than regenerating unrelated workflow code.

- November 10 direct admin navigation: preserve visible one-click destinations (two desktop rows; scrollable links below 1024px), explicit FAQ labels, admin tool access and matching sticky clearance. Do not restore category dropdowns without user approval. See the direct-link revision in MAGIC-MIKE-ADMIN-NAVBAR-2026-11-10.md.
