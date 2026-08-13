# Magic Mike Rep Scoring V7.1 — Structured Calibration Release

Date: 2026-08-13
Status: isolated 150-call validation in progress; full backfill and Coaching publication not started

## Objective

V7.1 corrects the two remaining V7 release risks: compressed high scores and manager thresholds that could almost never activate. It keeps the fairness protections learned from earlier versions while making ordinary script compliance meaningfully different from specific, high-quality execution.

## Changes implemented

- The primary assessor now returns structured coverage, specificity, and material-gap facts for every criterion.
- Deterministic code derives the final criterion status and numeric score. The model does not select the final number.
- Numeric anchors are now 0 missed, 20 weak, 45 partial, 68 competent, 84 strong, and 100 exceptional.
- Ordinary script completion is competent. Strong requires complete, specific execution without a material gap. Exceptional remains rare.
- Call 1 progression fairness, Call 2+ outcome context, transcript quarantine, exact evidence, temperature zero, and selective review remain intact.
- Manager concern thresholds now operate on achievable evidence amounts without forcing a bottom percentage.
- The manager validation page shows progress to one combined 150-call sample, separate serious and routine priorities, score-spread and high-score-restraint gates, and evidence-linked call review.
- The call page now explains the main finding in plain language before exposing the detailed audit breakdown.

## Isolated workflows

- V7.1 worker: `QPUh149BvYlqhKOq`
- Focused 30 launcher: `Y2M5YOqxwuqpg6Hw`
- Additional 120 launcher: `AMDHxcR2stfvFixj`
- Read-only audit: `U1qAFJ92IjypX5jv`
- Scorer: `rep-reviewer-v7.1-shadow-1`

Both launchers are inactive after their single approved dispatch. The worker has no schedule or public webhook. V6.3 production scoring and Magic Mike Coaching were not modified.

## Focused 30-call result

- Final: 28 scored and 2 fair exclusions
- Scored mix: 13 Call 1 and 15 Call 2+
- Range: 51.3–85.4
- Median: 79.7
- Mean: 76.3
- Below 75: 10
- Below 60: 3
- Exact 100 or at least 90: 0
- Selective reviews: 6, all six applied successfully
- Fair exclusions: two unresolved speaker mappings

Evidence audit sampled the three lowest, a middle, and two highest calls. Low results were supported by exact missed or weak checkpoints. High results retained competent/strong evidence and remained below 90. The cohort produced one genuine needs-attention signal for a repeated concern; no percentile rule was used.

## Larger validation

The second launcher admitted 120 new calls, balanced 60 Call 1 and 60 Call 2+, across twelve reps. It used immutable V7.1 idempotency keys, checked for active leases and provider balance before dispatch, and created twenty bounded workers of six calls. The first 30 calls were excluded from selection and were not purchased twice.

The first two attempted launcher executions failed before selection because a cloned Airtable expression referenced the old context-node name. No scoring call or DeepSeek charge occurred in either attempt. The expression was corrected, the active workflow was re-published and verified, and the single authoritative run then selected 120 calls and dispatched exactly twenty workers.

Final distribution, evidence, exclusions, manager-priority counts, and GO/NO-GO will be recorded here after all 150 calls reach a final state.

## Explicit non-actions

- No historical backfill.
- No live-scoring cutover.
- No Magic Mike Coaching score change.
- No production V6.3 workflow edit.
- No Slack or Google knowledge-source write.

## Rollback

Keep both launchers inactive and leave the isolated worker unattached. The existing V6.3 production and Coaching paths continue independently.
