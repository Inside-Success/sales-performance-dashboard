# Ask Sales V5.7 Development Replay — Manual Source Audit

Date: 2026-07-27

Runtime artifact: `current-30-runtime-r3.json`

Status: development evidence only; not promotion evidence

## What this replay establishes

- All 30 prompts completed with the configured DeepSeek provider and model.
- Provider execution was clean: 58 successful attempts, zero failed attempts, zero terminal failures.
- V5.7 returned 26 answers, one answer-plus-route, and three intentional action routes.
- Manual review found no material policy error or wrong action owner in the final R3 output.
- The previously failing exact-source cases now answer from the correct source relationship: pre-call price disclosure, minor participation with a guardian, license-document usage, legal-dispensary eligibility, pre-Call-2 contract review, no-business qualification, payment-plan filming, STOP contact boundaries, STOP back-end procedure, and next-day discount expiration.
- Live or mutating work remained routed: Finance changes, locating a specific signed contract, and Slack channel-access changes.

This is meaningful development evidence, but it cannot be used as a production-promotion result because these prompts were inspected while V5.7 was being corrected.

## Corrected gold defect

The sealed V5.6 gold answer for `v56unseen-conv-03-turn-2` says a Friday Call 1 requires Call 2 on Saturday or Sunday. The frozen knowledge contains a later controlling answer from Rich Allen stating weekend work is optional and Call 2 may be scheduled for Monday. V5.7 returned the later Rich rule. The runtime answer is correct; the old gold label is defective and must not be counted against V5.7.

## Manual disposition audit

| Result | Count | Assessment |
|---|---:|---|
| Answer | 26 | Materially supported by the selected source after the corrected Rich-authority label is applied. |
| Partial | 1 | Correctly explains that missing Keap data does not prove opt-out, then routes the live record check to Sales Tech. |
| Route | 3 | Correct action boundaries for Finance, Fulfillment, and Slack access/Sales Ops. |

## Remaining non-material quality issues

- Some exact source decisions still expose mechanical `Conditions` or `Boundaries` phrasing. The facts are correct, but the prose can be smoother.
- The legal-dispensary answer adds a conservative Green Light next step after giving the general policy answer.
- The Slack-access route is safe and uses the correct channel, but could state more directly that the passive chatbot cannot grant access.
- The Next Level CEO contract answer uses the Slack channel ID because that is what the frozen record contains; the front end should render the Slack mention normally.

These are presentation/helpfulness issues, not evidence-selection or owner-routing failures. They remain relevant to blind human preference review.

## Gate decision

V5.7 is eligible to be frozen for a new untouched evaluation. It is not yet approved for production. A new promotion recommendation requires:

1. a preregistered, high-quality, non-overlapping Slack set selected without using runtime outcomes;
2. gold labels checked against the complete frozen authority state, not only the source thread;
3. paired V3 and V5.7 provider-parity execution;
4. repeatability checks;
5. manual source audit plus blinded human review; and
6. zero material policy errors and zero wrong action owners.
