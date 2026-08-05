# Rep Scoring Calibration

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

- The only scheduled trigger is the hourly coordinator. It leases calls before releasing bounded background worker batches, preventing overlapping hourly runs from selecting the same call.
- The catch-up ceiling is 160 calls per hour in no more than eight batches of at most 20. This is a ceiling rather than a forced volume: after catch-up, the coordinator dispatches only newly waiting calls. It provides 3,840 calls/day of theoretical headroom against the 1,000-call/day operating target.
- Provider and transcript failures retry inside an isolated worker. An active lease is excluded from selection, completed idempotency keys remain skipped, and uncompleted leases become eligible again after expiry. A failed worker cannot stop the coordinator or unrelated worker batches.

## What happens afterward

The responses will be compared by call type and dimension. A scoring-contract change is justified only when the calibration shows a repeatable problem, such as pricing being consistently too harsh or evidence repeatedly failing to support a high band. Any revised scorer must use a new version and preserve the existing rows as audit history.
