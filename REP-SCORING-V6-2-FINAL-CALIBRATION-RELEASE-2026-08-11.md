# Rep Scoring V6.2 Final Calibration Release — 2026-08-11

## Scope and safety boundary

V6.2 is an isolated final calibration candidate for the exact same six Call 1 and six Call 2 recordings used in V6/V6.1. It does not replace the current manager view, alter Magic Mike Coaching, publish scores to reps, start a historical backfill, add a schedule, write to source calls, or write to Slack or Google. V6.1 and V6 remain preserved rollback and audit paths.

## Why V6.2 exists

V6.1 used two complete AI judgments for every call. That doubled ordinary model use and still allowed two reviewers to disagree about facts. V6.2 changes the responsibility boundary:

1. One primary AI assessment identifies evidence-backed criterion statuses and decision facts.
2. Deterministic code calculates every dimension and overall score.
3. Deterministic code maps Call 1 opportunity classification to disposition and Call 2 transaction/follow-up facts to outcome.
4. A short second verification runs only for a material gate: a critical finding, harmful criterion, material pressure risk, partially gradeable transcript, contradictory outcome facts, or uncertain Call 1 progression.
5. The verifier reviews only the gated facts and risks. It does not perform another full assessment and never emits a score.
6. A corroborated critical finding caps the call score at 69 so the manager-facing score cannot contradict a demonstrated material concern.
7. Syntax-only JSON repair remains conditional and does not change judgments.

The expected steady-state cost is therefore one primary request per call plus a smaller verifier request only for exceptions, instead of two full reviewers for every call.

## Isolated n8n workflows

### V6.2 worker

- ID: `SGxQ1oqXP4Lg1HbR`
- Name: `MM Rep Scoring V6.2 - Single Primary + Selective Verification Worker (NO BACKFILL)`
- Trigger: Execute Workflow Trigger only
- Schedule/webhook: none
- Scorer version: `rep-reviewer-v6.2-calibration-final-1`
- Model temperature: `0`
- Storage: immutable rows in isolated Airtable base `appEQQkTlJnc7tJgi`
- Source Google Docs: read-only
- Validation: runtime-valid with zero errors; advisory warnings are inherited Code-node and branch-shape warnings reviewed against the live graph

### One-time exact-12 launcher

- ID: `NGLzffN4TyYGVKXS`
- Name: `MM Rep Scoring V6.2 - One-Time Exact 12 Final Calibration Launcher`
- Dispatch: two bounded sub-workflow calls, one six-call Call 1 batch and one six-call Call 2 batch
- Expected output: exactly 12 immutable assessments
- Current state after dispatch: inactive
- Schedule/backfill: none

## Dashboard

Hidden admin route: `/manager/rep-scoring/v6-2-calibration`

The page shows the exact 12 calls once, the deterministic score and decision, whether the selective verifier was invoked, exact criterion evidence, and the resulting request mix. The existing exact-email rep-scoring admin gate protects both the overview and call-detail routes.

## Verification performed before dispatch

- Worker runtime validation: valid, 31 enabled nodes, 38 valid connections, zero invalid connections, zero errors.
- Launcher runtime validation: valid, 7 enabled nodes, 6 valid connections, zero invalid connections, zero errors.
- One-time launch response: two worker dispatches, 12 expected source calls, 12 expected assessments.
- Launcher was deactivated immediately after dispatch.
- Focused rep-scoring tests: 7 passed.
- ESLint: passed with zero warnings.
- Production Next.js build: passed, including both V6.2 hidden routes.

## Completed exact-12 result

- 12 of 12 immutable assessments completed successfully.
- 6 Call 1 and 6 Call 2 results were created.
- 0 calls were quarantined.
- The selective verifier ran on 3 of 12 calls; 9 calls used only the primary assessment.
- Score range: 60.0–98.0.
- One corroborated critical concern was retained. Its raw 80.2 score was deterministically capped at 69.0 so the displayed score and demonstrated material concern do not contradict each other.
- The Call 2 outcomes include sale, concrete follow-up, lost, and unknown; they are derived from validated decision facts.
- The two bounded worker executions both completed successfully.

One internal `Model Params Hash` label inherited the `v6.1` prefix in this isolated 12-row run even though the value already described the V6.2 selective-verifier architecture. The active V6.2 worker was corrected to use the `v6.2` prefix for any future authorized run. This metadata label did not participate in prompts, scoring, outcomes, routing, or the dashboard query.

## Approval boundary

The 12-call output is still calibration evidence, not authorization for backfill or Coaching publication. A broader run requires a separate explicit decision after the completed results and selective-review rate are inspected.

## Rollback

Deactivate worker `SGxQ1oqXP4Lg1HbR` and revert the V6.2 dashboard commit. This does not modify or delete V5, V6, or V6.1 rows and does not touch Coaching or source calls.
