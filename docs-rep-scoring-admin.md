# Rep Performance Reviewer

Production implementation record for the hidden Magic Mike manager page and its isolated scoring pipeline.

V4.4 manager-policy changes and release evidence are recorded in `REP-SCORING-V4-4-MANAGER-RELEASE-2026-08-07.md`. V4.4 deliberately reuses the completed, immutable V4.3 call assessments; it does not create another backfill. V4.3 workflow evidence remains in `REP-SCORING-V4-3-RELEASE-2026-08-07.md`. V4.2 remains the immediate workflow rollback path and V3 remains preserved behind it.

V4.2 correction work and its acceptance evidence are recorded in `REP-SCORING-V4-RELEASE-2026-08-06.md`. V3 remains an immutable rollback path; the release record states the exact cutover status.

## Production boundaries

- Page: `/manager/rep-scoring`
- Access: exact allowlist from `REP_SCORING_ADMIN_EMAILS`; initial admin is `syed.haider@insidesuccess.com`.
- Source: the existing `Zoom Closer Calls` table is read-only. The upstream Zoom intake already restricts calls to the two approved Closer groups.
- Storage: separate Airtable base `appEQQkTlJnc7tJgi`.
- Google Docs: transcript reads only. No Docs or Drive writes.
- Slack: no credential and no reads or writes.
- Existing Magic Mike workflows `qMQYNQtQbRZWjtG2` and `L8Nn7xncA9ZPDdWA` are unchanged.
- The output is a coaching and review signal, never an automated employment verdict.

## n8n

V4.3 coordinator: `dSULjXP2oh1kXeRb`. V4.3 worker: `KncPcmxT0xDQcEds`. V4.2 coordinator `53txJ8KuCRGim8LB` and worker `MZv9GY5l5HDikIql` are the immediate rollback pair.

The V4.3 scheduler keeps the proven adaptive 30-minute architecture: it checks for an unexpired V4.3 worker lease before scanning, skips a busy slot successfully, rotates one completed historical day through the current day, always adds the newest two hours, and admits at most 160 calls in no more than eight workers of 20. V4.3 uses independent immutable scorer-version keys, so it can backfill or roll back without editing V4.2 history.

V4.3 keeps three-review evidence-valid consensus but replaces the generic strict rubric with dimension-specific Inside Success TV anchors. A prospect-controlled early ending or unreachable topic can be not applicable; a call with fewer than three fairly observable dimensions is excluded rather than converted into artificial low scores.

### V4.2 retained architecture history

V4.2 coordinator: `53txJ8KuCRGim8LB`. V4.2 worker: `MZv9GY5l5HDikIql`. V3 coordinator `JQgSOlzomtjBotYJ` and worker `lXXiUGvoWk18dNFk` remain the rollback pair.

The cumulative manager result covers every valid score from the fixed start `2026-07-18 00:00 America/New_York` onward. During catch-up, the coordinator gets a run opportunity every 30 minutes. A lightweight preflight first checks for any unexpired V4.2 worker lease: an active lease makes that slot exit successfully, while a clear preflight scans one deterministic historical day plus the newest two hours. The 19 fixed historical shards rotate once per slot, so the launch backlog is revisited in about 9.5 hours without loading the whole source history into one n8n execution; the live two-hour slice keeps newly arriving calls eligible on every clear slot. The selector admits up to 160 unprocessed calls and dispatches at most eight execution-local batches of at most 20 calls. Each isolated worker acquires or refreshes the call lease before reading the transcript or calling the model. It resolves the transcript speaker against the rep roster, requests three independent `deepseek-v4-pro` reviews, validates exact timestamp/speaker/quote evidence, computes dimension-level median consensus in code, and writes either an immutable assessment or a quarantine record.

The adaptive 30-minute schedule is the only enabled trigger in the live graph; its controlled-test webhook was disabled after acceptance. Worker executions are internal sub-workflow runs rather than per-call schedules or webhooks. Active worker leases and completed V4.2 idempotency keys are excluded from later selection. The coordinator itself has a 25-minute execution timeout, so a heavy coordinator cannot remain alive at the next 30-minute boundary. The 160-call ceiling provides up to 7,680 calls/day of theoretical dispatch headroom when every slot is clear; skipped busy slots intentionally reduce that maximum to protect the n8n instance.

An active worker lease is treated as already in progress, so overlapping or delayed triggers cannot score the same call twice. Provider and storage operations retry within the isolated worker; a failed call cannot stop another batch, and a safely completed quarantine is never presented as a score.

Workflow IDs and rollback:

- V4.2 coordinator: `53txJ8KuCRGim8LB`
- V4.2 internal worker: `MZv9GY5l5HDikIql`
- V3 rollback coordinator: `JQgSOlzomtjBotYJ`
- V3 rollback worker: `lXXiUGvoWk18dNFk`
- Durable pre-parallel rollback workflow: `4b8UPCDEDwubFBnX` (`MM Rep Performance Reviewer - PRE-PARALLEL ROLLBACK 2026-07-31 (INACTIVE)`). It is a validated clone of pre-parallel version `384`; the workflow and both triggers are disabled.
- To restore the prior single-workflow path, deactivate the parallel coordinator and worker, review the rollback clone, enable only its hourly schedule, and then activate it. Existing immutable scores and ledger history are retained.
- The controlled test webhook is disabled in the published coordinator; the 30-minute schedule is the only enabled trigger during catch-up.

Production canaries on July 31, 2026:

- Coordinator execution `419487` leased four calls and dispatched two isolated two-call workers, executions `419490` and `419491`. The workers started concurrently and independently reached the transcript and DeepSeek path. This canary also exposed that a provider node could return no item after exhausting its old timeout, safely leaving a lease recoverable but ending that batch early.
- The worker was corrected to preserve an item after transcript/provider failure, use the provider-aligned timeout, and continue the batch through quarantine and ledger completion.
- Final coordinator execution `419608` dispatched two calls to worker execution `419619`. The worker finished successfully with two DeepSeek outputs, one valid immutable score, one evidence-validation quarantine, and two completed ledger entries. This proves that a rejected assessment no longer stops the next call in the batch.

The only enabled trigger is the adaptive 30-minute schedule. Every slot performs only the lease preflight first. A busy slot ends as the successful no-op `skipped_active_batch`; a clear slot admits at most 160 unprocessed calls and divides them into no more than eight worker batches of at most 20. Selection is `cumulative_evidence_fill_v2`: it first completes reps closest to three total valid calls, then fills a missing call type, and finally rotates by prior attempts. Within a chosen rep/call-type group, the newest available call is used. Active V4.2 leases and completed V4.2 idempotency keys are skipped. Coordinator state is execution-local; concurrent contexts cannot overwrite a shared batch array. If the preflight read fails after three retries, the workflow fails closed instead of launching a potentially overlapping batch.

The ledger and score reads are deliberately collapsed between Airtable nodes. Before this correction, the score snapshot ran once per ledger record, multiplying roughly 90 real score rows into more than 20,000 execution items and causing 30-minute cancellations. The corrected graph reads each snapshot once; controlled execution `418910` read 234 ledger rows, collapsed them to one item, and read 122 score rows exactly once.

Every scheduled run writes a separate coverage snapshot to `scoring_runs`. The snapshot records the exact start/end boundaries, source reps, rep/call-type groups, current-period valid scores, groups and reps at the three-score threshold, candidate count, completed attempts, active leases, waiting calls, selected batch size, and a reconciliation flag. It is a fan-out telemetry branch: it does not modify source calls or the existing score/quarantine/ledger path. Raw queue counts are kept in a collapsed technical section instead of being presented as performance results.

V3 also treats a missing or `null` critical-event score cap as no cap. V2 is retained as immutable audit history but is excluded from the live manager view because JavaScript numeric coercion could turn a model-returned `null` cap into an incorrect zero composite.

Every new quarantine diagnostic includes the source call's meeting date. The manager view counts an unresolved quarantine only when that call belongs to the same fixed reporting period as the displayed scores, and excludes it when the same idempotency key has a valid score. Older validation rows without a reliable source date remain in Airtable for audit history but are not mixed into the current manager metrics.

Current scorer contract:

- Scorer: `rep-reviewer-v4.3`
- Prompt: `rep-prompt-v4.3-istv-anchored`
- Rubric: `rep-rubric-v4.3-istv-anchored`
- Config: `rep-scoring-config-v9-istv-anchored`
- Model: `deepseek-v4-pro`, three-review consensus in non-thinking mode at temperature zero
- Call 1 and Call 2+ use separate dimensions and weights.
- Prerecorded video statements do not earn rep-performance credit.
- An applicable dimension contributes only when its timestamp, rep speaker, and exact quote pass validation. An invalid dimension is excluded from that review's consensus input instead of silently contributing points or discarding unrelated valid evidence.
- At least two of three reviews must retain at least three evidence-valid applicable dimensions. Unsupported critical events are removed, invalid non-scoring behavior evidence is downgraded, and every correction is disclosed in the call audit context. Calls that still lack enough supported evidence are quarantined.

One-time setup workflows are retained inactive as rollback/audit records:

- Airtable schema: `9O3sc3jOAdUrwXmH`
- Initial configuration: `AhUI8s3XNYZ3x33y`
- Access verification: `r6ZoJQeh8RIbdAc0`

## Airtable tables

- `processing_ledger`: `tbl7YKjR3vsuyHynd`
- `call_scores`: `tblEcY6gKRxDUd5Li`
- `quarantine`: `tbl5TXjtjjSAXWjkb`
- `rep_identity`: `tbloXFrLtS3MnAY81`
- `rep_rollups`: `tbl8zsbIn77o80yF2`
- `config`: `tbl8sgHEgvEvn43Cc`
- `formal_reports`: `tbllnZTrnReUVQfy7`
- `scoring_runs`: `tblPadsfFbjxcCQz2`

The dashboard derives cumulative rep results directly from current-version immutable scores and excludes internally inconsistent assessments. Call-type scores remain separately visible. When both types exist, the overall rep score is the equal-weight mean of the Call 1 mean and Call 2+ mean; call volume cannot make one type dominate the other. When only one type exists, its score is shown with a partial-coverage label.

## Manager experience

The hidden page is intentionally a score-and-coaching hybrid:

- The factual 0–100 score and its band remain prominent.
- The default table now shows the strongest 15+ call evidence and remains sorted lowest score first. Managers can broaden it to 8+, 3+, or all evidence.
- `Needs attention` requires a call-type result below 45 with at least eight valid calls, a result below 55 with at least fifteen valid calls, or a decline of at least 15 points whose current five-call mean is below 60.
- A high-severity event is a separate `Critical call to verify`. It links to the exact call and never turns one call into a rep-performance verdict.
- A recurring coaching concern requires at least eight observations in the same dimension, an average below 55, and at least three Needs Improvement or Unacceptable observations representing at least 30% of its evidence. A rep may correctly have no recurring weakness.
- Search and status controls let a manager show all results, needs-attention results, supported coaching focuses, critical calls, or reps with no priority concern without changing the underlying score.
- The overview is reduced to six decision fields: rep, overall score, evidence amount, main finding, recent direction, and the review link. Call-type details remain on the rep page instead of competing with the first decision.
- The headline `Needs attention` count includes only supported low or declining rep-level signals. A separate `Critical calls to verify` card prevents call-level events from inflating the underperformance count. The adjacent `Strong evidence` card states the 15-call default, and the table makes 8+, 3+, and all-evidence views explicit.
- Processing details disappear from normal manager use when the queue is current. A compact catch-up panel appears only when calls are genuinely waiting.
- While a backlog exists, a plain-language progress panel compares unique finalized outcomes (valid scores plus unresolved evidence quarantines) with the largest trusted all-window source inventory already recorded. The rotating one-day safety shards are operational inputs, not progress denominators, so the manager-facing percentage cannot fall merely because the next shard contains more calls. The panel labels this as an approximate launch-backlog measure; new live calls continue separately.
- `/manager/rep-scoring/rep/[repKey]` opens with a one-sentence manager summary, the overall score and evidence amount, compact Call 1 and Call 2+ summaries, supported concerns, supported strengths, recent direction, and a specific next action.
- A concern is shown only when the same dimension passes all three V4.4 recurrence tests: evidence amount, low average, and repeated genuinely weak observations. The page may therefore show zero, one, two, or three concerns; it never invents a fixed number of weaknesses.
- A strength is shown only when it has at least eight scored observations and averages at least 75. Strong reps can correctly display no supported recurring weakness.
- Coaching evidence links select the weakest supported example for that exact dimension. Critical-event cards link to the exact assessment that contains the event, fixing the V4.3 cross-linking defect.
- Up to 24 recent call cards remain available in a collapsed evidence section so managers can verify the result without facing the raw audit trail by default.
- Call evidence pages show dimension names, weights, band points, score contribution, reasons, quotes, timestamps, behavior status, call context, and technical provenance.

The Aug 5, 2026 manager-UX release changes presentation and aggregation labels only. It does not change the n8n coordinator, worker, DeepSeek prompt, scoring weights, evidence validation, Airtable schema, source intake, Coaching, Ask Sales, Slack, or Google content.

Release verification on Aug 5, 2026:

- GitHub PR `#114` shipped the manager-first overview, evidence filters, adaptive concern/strength rules, concise rep summary, recommended action, and collapsed call evidence.
- Production verification found and corrected two presentation edge cases through PRs `#115` and `#116`: coaching opportunities are separate from no-recurring-weakness results, and fewer-than-three-call samples cannot appear as clear results.
- Final production commit `bf5d8f1abae07f854a447752965e0b5f6ee36441` deployed as `dpl_DikYBKmr4Mkce3eNEucpGNz4m7yf`, reached `READY`, and owns the canonical production alias.
- Authenticated production verification showed 45 reps in the default 15+ call view, 67 at 8+, 97 at 3+, and 112 total scored reps. Evidence, status, and search filters reconciled with their visible row counts.
- A real supported-clear case showed no recurring weakness without inventing one; a real strong-evidence concern case showed only its evidence-backed recurring dimensions. Early evidence displayed the neutral insufficient-evidence state.
- Browser console warnings/errors and Vercel runtime errors for the reviewed manager routes were empty. Eight rep-scoring tests, scoped ESLint, TypeScript, and repeated full production builds passed without starting a local development server.

Release verification on Aug 6, 2026:

- GitHub PR `#118` introduced the speaker-safe V4.2 scoring contract, consensus calibration, cumulative manager aggregation, safer parallel coordinator/worker pair, isolated telemetry, and the simplified manager experience. It merged as `5edbfa2b105aa2e8f91c3cda479b7c72d5351802`; final manager-copy PR `#119` merged as `5a27eefb16708a4db6d4246e233374a0211ca991`; truthful-progress PR `#120` merged as `c0884982c338b0ccabf53b2e7c874a2bbccaed5c`.
- Final production deployment `dpl_AHRZvrCFA4NU4tNaE8vFTJ5y8nbC` reached `READY` and the canonical production alias served the V4.2 manager view. Independent preview deployment `dpl_CpjzdxtQLr884zJhQ4KYGydtDLV8` also reached `READY`; GitHub-created previews failed during Vercel resource provisioning before any application build began.
- The authenticated production overview loaded for `syed.haider@insidesuccess.com`, defaulted to the 3+ evidence view, sorted lowest score first, and exposed stronger 8+ and 15+ evidence filters. Rep and call drill-downs showed the stored reasons, exact timestamped quotes, score contributions, context, and scorer provenance.
- Vercel reported no runtime error clusters for the rep-scoring routes. The only observed 404 requests were optional Apple touch icons and were unrelated to the manager page.
- An n8n auto-deactivation email corresponded to the earlier intentionally over-capacity 20-worker probe. After the eight-worker cap and active-lease protection were published and the worker reactivated, the next 20 worker executions all succeeded; no later worker crash was observed in that verification window.
- First unattended hourly coordinator execution `445666` succeeded in `scheduled_parallel` mode. It read 2,976 eligible calls, reconciled 272 final outcomes plus 2,704 waiting calls, admitted exactly 160 calls, and dispatched eight 20-call workers (`445710`–`445717`) concurrently. Four workers had succeeded and four remained actively processing when the release observation ended; none had crashed.
- That unattended run exposed one stale coordinator-only ledger query still filtering `rep-reviewer-v4`. The coordinator was paused, the filter was surgically corrected to `rep-reviewer-v4.2`, validation remained at zero errors, and the published active graph was verified before the hourly schedule resumed. Scores and quarantines were already protected by immutable V4.2 outcome keys; the correction ensures active V4.2 leases are also excluded from future selection and restores ledger reconciliation telemetry.
- Final authenticated production verification showed 248 valid scores, 41 review-ready reps, 95 scored reps in the all-evidence view, and six supported needs-attention signals while the remaining workers continued. The progress panel showed the factual 160-call active batch without a speculative ETA; browser console and Vercel runtime errors were empty.
- Fifteen rep-scoring tests, TypeScript, scoped ESLint, and a clean Next.js production build passed without starting a local development server.

Release verification on Aug 7, 2026 (V4.4 manager policy):

- GitHub PR `#128` merged as `dd6f54604f51af3eeeb54870cbc99b16a578d4cc`; production deployment `dpl_7hDpPYncQvBqtUx3K2qsoQMdMsJN` reached `READY` and owns the canonical alias.
- The authenticated page read 2,572 immutable V4.3 calls across 114 reps. Its 65-rep strong-evidence cohort reconciled to 8 Needs attention, 23 Coaching focus, and 34 No priority concern results.
- Seventeen critical calls were separated from rep-performance status. Twelve strong-evidence reps had at least one such alert.
- Sarah Matte verified the corrected event path: her 77.5 result remains No priority concern, while the separate pricing-omission alert opens the exact flagged call and matching timestamped evidence.
- Jackeline Medina verified the coaching path: the visible recurrence counts pass every V4.4 rule and both manager links open the same exact weakest supporting call.
- Browser console warnings/errors and deployment error logs were empty. Twenty-two rep-scoring tests, TypeScript, scoped ESLint, two production builds, diff checks, and credential scans passed without starting a local development server.

Display bands for the current V4.3 scorer are factual labels for the assessed call:

- 0–24: Unacceptable
- 25–49: Needs Improvement
- 50–69: Developing
- 70–84: Meets Expectations
- 85–100: Excellent

The workflow, not DeepSeek, calculates the final numeric score from the stored band points and weights.

## Vercel environment

All values are server-only; none use the `NEXT_PUBLIC_` prefix.

- `REP_SCORING_ENABLED=true`
- `REP_SCORING_ADMIN_EMAILS`
- `REP_SCORING_AIRTABLE_TOKEN`
- `REP_SCORING_AIRTABLE_BASE_ID`
- `REP_SCORING_SCORER_VERSION=rep-reviewer-v4.3`
- Existing V4.3 threshold variables may remain set for rollback compatibility. V4.4 uses separate optional server-only overrides and safe defaults:
  - `REP_SCORING_V44_ATTENTION_MIN_CALLS=8`
  - `REP_SCORING_V44_ATTENTION_SCORE=45`
  - `REP_SCORING_V44_STRONG_EVIDENCE_CALLS=15`
  - `REP_SCORING_V44_STRONG_EVIDENCE_ATTENTION_SCORE=55`
  - `REP_SCORING_V44_DECLINE_THRESHOLD=15`
  - `REP_SCORING_V44_DECLINE_CURRENT_SCORE=60`
  - `REP_SCORING_V44_RECURRING_MIN_OBSERVATIONS=8`
  - `REP_SCORING_V44_RECURRING_AVERAGE=55`
  - `REP_SCORING_V44_RECURRING_WEAK_OBSERVATIONS=3`
  - `REP_SCORING_V44_RECURRING_WEAK_RATE=0.3`
- Optional table overrides: `REP_SCORING_ROLLUPS_TABLE`, `REP_SCORING_CALL_SCORES_TABLE`, `REP_SCORING_QUARANTINE_TABLE`, `REP_SCORING_CONFIG_TABLE`

If the feature flag or token is missing, the page renders a clear safe-unavailable state and performs no writes.

## Review access

Use the canonical production route: `https://sales-performance-dashboard-rose.vercel.app/manager/rep-scoring`.

The production administrators are exactly `syed.haider@insidesuccess.com` and `tyler@mawercapital.com`. Both addresses pass the global Google sign-in gate and are separately required by the rep-scoring page allowlist. Preview deployments do not inherit production authentication secrets and are not valid review links. The sign-in page distinguishes an unconfigured preview from a genuine email rejection so infrastructure failures do not appear to be allowlist decisions.

## Verification and rollback

Verified without running a local development server:

- Cumulative workflow release versions `376` and `377` preserve workflow version `375` as the immediate pre-change rollback.
- Controlled cumulative executions `418904` and `418910` both completed successfully. Execution `418910` used the exact fixed start `2026-07-18T04:00:00.000Z`, found 2,113 eligible calls across 114 reps, reconciled 233 completed + 1 active + 1,879 waiting, and wrote a valid v4-config score.
- The fan-out correction reduced the score snapshot from more than 20,000 multiplied execution items to 122 real score rows read once.
- The controlled webhook was disabled again after the verification runs; the scheduled coordinator remains the only enabled trigger.

### Adaptive 30-minute catch-up and crash recovery — 2026-08-06

- The original unguarded 30-minute schedule allowed the next coordinator to start while workers from the preceding batch were still active. Execution `446148` dispatched eight workers whose tail lasted about 32 minutes; coordinators `446252`, `446311`, and `446433` then crashed, causing n8n to auto-deactivate the workflow.
- Live coordinator `53txJ8KuCRGim8LB` now retains 30-minute opportunities but uses a lightweight Airtable lease preflight. Any unexpired V4.2 worker lease causes that slot to finish successfully without the source, ledger, score, or quarantine scans; the next slot retries automatically.
- The first guarded full-history execution, `446517`, still crashed before dispatching a worker. This isolated a second resource failure in the unbounded coordinator scan. The source read is now bounded to one rotating historical day plus the newest two hours; no score, quarantine, ledger, prompt, model, or dashboard contract changed.
- Sharded execution `446722` then exposed the precise memory multiplier: 620 current scores would have caused the downstream quarantine search to run once per score. A new `Collapse Score Snapshot` node now reduces the score output to one control item before the quarantine read. Controlled parent `446727` completed in 24.2 seconds with 177 source calls, 860 ledger rows, 620 scores, one collapsed score item, and 263 quarantine rows read exactly once. Its one-call worker `446728` completed successfully in 56.5 seconds with a safe quarantine outcome and completed ledger state.
- The coordinator has a 25-minute execution ceiling. The preflight retries three times and fails closed on a storage error. The 160-call cap, eight-worker ceiling, 20-call worker size, model, credentials, fixed source window, leasing, and immutable idempotency behavior were not changed.
- The active workflow is `MM Rep Performance Reviewer V4.2 - Speaker Safe (LIVE ADAPTIVE 30-MIN SHARDED)`, active version `e3caa422-3660-41ce-89f8-23f7374e8d4d`. Runtime validation returned zero errors; the controlled webhook remains disabled and the schedule is the only enabled trigger. Workflow-history version `483` preserves the verified hourly safe-mode rollback, and version `478` preserves the pre-acceleration hourly graph.
- Cumulative aggregation tests verify equal call-type weighting and lowest-score-first ranking, alongside the existing score-presentation tests.
- Scoped ESLint and the full Next.js production build pass without starting a local server.

- n8n workflow validation: zero errors
- Rep-scoring presentation unit tests: four passing tests covering contribution math, readable labels, evidence confidence, and strongest/weakest dimension selection
- Dashboard lint and Next.js production build after the manager-experience redesign
- Source Airtable and isolated store credential access
- DeepSeek V4 Pro request using the task-specific credential
- Exact-quote failure quarantine
- Call 1 invalid applicability quarantine
- Reasoning-token exhaustion quarantine
- Valid v2 Call 2+ score written with exact evidence
- One-week shadow backfill execution `413452`: 10 eligible calls examined, 7 new v2 scores, 1 quarantine, and 2 previously completed calls skipped
- Corrected v3 smoke execution `413836`: 1,106 eligible source rows collapsed to one ledger request, 1 new call selected, and a 70-point `Meets Expectations` score written despite a `null` critical-event cap
- Corrected v3 batch execution `413852`: 1,108 eligible source rows, 10 selected calls, 3 valid v3 scores, 4 evidence quarantines, and 3 calls safely skipped after a concurrent run completed them first
- Dashboard lint and production build
- Production Vercel deployment `dpl_EiyerGTXVmNBcMMrGuRCmhGskKkV` reached `READY` from merge commit `7ae76e4abfdac5080269f5a610f73dfc871d8a4b` and owns the canonical `sales-performance-dashboard-rose.vercel.app` alias
- Isolated n8n execution `414998` completed successfully in 103.5 seconds: the source read found 1,119 exact rolling-seven-day candidates, wrote coverage snapshot record `recPbMNNKqHoLLdC3`, admitted one controlled test call, wrote one immutable score, and completed its ledger record
- The controlled webhook was disabled again after verification; the active workflow validates with 27 nodes, 31 valid connections, zero invalid connections, and zero errors. Workflow version `353` (version 45) remains the pre-change rollback point
- The manager dashboard now uses the workflow snapshot cutoff for its score window, preventing a boundary call from disappearing merely because the page was opened a few minutes after the snapshot
- Fixed-window and balanced-selection execution `415361` completed successfully in 70.0 seconds: 1,102 source candidates across 105 source rep emails and 184 rep/call-type groups reconciled exactly as `0 completed + 0 active + 1,102 waiting`; the workflow admitted one newest-first balanced Call 1, wrote a valid 78.8 `Meets Expectations` assessment using `rep-scoring-config-v3`, completed its ledger row, and restored the controlled webhook to disabled
- Evidence-fill execution `415544` completed successfully in 110.5 seconds after the live score-field mapping was corrected: 1,113 fixed-period candidates across 105 source rep emails and 185 rep/call-type groups reconciled exactly, the selector recognized two existing current-period valid scores across the dataset, chose the newest remaining Call 1 for the near-ready rep/call-type group, and wrote a valid 75-point `Meets Expectations` assessment
- Follow-up execution `415548` completed successfully in 108.3 seconds: it saw three valid current-period scores across the dataset, selected the same rep's Call 1 group because that group was one score short of readiness, and wrote a valid 33.8-point `Needs Improvement` assessment. The production page then showed one rep ready and one supported manager-review signal based on three same-type calls with a 62.5 mean; no one- or two-call sample was promoted as a manager-review result
- The active workflow validates with 28 nodes, 32 valid connections, zero invalid connections, and zero errors. Current retained workflow version `375` has the controlled webhook disabled; disabling the schedule remains the fastest operational stop
- GitHub PR `#109` merged as `6694844b7be7a437dfd9ab5b49e6b8485e37c315`; production Vercel deployment `dpl_HDCVapELiSR3CdAZCbJhc2QSW52N` reached `READY` and owns the canonical `sales-performance-dashboard-rose.vercel.app` alias
- Manager-copy PR `#110` merged as `4b7d2212769b431265667f5742b7b5aff90d70b2`; production deployment `dpl_CQs1gk7pZybGXx4jcqpbhrqAPCcx` reached `READY` on the same canonical alias

The one-time human calibration is intentionally separate from normal manager use. See `REP-SCORING-CALIBRATION.md`. Rubric weights or thresholds must not be changed merely to make current scores look better; calibration evidence controls any later scoring-contract revision.

Rollback is independent by layer:

1. Deactivate V4.3 coordinator `dSULjXP2oh1kXeRb`.
2. Restore `REP_SCORING_SCORER_VERSION=rep-reviewer-v4.2` and redeploy the last known-good dashboard artifact.
3. Reactivate V4.2 coordinator `53txJ8KuCRGim8LB`.

No rollback step modifies the production coaching intake, official scorer, source Airtable records, Slack, or Google content.
