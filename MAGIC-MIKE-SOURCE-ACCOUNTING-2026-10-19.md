# Coaching source accounting — October 19

## Scope

Owner-approved reliability follow-up for the seventeen source candidates identified by the October 18 sweep. Source Airtable records and source Google documents remain read-only. Model selection, numerical scoring, compliance policy, FAQ, access and dashboard presentation are outside this release.

## Changes

- Normalize speaker whitespace/NFKC consistently through the cleaner and attendance guard. Recognize full assigned-rep names with role suffixes and explicit role-qualified first names. Do not bind bare first names globally.
- Treat generic meeting titles as labels rather than human identities. Correct the coaching-side handoff where a stored rep alias displaced the actual external speaker. Preserve transcript text and evidence verbatim.
- A name mismatch alone cannot turn a substantive two-sided sales dialogue into a no-show. Shared presentation audio/bots do not establish prospect attendance. An unmatched rep label alone cannot convert a short technical recording into a rep no-show.
- Preserve the classifier's original status/reason alongside the deterministic outcome and guard revision. Persist ordinary classifier exclusions as well as recovery exclusions. Empty transcripts are held for inspection; Call 1 exclusions are recorded.
- Retry the read-only Google Docs fetch three times. After exhausted temporary failures, use the existing source-level recovery queue/backoff. Auth/unknown/uncertain-write cases remain held. Early failures reference the loop's paired source, not an unexecuted downstream node.
- Record source/execution receipt metadata in owned Postgres before transcript fetch. An observation failure falls back to normal source processing, preserving item pairing. It must not become an additional hard dependency for delivery.
- Discover by existing `Ingested At` readiness time, falling back to creation time only when absent. Reset old query cursors during migration, preserving unresolved sources and pending-page acknowledgement safety.
- Keep unresolved calls independently of the rolling discovery window. Verify delivered records against actual dashboard rows; close legitimate recorded exclusions; keep queued/processing/held work unresolved. Repeat attention for unresolved/stale work after 24 hours, without automatically replaying unknown deliveries.

## Verification and release

Implementation prepared on a clean isolated checkout from current main. No local development server. Regression replay uses source documents in memory; no transcript fixture copies are committed. Thirteen substantive sales cases pass the new deterministic cleaner-to-classifier handoff; four interrupted/technical cases are assessed separately and must not be forced into fabricated full reports. A deterministic replay is not a fresh model review or proof of delivery.

Local checks: 150 coaching/provider/coverage tests; existing retry, provider, crash-recovery and reliability-contract verifier scripts; role/alias/source-accounting verifier; TypeScript. Standard Turbopack build encounters the existing external node_modules symlink restriction in this checkout; webpack production build succeeds without changing deployed build configuration.

Production publication and staged acceptance are recorded below. Final acceptance distinguishes thirteen restored reports from four justified exclusions; it does not claim seventeen coaching reports were needed.

### First live acceptance

- PR #324 merged as `3a343af`; production deployment `dpl_Amu6hVUPb4StnbyV5LopT91XfVoW` is READY and promoted. The preview encountered the existing integration `Resource provisioning failed` before application compilation; GitHub's tests, TypeScript and production build passed.
- Official published revision `c07aa463-4163-4e0b-99e5-447b85645d93`; coverage revision `63f866b4-f73e-48e3-8309-3a268b3392d9`. Official structural/expression validation has zero errors; the same seven pre-existing advisories remain. Full Code-node static validation emits eight pre-existing helper-array diagnostics; compiled runtime tests and real execution verify the return paths rather than rewriting unrelated working nodes.
- Canary execution `1174101` recovered source `recLnLCo3x8Vu7dku` as dashboard report `/call/8191`; matching receipt is delivered, normal Slack top-level/thread sends succeeded, and the populated generated Google Doc and authenticated report were independently read. Its original classifier checkpoint was reused; writer, factual audit, compliance and safety remained intact. No numerical rescore was run.
- The four insufficient technical/interrupted recordings have explicit reviewed `transcript_too_short` exclusion receipts. No source content was edited and no report was fabricated. An unmatched rep label in the technical fragment is not asserted to prove rep absence.
- Follow-up regression distinguishes an unresolved queued call from a notification actually sent: acknowledgement retains queued work without suppressing its later warning. The consumer sends both unresolved and notified IDs explicitly. The endpoint remains compatible with the prior consumer during publication.
- PR #325 merged as `23ce682`; deployment `dpl_BFpCrScWswyED9WNEMLB2CAo2bTP` is READY/promoted. A sanitized function-only fixture runs the compiled source handoff, early-fetch retry/hold and source-pairing regressions in CI; it contains no source transcripts, model prompts or credential values.
- Full source replay also exposed a calendar bot label using visually substituted Cyrillic letters in `Notetaker`. Fold those letters for bot detection only, consistently in the cleaner and guard. Preserve all original transcript text and human names. The full source resolves to its actual human speaker, rather than treating the bot account label as a person; intake/source documents remain unchanged.

## Rollback

Retain small private before/after node patches and affected connections, without source transcripts or credential values. Revert only this release's node changes and repository commit; do not replace unrelated concurrent FAQ work or alter source systems. Append-only source-attempt metadata is safe to retain on rollback. Retain unresolved coverage IDs when reverting cursor/query logic.

## Final verified acceptance — October 19, 12:02 UTC

- **All seventeen candidates are accounted for:** thirteen substantive calls recovered as reports **8191–8203**, four technical/interrupted recordings have justified `transcript_too_short` exclusion receipts. No queued, processing or held case remains from this backlog. See `MAGIC-MIKE-SOURCE-ACCOUNTING-MANIFEST-2026-10-19.json` for source/report/execution mappings.
- Independent Postgres reads confirm exactly thirteen distinct source matches, one report per recovered source, no duplicates. Every saved rep and full call timestamp matches the original source transcript header. Original transcript documents and company sales Sheet were not edited.
- All thirteen generated Google Docs were independently fetched and contain populated outcome/improvement sections. Every child execution finished successfully, confirmed its exact source/report receipt, wrote its document and returned Slack `ok:true` for both top-level and thread delivery; each reply belongs to its own top-level timestamp. Expected compliance appends succeeded; no delivery failure marker fired. Recovery did not rerun numerical scoring.
- Coverage execution **1174466** independently read the remaining 433 records of the frozen readiness sweep, acknowledged its page, and closed the retained backlog: **zero unresolved IDs, no pending page, no new gap notification**. The two-page readiness sweep covered 943 source records; delivery/exclusion outcomes are checked independently of execution colour.
- Official final saved/published version: **`a8b774bd-6765-4b6e-a1ac-b59330726577`**. Coverage: **`672b2ff6-e3a5-4452-844e-1246d079a180`**. Saved and published versions agree. Official connections/expression validation has zero errors; existing advisories are unchanged. Worker cadence remains five minutes, coverage fifteen minutes. No temporary workflow was created or left active.
- **151 automated tests**, 24 identity cases, compiled source/guard/retry/pairing regressions and 17 real-transcript deterministic replays passed. Real recoveries retained factual audit, bounded content repair, compliance and safety checks. Existing repair paths handled incomplete draft shapes without bypassing review or making invalid drafts cache-reusable.
- Authenticated desktop checks covered Admin Insights, all eight internal admin destinations, manual-report selection and recovered reports. Explanation expansion and transcript passage loading at **24:33** worked on report8192; report8203 shows the actual human speaker Ryan rather than the bot account label. Today/Yesterday no-show filters load selected-period data. Anonymous internal coverage requests return401. No new application errors were returned by the post-release production error-log scan. Fresh naturally arriving Call2 traffic was not invented as acceptance evidence; these thirteen real recoveries exercise the live pipeline.
- New logged model-cost estimate: **USD4.25049326** for recovery; **USD0.00 synthetic paid AI testing**. Seventy-two newly recorded provider checkpoints, no repeated claims; the older exact-match classifier result was reused at zero new classifier cost. Estimates use logged provider usage/pricing, not a separate invoice reconciliation. No new AI node or model change was introduced.
- PR324/325/326 are merged. Verified application/script revision **`b6df463f9abf0ba1cdb4e89fe8d07d30a562a438`**, production deployment **`dpl_ZFTxCR4VczLtbxyu5e7kgL4baxT3`** READY. Private targeted rollback archive is **106,287 bytes**, SHA256 `3ce0347d1054ce74475a6df8edd00a83a63bc7e6f7eddecbdf2d47e6188ca42a`; scoped reverse operations passed dry-run validation. Removed the task-generated442MB webpack cache; no new checkout or transcript archive was created.

External provider/source outages remain possible. These improvements prevent the observed speaker-label exclusions and handled-fetch blind spot, retain unresolved work, and expose uncertain outcomes rather than silently claiming delivery. Separately deferred compliance policy, coaching strategy/taxonomy and causal sales-impact work are unchanged.
