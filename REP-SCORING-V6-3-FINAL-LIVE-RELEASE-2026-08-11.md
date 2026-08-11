# Rep Scoring V6.3 Final Live Release — 2026-08-11

## Authorized outcome

This release keeps the completed V6.3 historical inventory, continues scoring every eligible new call through the existing five-minute single-flight refill coordinator, adds a fair deterministic manager-review queue, and displays the exact matching V6.3 Call 2+ score inside the existing Magic Mike Coaching report.

The release does not change the Coaching-generation workflow, scoring prompt, V6.3 worker, source calls, Google content, Slack, or prior immutable score history.

## Deterministic manager priority

- Existing absolute `Needs attention` rules remain unchanged and evidence-based.
- Existing recurring dimension concerns remain unchanged.
- Reps remain sorted from lowest overall score upward.
- Among reps with at least 15 valid calls, the lowest 15% are marked `Manager priority` when they do not already have a stronger supported status.
- The comparative flag is explicitly a place to review first, not proof of poor performance. It does not create a weakness, change a score, or mark the rep as `Needs attention`.

## Call 2+ score in Coaching

The Coaching report performs a server-side, read-only lookup in the isolated scoring base. A score is displayed only when all of these checks pass:

- the Coaching report contains a source Airtable record ID;
- its Coaching scorecard key exactly equals the V6.3 score's automation key;
- exactly one immutable score row matches;
- scorer version is `rep-reviewer-v6.3-realistic-fair-1`;
- call type is `Call 2+`;
- status is `scored`;
- the score is numeric from 0 through 100; and
- the record is not internally inconsistent.

Missing, mismatched, duplicated, Call 1, quarantined, old-version, inconsistent, or invalid scores are withheld. Lookup failure never blocks the existing Coaching report. The UI displays only `Call score: N.N / 100`; no scoring reasoning or manager-only evidence is exposed.

## Live and catch-up behavior

- Coordinator: `EghbY2jr86yjJl4d`
- Worker: `w8JaLibcm8zqVGP1`
- Historical inventory: 1,268 of 1,268 terminal before this release
- Schedule: every five minutes
- Concurrency: at most five independent ten-call workers per admitted wave
- Single-flight: any active V6.3 lease makes the next schedule slot a successful no-op
- Live calls after the historical cutoff remain prioritized and uncapped
- DeepSeek balance and lease gates run before source admission

The release does not start a redundant paid historical replay. Calls missed while a provider or lease was unavailable remain retriable and are discovered by the same fixed-window idempotent scan.

## Verification

- Exact-match unit coverage includes correct match, source-ID mismatch, automation-key mismatch, Call 1, old scorer version, quarantine status, internal inconsistency, null score, and duplicate records.
- Aggregation coverage verifies that only the lowest 15% of a sufficiently large strong-evidence cohort receives the comparative manager-priority flag.
- All 343 tests in 31 files passed. ESLint and the Next.js production build passed without a local development server.
- Pull request `#156` merged as `fa3a843bd932063bcff9e4227afeb05e29723cb8`.
- Production deployment `dpl_7gXaB4iB2rwGcJeiHdQFPS7A5Cfz` reached `READY` and owns the canonical `sales-performance-dashboard-rose.vercel.app` alias.
- The signed-in production manager page showed 1,268 of 1,268 historical calls terminal, 1,163 valid scores including the latest live score, 33 strong-evidence reps, and five comparative `Manager priority` rows.
- Production Coaching report `/call/4914` displayed the exact matched score `79.8 / 100` while retaining all existing feedback sections.
- A pre-window unmatched Coaching report `/call/3904` rendered normally with no score, confirming that an unavailable score does not break or create a false zero.
- Vercel reported no runtime errors for the manager and Coaching routes in the post-deployment verification window.
- The V6.3 coordinator and worker both validated with zero errors and zero invalid connections. The coordinator's next clean scan returned `historical_target_complete`, 1,268 historical terminal calls, zero active leases, and no calls needing dispatch.
- The official Coaching workflow was not edited and its five most recent executions were successful.

## Rollback

Revert this release commit to remove both presentation changes. The V6.3 worker, coordinator, immutable score store, and Coaching-generation workflow are independent and remain intact. The score display also fails closed if `REP_SCORING_COACHING_SCORE_ENABLED=false` is set for the deployment.
