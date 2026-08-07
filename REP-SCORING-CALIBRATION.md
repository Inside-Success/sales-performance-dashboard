# Rep Scoring Calibration

## V5 fairness-first human calibration

The private review page is `/manager/rep-scoring/v5-calibration`. It contains exactly six Call 1 and six Call 2+ calls. These are immutable `rep-reviewer-v5-calibration-1` assessments selected across the prior V4.3 score range; V4.3 scores were used only to diversify the sample and are not treated as ground truth.

The bounded run completed all 12 worker executions. Ten assessments received verifier-approved numeric calibration scores. Two Call 2+ assessments deliberately received no numeric score: one independent verifier found that the primary review punished a rep for respecting a firm prospect decline, and one found material disagreement about how prerecorded material and the rep's framing/follow-up should be attributed. Those are useful calibration cases, not workflow failures. The later, separately versioned V5 shadow backfill is documented in `REP-SCORING-V5-SHADOW-BACKFILL-RELEASE-2026-08-08.md`.

Review each call in the order shown. For each one, reply with:

- Fair / too high / too low / should not be scored
- Whether the transcript reliability decision is correct
- Whether the prospect opportunity decision is correct
- The checkpoint that looks most wrong, if any
- One short note

After this feedback, repeated errors will be corrected under a new immutable V5 prompt/config version. Only then can a full V5 backfill be considered.

## V4.3 calibration

V4.3 changes the rubric anchors, evidence-validator recovery behavior, and manager classification policy, not the model, consensus count, dimensions, or weights. Its first bounded run processed 12 calls in four isolated workers: every worker succeeded, all 12 calls finalized, 9 became valid scores, and 3 were safely quarantined. The valid scores ranged from 44.9 to 70.3. Six calls had a directly comparable V4.2 result; V4.3 changed those scores by an average of +7.1 points, with individual changes from -3.7 to +20.0. This confirms the correction is material and is not a blanket uplift.

The final repeatability check uses identical calls under isolated calibration-only scorer versions after the validator correction. Calibration rows are excluded from the dashboard. The human exercise in this file is recommended before treating individual labels as settled truth; it should be used to identify repeatable rubric errors, not to force a preferred distribution.

The V4.3 manager policy is intentionally stricter than a display band: a rep needs at least 8 same-type calls below 50, at least 15 same-type calls below 60, a supported material decline, or a verified high-severity event to enter `Needs attention`. A coaching opportunity needs five observations in a dimension averaging below 60. No status quota exists.

### Final V4.3 repeatability result

Two post-correction passes assessed the same 10 source calls under isolated scorer versions `rep-reviewer-v4.3-calibration-d` and `rep-reviewer-v4.3-calibration-e`. All four workers in each pass succeeded. Both passes produced 10 valid scores and zero quarantines, so there were 10 complete score pairs and no score/quarantine route flips.

| Metric | Result | Preliminary gate |
|---|---:|---:|
| Complete identical-call pairs | 10 | at least 6 |
| Median score spread | 2.5 | at most 5 |
| 90th-percentile spread | 6.2 | at most 10 |
| Maximum spread | 10.0 | investigate if above 10 |
| Score/quarantine route flips | 0 | at most 25% |
| Raw display-band flips | 2 | reported, not a manager-action gate |

This bounded test passes the preliminary V4.3 operational gate. It is smaller than the historical V4.2 calibration and does not prove that every individual judgment is correct. The dashboard's manager status is based on repeated multi-call evidence, not a single call's adjacent band, and the optional human review below remains the correct feedback loop for challenging rubric judgments.

## V4.2 stability history

The automated stability sample is a V4.2 release gate. It targets 30 Call 1 and 30 Call 2+ transcripts twice under calibration-only scorer versions. Each score is itself a three-review consensus. Calls that cannot pass speaker or evidence validation are excluded rather than converted into scores. The report measures consensus-score spread, raw display-band changes, manager review-signal changes, and rank consistency. Calibration rows are isolated from manager calculations.

## Automated release criteria

The numeric thresholds below were fixed before the final calibration result was reviewed. The original draft used any adjacent display-band change as the action-stability gate. The final report retains that raw measure but uses the operational manager signal (`score < 60`) for the release gate, because crossing an arbitrary 70- or 85-point label boundary does not change whether a rep is surfaced for review.

- At least 16 complete two-consensus-run groups per call type. Missing groups must be explained by safe quarantine rather than silently ignored.
- Median within-call score spread of no more than 5 points and 90th-percentile spread of no more than 10 points for each call type.
- Manager review-signal flips in no more than 15% of complete groups for each call type. Raw display-band flips remain reported for transparency.
- Pairwise rank correlation of at least 0.80 across the complete sample.
- Any single extreme outlier must be investigated even when the aggregate thresholds pass.

If a criterion fails, V4.2 does not become the manager default. The scorer is corrected under a new prompt/config version and calibrated again; the failed sample remains as audit history.

## Final automated result

The final report contained 41 complete repeat pairs: 22 Call 1 and 19 Call 2+. Nineteen other targeted groups were safely incomplete because one or both attempts did not produce an evidence-valid score.

| Metric | Call 1 | Call 2+ | Gate |
|---|---:|---:|---:|
| Complete repeat pairs | 22 | 19 | at least 16 |
| Median spread | 0.0 | 1.9 | at most 5 |
| 90th-percentile spread | 4.4 | 7.5 | at most 10 |
| Manager review-signal flips | 0.0% | 10.5% | at most 15% |
| Raw adjacent display-band flips | 4.5% | 21.1% | reported, not action gate |

Pairwise rank correlation was 0.93 against a minimum of 0.80. The automated release gate passed. The report still records one Call 2+ outlier with a 10.6-point spread and the higher raw adjacent-band flip rate, so managers must use the exact score, evidence count, and call evidence rather than treating a category label as a precise measurement.

The short human exercise below remains optional for the initial Tyler walkthrough. It becomes required before changing rubric weights or band thresholds based on subjective scoring feedback.

Managers should receive the full authorized dashboard after release verification. They can review any rep and provide ordinary feedback on the complete experience. The bounded exercise below is useful only if a later scoring-contract revision needs a consistent comparison sample.

## What to do

1. Open the hidden **Sales rep performance** page.
2. Open two lower-ranked, two middle-ranked, and two higher-ranked reps.
3. From those rep pages, open three lower-scoring and three higher-scoring **Call 1** calls.
4. Repeat for **Call 2+**.
5. For each call, record only:
   - whether the overall label feels fair;
   - whether the quoted evidence really supports the explanation;
   - the one dimension that looks most wrong, if any.

Expected time: approximately 20–30 minutes for 12 calls. Do not re-score every sentence.

## Response template

| # | Call type | Rep | Overall label | Evidence | Most questionable dimension or short note |
|---:|---|---|---|---|---|
| 1 | Call 1 |  | Fair / Too high / Too low | Supported / Weak |  |
| 2 | Call 1 |  | Fair / Too high / Too low | Supported / Weak |  |
| 3 | Call 1 |  | Fair / Too high / Too low | Supported / Weak |  |
| 4 | Call 1 |  | Fair / Too high / Too low | Supported / Weak |  |
| 5 | Call 1 |  | Fair / Too high / Too low | Supported / Weak |  |
| 6 | Call 1 |  | Fair / Too high / Too low | Supported / Weak |  |
| 7 | Call 2+ |  | Fair / Too high / Too low | Supported / Weak |  |
| 8 | Call 2+ |  | Fair / Too high / Too low | Supported / Weak |  |
| 9 | Call 2+ |  | Fair / Too high / Too low | Supported / Weak |  |
| 10 | Call 2+ |  | Fair / Too high / Too low | Supported / Weak |  |
| 11 | Call 2+ |  | Fair / Too high / Too low | Supported / Weak |  |
| 12 | Call 2+ |  | Fair / Too high / Too low | Supported / Weak |  |

## Processing safeguards

- The only scheduled trigger is the adaptive 15-minute coordinator. A lightweight preflight skips a slot successfully whenever an earlier worker lease is still active, so overlapping runs cannot select the same call.
- Each clear slot can admit at most 80 calls in no more than eight batches of 10. This is a ceiling rather than a forced volume: after catch-up, the coordinator dispatches only newly waiting calls. The theoretical maximum is 7,680 calls/day when every 15-minute slot is clear; real throughput is intentionally lower whenever a prior batch is still running.
- Provider and transcript failures retry inside an isolated worker. An active lease is excluded from selection, completed idempotency keys remain skipped, and uncompleted leases become eligible again after expiry. A failed worker cannot stop the coordinator or unrelated worker batches.

## What happens afterward

The responses will be compared by call type and dimension. A scoring-contract change is justified only when the calibration shows a repeatable problem, such as pricing being consistently too harsh or evidence repeatedly failing to support a high band. Any revised scorer must use a new version and preserve the existing rows as audit history.
