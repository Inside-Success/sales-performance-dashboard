# Magic Mike Rep Scoring V7.1

V7.1 is an isolated validation architecture. It does not replace the live V6.3 scorer, publish scores to Magic Mike Coaching, or start a historical backfill.

## Deployed validation workflows

- Structured calibration worker: `QPUh149BvYlqhKOq`
- Focused 30-call launcher: `Y2M5YOqxwuqpg6Hw` (inactive after dispatch)
- Additional 120-call launcher: `AMDHxcR2stfvFixj` (inactive after dispatch)
- Read-only validation audit: `U1qAFJ92IjypX5jv`
- Scorer version: `rep-reviewer-v7.1-shadow-1`

## Atomic additional-250 checkpoint

- One-time coordinator: `aVvWQpt1vuN9ljf4`
- Run key: `v7.1-checkpoint-250-2026-08-13`
- Approved source boundary: calls on or after `2026-08-03T04:00:00.000Z`
- Admission: exactly 250 calls not already finalized or actively leased by V7.1
- Mix: 125 Call 1 and 125 Call 2+, rotated across rep/day groups
- Dispatch: 25 top-level workers of at most 10 calls; 20 in the first wave and 5 after an eight-minute guard

The coordinator acquires a database-backed run lock before reading the source inventory. The same run key cannot admit a second batch after it is marked dispatched. It checks provider balance, existing call leases, exact selection count, unique source IDs, unique idempotency keys, and batch-size invariants before dispatch. It has no schedule and must be deactivated after the one-time checkpoint. V6.3 production and Coaching remain outside this graph.

The manager dashboard uses the same database run-control endpoint but does not expose run mechanics to managers. The operational endpoint is authenticated with the existing ingestion secret and is not a public control surface.

The two launchers are one-time, bounded dispatchers. The worker has no schedule or public webhook and can only be called as a sub-workflow. Existing V6.3 and Coaching workflows are outside this graph.

## What V7.1 changes

- The primary model returns structured criterion facts: requested status, coverage, specificity, material gap, confidence, and exact evidence.
- Deterministic code derives the final criterion status from those facts. The model cannot directly choose the numeric score.
- Criterion anchors are `0 / 20 / 45 / 68 / 84 / 100` for missed, weak, partial, competent, strong, and exceptional execution.
- Ordinary script compliance is competent, not automatically strong. Strong requires complete and specific execution; 100 remains rare and requires exceptional evidence.
- Call 1 and Call 2+ retain separate script-aligned rubrics.
- A fair Call 1 rejection can score well. A Call 2+ sale is evidence about outcome, not an automatic high score.
- Transcript or speaker failures are quarantined instead of becoming rep penalties.
- A short second review remains selective and runs only behind a material-risk gate.

## Manager priority design

Priority remains deterministic and absolute. It never forces a bottom percentile to look bad.

- Evidence sufficiency begins at six valid calls overall and at least three of one call type.
- Needs attention requires a supported absolute trigger: a call-type score below 65 with at least four calls, a repeated below-competent area with at least four observations and two concerns at a 30% rate plus average below 72, or a ten-point decline whose recent score is below 75.
- Routine coaching can be shown separately when the evidence-supported overall score is below 75.
- A cohort-relative coaching signal may be added only after the absolute checks, only with at least six calls, and only when the rep is at least eight points below the supported cohort median.
- Every manager row states the reason, evidence amount, action, and linked calls.

## Validation sequence

1. The focused launch admitted 30 balanced calls across five deliberately concentrated reps. It finalized 28 scores and two fair speaker-resolution exclusions.
2. Only after the focused evidence audit passed, the extension admitted 120 new calls: 60 Call 1 and 60 Call 2+. It excludes completed V7.1 idempotency keys, so the first 30 calls are not repurchased.
3. The combined target is 150 final scores or fair exclusions. No full backfill is attached.

The focused result ranged from 51.3 to 85.4, with a 79.7 median, no score at or above 90, ten calls below 75, and three below 60. Exact evidence supported the low, middle, and high audit calls. One rep produced a genuine repeated manager concern; no rank-based concern was manufactured.

The final isolated cohort contains 155 scored calls and six fair exclusions. Its distribution is 17.0–85.4 with an 80.6 median, 54 calls below 75, 27 below 60, and no score at or above 90. Seven reps have absolute evidence-supported needs-attention signals, one has a routine coaching opportunity, and five have enough evidence without a priority concern.

The first authorized 120-call request dispatched twenty bounded workers of six calls. Two additional launch requests overlapped the launcher's slow reference read before the first run created leases. Per-call idempotency prevented a second 120-call purchase, but the race finalized 11 additional unique calls, so the cohort reached 161 rather than 150. All launchers are inactive. A future backfill must use the prepared database-level run lock and must not reuse this validation launcher.

## Rollback and safety

Production rollback is trivial because no production workflow was edited: keep both V7.1 launchers inactive, leave the worker unattached to schedules, and remove or hide the isolated validation route. Do not promote V7.1 into V6.3 or Coaching without separate explicit approval.
