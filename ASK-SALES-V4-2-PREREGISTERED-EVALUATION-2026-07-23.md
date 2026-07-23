# Ask Sales V4.2 Preregistered Evaluation

Date: 2026-07-23

Status: **preregistered before V4.2 runtime implementation.**

## Isolation boundary

- Candidate branch: `agent/ask-sales-v4-2-systemic-2026-07-23`
- Base commit: `d90ea5decdd2ff3afe93bf65e83b3056c3d9f8da`
- V3 production, the production selector, API, page, database, Neon, Slack, n8n, Google integrations, feedback, and conversation persistence are out of scope and must remain unchanged.
- No local development server may be started.
- No deployment, merge, production cutover, Slack write, or n8n write is authorized.
- Generated evaluation artifacts may contain internal questions and answers and must remain local and untracked.

## Development evidence

The revealed V4.1 replacement set may be used only to identify general failure classes. It is development evidence from this point forward and cannot support V4.2 promotion.

Permitted systemic targets are:

1. object and measurement identity;
2. artifact kind and lifecycle identity;
3. request-kind-first route ownership, including compound needs;
4. exact-answer recall behind the existing authority, condition, scope, conflict, and temporal gates;
5. atomic-need completeness; and
6. natural conversation and follow-up behavior.

Question IDs, exact benchmark sentences, or one-off answer overrides must not be added to runtime code.

## Freeze protocol

Before the new holdout is generated or inspected:

1. all runtime and deterministic tests must be complete;
2. retained and previously revealed evaluation suites may be used as regression diagnostics only;
3. the candidate runtime commit and tree must be recorded;
4. the new holdout builder must be finalized; and
5. no further runtime change may be made after the new holdout is opened. If the holdout exposes a problem, this V4.2 candidate fails and the issue is deferred to a separately frozen future candidate.

## Untouched replacement set

The V4.2 holdout must be sampled from the source-derived sealed corpus with a new fixed salt and must exclude every question used by:

- the original V4 60-case sealed evaluation;
- both invalidated V4.1 sets;
- the valid V4.1 50-case replacement set; and
- any V4.2 development fixture added before freeze.

Selection must be deterministic and stratified across answerable and route/live/artifact needs. The builder must fail closed if the remaining source pool cannot satisfy its registered quotas. The selected questions and gold must remain unseen until after the runtime freeze.

## Evaluation and release gate

V3, frozen V4.1, and frozen V4.2 must be run on the same untouched set with the same provider conditions. Evaluation must include:

- completion and provider-failure counts;
- answer, partial, clarify, artifact, and route lanes;
- atomic-need correctness and completeness;
- unsupported or materially misleading claims;
- false abstentions and wrong route owners;
- relationship, object, artifact-lifecycle, and condition errors;
- follow-up/context behavior where the source set permits it;
- a two-pass model judge used only for triage; and
- manual review of every case, every selected source, and every material judge disagreement.

V4.2 is not eligible to replace V3 unless the untouched evidence shows a meaningful practical improvement over both V3 and V4.1, no material unsafe policy answer, correct routing for live/action needs, and no regression large enough to offset its safety or usefulness gain. A percentage alone is not a promotion rule. Independent blind stakeholder or SME approval remains required before any production cutover.

