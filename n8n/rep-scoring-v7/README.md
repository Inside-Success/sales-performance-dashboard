# Magic Mike Rep Scoring V7

V7 is an isolated validation architecture. It does not replace the live V6.3 scorer, publish scores to Magic Mike Coaching, or start a historical backfill.

## Deployed validation workflows

- Isolated worker: `vjJruLW86C8goG5j`
- One-time 100-call launcher: `ctcEC3Xh0lsIxIQO`
- Optional one-time 50-call extension launcher: `mPrT274OgANkEPol`
- Read-only validation audit: `FcCLQflWU6uhiZZe`
- Scorer version: `rep-reviewer-v7-shadow-1`

The launcher is inactive except during an explicitly approved bounded validation dispatch. The worker has no schedule or public webhook and can only be called as a sub-workflow.

## Scoring design

- One primary DeepSeek assessment per call at temperature 0.
- Code calculates criterion, dimension, and composite scores.
- A selective verifier runs only for material risk, contradictions, transcript limitations, unsupported opportunity classifications, or an exceptional criterion that needs confirmation. Strong ordinary calls are not double-reviewed merely for scoring well.
- Every scored criterion must be supported by exact speaker, timestamp, and transcript quotation evidence.
- Call 1 measures fit discovery and the correctness of the progression decision. A fair rejection can score well.
- Call 2+ measures commercial execution and outcome quality. A sale alone is not proof of strong execution, and a no-sale alone is not proof of poor execution.
- Transcript or identity failures are excluded instead of being turned into rep-performance penalties.

## Manager priority design

Manager priority is deterministic and absolute; it never forces a bottom percentile to look bad. A rep needs enough evidence and at least one supported trigger:

- a call-type robust score below 60 with at least five valid calls;
- a repeated below-competent criterion supported by at least five observations, three occurrences, a 35% rate, and average below 65; or
- a comparable three-call versus three-call decline of at least 12 points with the recent period below 65.

The rep page explains the reason, evidence amount, suggested manager action, repeated concerns, strengths, and linked calls. The call page hides raw JSON and empty technical sections.

## Validation gate

The completed validation admitted exactly 100 stratified calls: 50 Call 1 and 50 Call 2+. It produced 96 evidence-supported scores and four fair evidence exclusions. The scored distribution was 59.0–89.1 with an 84.7 median, no exact 100s, 16 calls below 75, and two calls below 60. Full backfill and Coaching publication remain blocked until the user explicitly approves them.

The optional extension launcher and the audit workflow are inactive. They have no schedule. The extension exists only to test the narrower selective-review gate and concentrated rep-level evidence if another bounded sample is genuinely needed.

## Future backfill design (not deployed)

The approved speed target is 15–20 top-level scoring executions, each processing up to 10 calls. This is a ceiling, not a blind fixed load. The future coordinator must:

- reserve capacity below the organization limit of roughly 50 concurrent executions;
- ramp up gradually and reduce concurrency on latency, timeout, rate-limit, or crash signals;
- use immutable idempotency keys and renewable leases so retries cannot double-score or double-charge calls;
- keep a bounded retry queue with backoff and a circuit breaker;
- keep new live calls separate from historical backlog capacity;
- stop admission when provider balance or health is unsafe;
- expose progress based only on final scores and non-retryable evidence exclusions.

No future backfill coordinator is active in V7.
