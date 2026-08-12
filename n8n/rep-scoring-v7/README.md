# Magic Mike Rep Scoring V7

V7 is an isolated validation architecture. It does not replace the live V6.3 scorer, publish scores to Magic Mike Coaching, or start a historical backfill.

## Deployed validation workflows

- Isolated worker: `vjJruLW86C8goG5j`
- One-time 100-call launcher: `ctcEC3Xh0lsIxIQO`
- Optional one-time 50-call extension launcher: `mPrT274OgANkEPol`
- Read-only validation audit: `FcCLQflWU6uhiZZe`
- Adaptive admission controller: `xtJzNO93c0Tckv2W` (inactive and decision-only)
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

The completed validation admitted exactly 150 calls. It produced 140 evidence-supported scores and ten fair evidence exclusions, with 69 scored Call 1 and 71 scored Call 2+ results. The scored distribution was 59.0–89.1 with an 84.7 median, no score at or above 90, 23 calls below 75, and two calls below 60. Full backfill and Coaching publication remain blocked until the user explicitly approves them.

Both launchers, the audit workflow, and the admission controller are inactive. They have no schedule. The narrower selective-review gate used a second model call for 7 of 44 extension scores (15.9%).

## Future backfill design (safe control plane prepared; dispatch not deployed)

The approved speed target is 15–20 top-level scoring executions, each processing up to 10 calls. This is a ceiling, not a blind fixed load. The future coordinator must:

- reserve capacity below the organization limit of roughly 50 concurrent executions;
- ramp up gradually and reduce concurrency on latency, timeout, rate-limit, or crash signals;
- use immutable idempotency keys and renewable leases so retries cannot double-score or double-charge calls;
- keep a bounded retry queue with backoff and a circuit breaker;
- keep new live calls separate from historical backlog capacity;
- stop admission when provider balance or health is unsafe;
- expose progress based only on final scores and non-retryable evidence exclusions.

`adaptive-admission-controller.js` contains the tested admission policy. `backfill-control-plane.sql` defines the un-applied Postgres control plane for atomic `SKIP LOCKED` leases, immutable scorer-version keys, lease-token settlement, bounded retries, fair exclusions, and dead-letter state. The deterministic application policy is covered by `v7-adaptive-backfill.test.ts` and `v7-backfill-safety.test.ts`.

No future backfill coordinator or dispatcher is active in V7, and the control-plane migration has not been applied. Activation and the complete backfill both require explicit approval.
