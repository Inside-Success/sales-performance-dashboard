# Magic Mike Rep Scoring V7.1 — Structured Calibration Release

Date: 2026-08-13
Status: isolated validation complete; full backfill and Coaching publication not started

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

## Final validation result

- Final: 155 scored and 6 fair exclusions
- Scored mix: 75 Call 1 and 80 Call 2+
- Range: 17.0–85.4
- Median: 80.6
- Mean: 74.4
- Below 75: 54
- Below 60: 27
- Performance levels: 4 Unacceptable, 23 Needs Improvement, 27 Developing, 101 Meets Expectations
- Exact 100 or at least 90: 0
- Selective reviews: 39 of 155 scored calls (25.2%), all applied
- Fair exclusions: 5 unresolved speaker mappings and 1 insufficient-dimension result
- Manager aggregation with enough evidence: 7 Needs attention, 1 Coaching opportunity, 5 No priority concern

The result is no longer score-compressed. It includes clearly low calls, a large competent middle, and restrained high scores. Low, median, and high call audits retained exact evidence and coherent dimension scores.

The seven needs-attention signals were not caused by a percentile rule. Their supporting calls repeatedly showed controllable gaps, especially accepting surface Call 1 answers without clarifying commercial need, desired change, consequence, or prospect-specific value. The audit included exact examples from Hassan Qureshi, Irene Brinker, Massimiliano Biancardi, Samuel Molina, Tara Reszitnyk, Alejandra Perez, and Tristan Muller. The evidence supports manager review; it does not by itself support an employment decision.

## Launcher overrun and cost truth

The final cohort exceeded the intended 150-call target by 11 final calls. After the first corrected launch request began its slow source/reference read, two additional test requests were issued before the first run created ledger leases. All three passed the early active-lease check. Per-call ledger checks prevented a second 120-call purchase, but 11 additional unique calls finalized during the race.

This was not a 3× scoring charge: the duplicate workers skipped calls already processing or completed. The avoidable incremental scoring exposure was 11 primary calls plus any selective checks those calls legitimately triggered. The launchers were deactivated, and this launcher must not be reused for backfill. The future coordinator requires a database-level run lock acquired before any source scan, then atomic call claims.

## Final recommendation

- **GO** for reviewing this isolated result with the user and for showing the validation UX to a stakeholder as a shadow demonstration.
- **GO on scoring quality** for a future explicitly approved backfill: the data now contains realistic separation and evidence-supported manager priorities.
- **NO-GO operationally** for starting that backfill with the validation launcher. The prepared atomic control plane and run lock must be wired first.
- **NO-GO** for live V6.3 replacement or Coaching score publication without separate explicit approval after the user reviews this cohort.

## Explicit non-actions

- No historical backfill.
- No live-scoring cutover.
- No Magic Mike Coaching score change.
- No production V6.3 workflow edit.
- No Slack or Google knowledge-source write.

## Rollback

Keep both launchers inactive and leave the isolated worker unattached. The existing V6.3 production and Coaching paths continue independently.
