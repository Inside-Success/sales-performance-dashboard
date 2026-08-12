# Magic Mike Rep Scoring V7 — Validation Release

Date: 2026-08-13
Status: isolated validation complete; full backfill and Coaching publication not started

## Objective

V7 rebuilds rep scoring around exact transcript evidence, call-specific scripts, prospect opportunity, and the best reasonable outcome. It is designed to identify genuinely weak execution without punishing a rep for an unclosable prospect, an unreliable transcript, or an appropriate rejection.

## What changed

- Call 1 and Call 2+ use separate script-aligned rubrics.
- DeepSeek classifies evidence at temperature 0; deterministic code calculates criterion, dimension, and final scores.
- A sale does not automatically produce a high score, and a no-sale does not automatically produce a low score.
- Every scored criterion must retain exact speaker, timestamp, and quotation evidence.
- Transcript and speaker failures are quarantined rather than counted against the rep.
- Critical controllable misconduct caps the call score at 59.
- A second AI review is selective. It is now limited to material risk, contradiction, transcript limitation, unsupported opportunity classification, or exceptional criteria needing confirmation.
- Rep priority is deterministic and absolute. No bottom percentile is forced to appear weak.
- The isolated manager pages show the reason, evidence amount, action, repeated concerns, strengths, and linked calls without exposing raw JSON.

## Live isolation

- V7 worker: `vjJruLW86C8goG5j`
- 100-call launcher: `ctcEC3Xh0lsIxIQO`
- Optional 50-call extension launcher: `mPrT274OgANkEPol`
- Read-only audit: `FcCLQflWU6uhiZZe`
- Scorer version: `rep-reviewer-v7-shadow-1`

The worker can only be called as a sub-workflow. All launchers and audit workflows are inactive outside a bounded validation operation. V6.3 production scoring and Magic Mike Coaching were not changed.

## 100-call validation result

- Admitted: 100 calls, balanced 50 Call 1 / 50 Call 2+
- Final: 96 scores and 4 fair evidence exclusions
- Scored mix: 47 Call 1 and 49 Call 2+
- Range: 59.0–89.1
- Median: 84.7
- Mean: 82.0
- Below 75: 16
- Below 60: 2
- Exact 100: 0
- At least 90: 0
- Opportunity mix: 67 viable, 22 limited, 7 not currently closable
- Outcomes observed: 29 concrete follow-ups, 4 sales, 3 intentional rejections, 2 losses, 2 deposits, and 56 without a reliably recorded final outcome
- Exclusions: 2 insufficient validated dimensions and 2 unresolved speaker mappings

The two lowest calls were supported by concrete execution gaps rather than outcome alone: arbitrary urgency/dismissal of a time request and missing personalized value. Appropriate rejections remained eligible to score well.

## Evidence and usability gates

- Balanced call coverage: passed
- At least 90 final results: passed
- No high-score inflation to 100: passed
- Low scores exist and are evidence-supported: passed
- Provider or evidence failures are not rep penalties: passed
- Current production workflows unchanged: passed
- Full backfill: intentionally not authorized
- Coaching score publication: intentionally not authorized

## Future aggressive backfill design — not deployed

The approved target is 15–20 top-level scoring executions, with each top-level execution processing up to 10 calls. This means a theoretical admission wave of 150–200 calls, but it is an adaptive ceiling rather than a fixed load.

Before any backfill, the coordinator must reserve capacity below the organization limit of roughly 50 concurrent n8n executions, ramp gradually, reduce concurrency on timeout/rate-limit/crash signals, use immutable idempotency keys and renewable leases, separate live calls from backlog capacity, and stop admission when provider health or balance is unsafe. The target is complete backfill in one to two hours without crowding out unrelated production workflows.

## Rollback

No existing production workflow was replaced. Rollback is therefore to leave the V7 worker and all launchers inactive and remove or hide the isolated validation route. Existing V6.3 scoring and Coaching continue independently.

## Honest release assessment

The 100-call evidence is strong enough to say that V7 is materially fairer, more discriminating, and more auditable than the prior architecture. It is ready for stakeholder review in its isolated validation view. It is not approved for a full backfill or for publishing scores into Magic Mike Coaching until the user gives explicit approval after reviewing the evidence.
