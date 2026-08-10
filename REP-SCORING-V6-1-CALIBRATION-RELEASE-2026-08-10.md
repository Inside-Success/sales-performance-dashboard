# Rep Scoring V6.1 Calibration Release — 2026-08-10

## Purpose

V6.1 is an isolated correction to the V6 calibration candidate. It does not replace V5, alter the production Coaching workflow, publish scores to reps, start a backfill, write to source calls, or access Slack. The original V6 workflows, 24 score rows, and review route remain preserved as rollback and audit evidence.

## What changed

- Scoring is now criteria-first. DeepSeek classifies observable, script-derived criteria; deterministic code calculates each dimension and the composite score.
- Call 1 criteria reward the correct progression decision, including a fair decline when the prospect is not a suitable fit.
- Call 2 separates execution from outcome and derives sale, deposit, or concrete follow-up from verified facts.
- A concrete follow-up requires either an agreed date/time or a specific agreed action with an owner and deadline.
- Contract, payment, and onboarding criteria are not penalized before the prospect reaches an agreement, deposit, or immediate transaction path.
- Truthful and relevant urgency is not harmful by itself. Arbitrary scarcity, unsupported claims, dismissing a reasonable request for time, or continuing after a clear refusal require direct evidence.
- A critical finding is stored only when a defined risk, exact rep evidence, and demonstrated material impact or prospect reaction all validate.
- Every call receives a complete second criterion judgment. Deterministic consensus retains agreement, turns ordinary disagreement into a neutral partial result, and requires corroboration before harmful or critical treatment. Neither model emits a numeric score.
- Transcript defects, lead quality, prospect difficulty, and other external factors remain excluded from rep penalties.

## First-run correction preserved

The initial V6.1 attempt correctly exposed a coverage threshold that was too strict. A valid Call 2 was quarantined because two dimensions had only 30–35% observable criterion coverage even though the overall call was gradeable and later transaction stages were not reached. The failed attempt was retained in the isolated audit tables.

The threshold-corrected `r1a/r2a` attempt then exposed a second defect: independent primary judgments still alternated between missed and partial/met on the same criteria, producing early 17–21 point pair differences. Those rows are also retained as failed calibration evidence and are not shown as the final candidate.

The final immutable rerun uses scorer versions `rep-reviewer-v6.1-calibration-r1b` and `rep-reviewer-v6.1-calibration-r2b`. A dimension can be calculated when at least 30% of its criterion weight has exact validated evidence; the whole call still requires at least three dimensions and 35% of total call weight. Missing evidence is excluded rather than converted into a low score. Every final call also requires a complete second criterion judgment; an unavailable or incomplete second judgment fails closed.

## n8n release

### Worker

- ID: `bQGUZ6OgUm8i9j3e`
- Name: `MM Rep Scoring V6.1 - Criteria-First Calibration Worker (NO BACKFILL)`
- Trigger: Execute Workflow Trigger only
- Source transcript access: Google Docs read-only
- Storage: immutable V6.1 rows in isolated Airtable base `appEQQkTlJnc7tJgi`
- DeepSeek credential: the dedicated Syed-owned rep reviewer credential already used by V6
- Schedule/webhook: none

### One-time launcher

- ID: `xqyodtCtVuzJ7RAM`
- Name: `MM Rep Scoring V6.1 - One-Time Exact 12 Double Calibration Launcher`
- Selection: hard-pinned to the exact six Call 1 and six Call 2 source records reviewed in V6
- Dispatch: four bounded workers, each processing six calls sequentially
- Balance gate: fails closed before dispatch if DeepSeek is unavailable or below the configured floor
- External state after dispatch: inactive

## Dashboard release

Hidden route: `/manager/rep-scoring/v6-1-calibration`

The existing exact-email rep-scoring administrator gate protects the route. It reads only the two final V6.1 scorer versions and shows:

- the two independent scores and bands;
- outcome and critical-finding agreement;
- an action-stability result that combines score, outcome, and critical status;
- every script-derived criterion, its status, weight, explanation, and exact evidence;
- two-judgment consensus provenance and evidence-validation exclusions;
- explicit statements that backfill and Coaching score release have not started.

## Approval gate

Before any one-week backfill:

1. All 12 outcomes/dispositions must agree across both rounds.
2. All 12 critical-finding decisions must agree across both rounds.
3. At least 11 of 12 calls must retain the same manager action/band with a score delta no greater than 10 points.
4. Any larger difference must have a clear evidence-based explanation and a rubric correction before release.
5. The owner must review the 12 calls and explicitly approve the architecture.

## Final calibration evidence

The `r1b/r2b` bounded rerun completed with 24 immutable scores and zero quarantines. Launcher execution `469301` dispatched worker executions `469305`, `469306`, `469307`, and `469308`; all five executions finished successfully. The first completed pair still crossed a score band with a 15.2-point difference, so `r1b/r2b` is retained as failed calibration evidence rather than approved for backfill. The final consistency correction and its verified metrics will be recorded here before handoff.

## Rollback

V5 remains the live manager scoring view. V6 remains the immediate preserved calibration baseline. Deactivating worker `bQGUZ6OgUm8i9j3e` and reverting the V6.1 dashboard deployment removes the candidate without modifying any V5/V6 rows, Coaching data, source calls, Slack, or Google content.
