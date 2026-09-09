# Call 2 scoring correction — September 10, 2026

Status: final candidate passed evaluation and runtime gates; scorer, persistence and dashboard are live; natural V2 call verification pending. No backfill authorized.

## Scope and boundary

User approved forward-only scoring improvements and showing only the numeric call score on the rep's coaching dashboard report. Detailed evidence stays behind the existing manager allowlist. Testing budget maximum $30, minimize spend. Historical scores/reports remain untouched. No Slack/source Google writes, no test notifications, no compliance or Ask Sales changes.

## Implementation

- Retains existing 20/25/25/30 dimension weights, 10/32/55/76/93 bands and deterministic caps/floors. No forced bell curve or blanket uplift.
- Coherent scorer-local prompt replaces conflicting old policy/coaching instructions. Retains ten legacy compatibility coaching fields; the separate official coaching writer still supplies the actual rep report.
- Strips upstream AI classification prose from transcript evidence supplied to the scorer. Explicit prospect/opportunity review and contextual cap checks handle technical truncation, financial disqualification and agreed contract review. Conservative single-speaker plus explicit practice-language guard withholds likely rehearsals; one speaker alone is insufficient.
- Every dimension has a reason and grounded counterevidence; manager persistence retains those details. Existing bounded validation retry remains.
- Same Sonnet 4.6 model, temperature zero and no additional thinking budget. Shorter coherent prompt removes obsolete duplicated context. Existing provider, credentials and graph retained.
- Persistence accepts old/new versions during in-flight drain, builds immutable versioned IDs, and rejects unknown versions.
- Rep-facing score lookup matches current version, source record, rep email and call time. Returns numeric score and opaque assessment ID only. Store failure withholds score without blocking the coaching report.
- Manager overview and drilldown keep current and historical cohorts separate. Earlier scores remain accessible through historical navigation; no mixed averages/trends.

## Deployment order and rollback

Private full baseline snapshots: `.magic-mike-scoring-2026-09-10/baseline/` at workspace root. Dashboard baseline `33a1b8f`. Scorer `35bFcPYdHSADpyTN` and persistence `iG6pvqUTn0askw9y` are existing Rudy-owned project dependencies with caller restricted to official `L8Nn7xncA9ZPDdWA`; preserve caller policy and credential IDs.

Publish backward-compatible persistence, then validated scorer revision on the existing workflow ID (no duplicate trigger), then dashboard. API updates to active workflows publish immediately. Restore baseline Code nodes to roll back scoring; old/new persistence remains compatible. Revert dashboard commit separately if needed. Do not delete rows or rewrite reports during rollback.

## Verification checkpoints

Frozen 40-call sample: 25 development and 15 heldout. Known edge cases must pass before release; repeat checks preserve eligibility and avoid unsupported cap flips. Existing scores are baseline; paid test outputs stay isolated and never pass through report/persistence/delivery workflows.

132 scoring/access/runtime-boundary tests, TypeScript, scoped lint and production build passed. Actual n8n runtime replay passed 27 checks on 11 saved call fixtures, with no provider/storage/delivery nodes. The temporary verifier is inactive. Production cutover and natural-call verification remain pending at this checkpoint.

## Model evaluation and refined eligibility

The initial frozen sample comprised 40 prior executions (25 development, 15 initially held out). Three newly arrived calls were then added independently. Held-out/fresh review caught and corrected scope errors before release: complaint-only, payment-only continuation, and initial qualification recordings must not receive a full Call-2 closing grade. These findings became regression cases, so the final evidence is an iterative regression evaluation, not an untouched blind benchmark.

Additional request-evidence validation rejects conditional incentive/value excerpts being credited as direct commitment asks. The existing single retry can correct these; a repeated invalid response stays withheld. Close execution cannot earn an adequate band solely from pricing/follow-up when no direct ask or concrete close action is evidenced. Actual completed payment/agreement actions and definitive financial disqualification retain their exceptions. Scoring opportunity must be substantive, independently of the upstream Call-2 label. Intake/coaching classification is not changed by this release.

Final candidate evaluated on 27 unique calls: 20 scored, five defensible exclusions, two evidence-validation failures withheld after the single retry (92.6% valid score or exclusion). Scored range 37.8–76.0, standard deviation 11.0. Five separate numeric repeats differed by 0, 0, 0, 0 and 1.3 points. Earlier failed iterations were not released. This is an iterative regression sample, not a blind benchmark or a guarantee of every future judgment.

Complete request text must match the cited transcript turn before a direct ask is credited. The retry receives the rejected evidence and actual source turn as untrusted user data. Invalid evidence remains withheld; it is not replaced with a guessed score. Private manager persistence includes review and close-signal evidence in the existing Call Context JSON.

Recorded provider testing spend across all iterations: $18.56747655. The final 27-call sample cost $2.609931 including retries: average $0.096664 per scorer execution. This excludes separate coaching/compliance costs. The 594-row V1 cohort would imply roughly $57.42 for one pass at that sample average, not an exact invoice; transcript length, exclusions and retry incidence vary. No backfill is authorized or started.

Actual n8n replay of the final Code nodes passed 27 checks across 11 saved fixtures; temporary verifier Wc6FaQJoiVARxESL is inactive. Tests never wrote reports, score rows or notifications.

The live pre-release manager table showed 594 V1 scored calls across 111 rep identities when All reps was selected. This is the V1 cohort, not all historic rubric versions. No backfill started. A future estimate should multiply actual measured evaluation cost by the desired source-call cohort and allow for bounded retries; it cannot be an exact advance invoice.

## Published workflow checkpoint

Scorer published version `7090932d-db97-40c2-8723-2071feb8ad1e`; persistence `bd084b23-1de1-44f7-8e98-1b950f04af73`. Published nodes exactly match the tested candidates. Graph, credentials and caller restrictions unchanged. Existing workflow names retain V1 text for continuity; the emitted score_version is V2. No duplicate scorer or backfill workflow was activated.

## Dashboard and health checkpoint

PR179 merged as `cada7fe4234e1de967299da3247487930e4a58b2`. Production deployment `dpl_6kfbBNfiPnnFr2iLYXskhsvrbbLt` is READY and owns the canonical alias. Production flags enable numeric coaching scores and select V2. Authenticated current/historical manager pages render separately; old coaching report 5870 renders intact without incorrectly attaching its V1 score.

In-flight V1 scorer 697993 persisted through updated persistence 697998 and official coaching created report 5870. This verifies backward compatibility, not V2 natural-call completion. Latest checked intake/official/weekly/provider executions succeed with no new errors; manual latest remains its earlier successful run. Seven legacy scoring/backfill workflows and isolated verifier remain inactive. No monitoring automation was added.

Historical cohort refreshed after release through the authenticated All reps view: 602 V1 scored calls across 111 rep identities. At the final sample average, one pass is approximately $58.19 (not a fixed invoice). Earlier 594-call figure is the pre-release snapshot. No historical scoring was started.
