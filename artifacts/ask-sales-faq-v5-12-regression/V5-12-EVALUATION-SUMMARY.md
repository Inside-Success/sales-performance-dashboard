# Ask Sales V5.12 evaluation summary

Date: 2026-07-27

## Scope and safety

- V5.12 remains isolated. The production selector was not changed and V3 remains live.
- Slack access was read-only. No Slack message, draft, reaction, file, channel, or reminder was created or changed.
- The production knowledge database and approval queue were not mutated.
- The runtime uses the existing DeepSeek provider. No service or subscription was added.

## Implemented controls

- Exact approved decision text is preserved after the raw question-to-record entailment gate, preventing a correct selected source from being changed into a materially different answer.
- Bare polarity-dependent `Yes` or `No` source replies cannot be copied without their complete normalized decision.
- Passive knowledge questions are not routed merely because a related candidate names an operational owner.
- Explicit live actions still route to the appropriate owner.
- A versioned, candidate-only reviewed Slack delta adds narrow source-cited decisions that were absent or incomplete in the inherited snapshot. Each rule requires its material object, relationship, and distinguishing condition.
- Negative controls keep the six-month missed-payment/cohort-close exception from replacing Rich's general three-month reapplication rule, keep the nurse subcategory rule from becoming blanket nurse eligibility, and keep the company-CRM rule from hijacking Keap lead ownership.

## Model-backed results

### High-quality Slack source gate (15 prompts)

- V3: 3 answers and 12 routes.
- Frozen pre-delta V5.12: 11 answers, 1 partial, and 3 routes; all three newest source-disjoint rules failed because they were absent from the candidate snapshot.
- Final V5.12: 15 answers, 0 routes, 0 provider failures.
- Manual source-by-source review found all 15 final answers materially consistent with the sealed Slack gold. This is development/regression evidence after the knowledge delta, not untouched promotion evidence.

### Retained V5.11 gate (24 prompts)

- Final V5.12: 23 answers and 1 correct route, with 24/24 provider-backed outputs and 0 provider failures.
- A broad CRM activation initially regressed one Keap lead-owner answer. The gate caught it; the activation was narrowed and the full retained run was repeated successfully.

### Repeatability

- 3 runs x 12 prompts = 36 executions.
- Lane flips: 0/24 comparisons.
- Decision-boundary flips: 0/24.
- Selected-source flips: 0/24.
- Exact-answer flips: 0/24.

## Honest release position

V5.12 is materially stronger than the frozen pre-delta candidate and substantially more helpful than V3 on this source-backed gate. The evidence supports an owner-approved isolated preview or tightly monitored canary. It does not support an automatic full production replacement: the newest rules became development evidence once used to repair the candidate, and the governed refresh/publish workflow must compile future approved decisions into the candidate knowledge snapshot so this drift does not recur.
