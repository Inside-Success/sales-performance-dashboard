# Rep Scoring Optional Calibration

This is an optional scoring-quality exercise. It is not a gate for showing Tyler or other managers the complete manager system, and it does not change production data.

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
- The catch-up ceiling is 200 calls per hour in batches of at most 10. This is a ceiling rather than a forced volume: after catch-up, the coordinator dispatches only newly waiting calls.
- Provider and transcript failures retry inside an isolated worker. Coordinator leases last four hours while batches wait for worker capacity; an active worker refreshes each call to a one-hour lease. A failed worker cannot stop the coordinator or unrelated worker batches; uncompleted leases become eligible again after expiry.

## What happens afterward

The responses will be compared by call type and dimension. A scoring-contract change is justified only when the calibration shows a repeatable problem, such as pricing being consistently too harsh or evidence repeatedly failing to support a high band. Any revised scorer must use a new version and preserve the existing rows as audit history.
