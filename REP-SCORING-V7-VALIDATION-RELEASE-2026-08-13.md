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
- Adaptive admission controller: `xtJzNO93c0Tckv2W` (inactive; decision-only; no dispatcher)
- Scorer version: `rep-reviewer-v7-shadow-1`
- Draft PR: `https://github.com/Inside-Success/sales-performance-dashboard/pull/159`
- Isolated Vercel preview: `https://sales-performance-dashboard-8yomm4g0x-admin-88375990s-projects.vercel.app/manager/rep-scoring/v7-validation`

The worker can only be called as a sub-workflow. All launchers and audit workflows are inactive outside a bounded validation operation. V6.3 production scoring and Magic Mike Coaching were not changed.

The Vercel preview completed its remote production build and reached `READY`. An unauthenticated request to the hidden route returns the expected `307` redirect to `/sign-in` with the original callback URL and `noindex`; no production deployment was promoted.

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

## 50-call extension and combined result

The optional extension was run only after the first 100-call result passed its safety and quality gates. It admitted 50 additional calls, producing 44 scores and 6 fair exclusions.

- Extension mix: 22 Call 1 and 22 Call 2+
- Extension range: 62.9–88.0
- Extension median: 84.6
- Extension mean: 82.3
- Extension below 75: 7
- Extension exact 100 or at least 90: 0
- Extension selective second reviews: 7 of 44 (15.9%)
- Extension exclusions: 4 unresolved speaker mappings, 1 multi-rep ambiguity, and 1 insufficient-dimension result

Combined across the full 150-call validation:

- Final: 140 scores and 10 fair exclusions
- Scored mix: 69 Call 1 and 71 Call 2+
- Range: 59.0–89.1
- Median: 84.7
- Mean: 82.1
- Below 75: 23
- Below 60: 2
- Exact 100 or at least 90: 0

The 50-call extension is the valid cost signal for the revised selective-review gate. The original 100 calls used the earlier, broader review gate and therefore must not be used to estimate steady-state second-review cost.

## Evidence and usability gates

- Balanced call coverage: passed (69 Call 1 and 71 Call 2+ scored)
- All 150 admitted calls reached a final scored or fair-exclusion state: passed
- No high-score inflation to 100: passed
- Low scores exist and are evidence-supported: passed
- Provider or evidence failures are not rep penalties: passed
- Current production workflows unchanged: passed
- Full backfill: intentionally not authorized
- Coaching score publication: intentionally not authorized

## Future aggressive backfill design — controller deployed inactive, dispatch not deployed

The approved target is 15–20 top-level scoring executions, with each top-level execution processing up to 10 calls. This means a theoretical admission wave of 150–200 calls, but it is an adaptive ceiling rather than a fixed load.

The decision-only admission controller implements the approved load model without starting work. It begins at 15 top-level executions, increases by two on a healthy observation window up to 20, and allows at most 10 calls per execution. It reserves 30 of the approximate 50 organization execution slots, refills only free V7 slots, halves the target on timeout, rate-limit, material failure-rate, or stale-lease evidence, and opens the circuit when provider health or balance is unsafe.

Three live, bounded controller probes passed before its temporary webhook was removed: a healthy snapshot selected 17 executions / 170 calls; a timeout snapshot backed off to 10 executions / 100 calls; and an unavailable-balance snapshot admitted zero work. The controller is inactive, has no dispatch node, and cannot start a backfill by itself.

Before an approved backfill, the final coordinator must add immutable idempotency keys, renewable leases, live-call capacity separation, bounded retries, and authoritative active-execution/provider-health inputs. It must also remove the validation launcher's inefficient full V6.3 reference-score scan: that scan read about 145,824 Airtable rows and delayed the extension launcher by roughly 703 seconds even though it was unnecessary to V7 scoring. The full-backfill target remains one to two hours, but speed cannot override organization capacity or safety backpressure.

## Rollback

No existing production workflow was replaced. Rollback is therefore to leave the V7 worker and all launchers inactive and remove or hide the isolated validation route. Existing V6.3 scoring and Coaching continue independently.

## Honest release assessment

The 150-call evidence is strong enough to say that V7 is materially fairer, more discriminating, more cost-controlled, and more auditable than the prior architecture. The score distribution is not top-capped, low calls exist with concrete evidence, and ordinary extension calls used only one model request in 84.1% of cases.

Three reps had enough repeated-call evidence for aggregation in this bounded sample; none met the absolute repeated-concern threshold. That is an honest result rather than a manufactured bottom group. The manager-priority logic is covered deterministically by tests, but a positive real rep-priority example was not present in this sample and should be rechecked during an explicitly approved broader backfill.

Recommendation: **GO for an explicitly approved, monitored full backfill using the adaptive architecture; GO for isolated stakeholder review now; NO-GO for production cutover or Coaching score publication until the backfill is reviewed and separately approved.**
