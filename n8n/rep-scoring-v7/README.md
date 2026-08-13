# Magic Mike Rep Scoring V7.1

V7.1 is an isolated validation architecture. It does not replace the live V6.3 scorer, publish scores to Magic Mike Coaching, or start a historical backfill.

## Deployed validation workflows

- Structured calibration worker: `QPUh149BvYlqhKOq`
- Focused 30-call launcher: `Y2M5YOqxwuqpg6Hw` (inactive after dispatch)
- Additional 120-call launcher: `AMDHxcR2stfvFixj` (inactive after dispatch)
- Read-only validation audit: `U1qAFJ92IjypX5jv`
- Scorer version: `rep-reviewer-v7.1-shadow-1`

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

The 120-call extension was dispatched as twenty bounded workers of six calls. The launcher was deactivated immediately after the one approved dispatch. Final extension statistics belong in `REP-SCORING-V7-1-CALIBRATION-RELEASE-2026-08-13.md`.

## Rollback and safety

Production rollback is trivial because no production workflow was edited: keep both V7.1 launchers inactive, leave the worker unattached to schedules, and remove or hide the isolated validation route. Do not promote V7.1 into V6.3 or Coaching without separate explicit approval.
