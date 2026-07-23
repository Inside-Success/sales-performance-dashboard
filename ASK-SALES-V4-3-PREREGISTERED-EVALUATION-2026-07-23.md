# Ask Sales V4.3 Preregistered Implementation And Evaluation

Date: 2026-07-23

Status: **registered before V4.3 runtime implementation.**

## Objective

Build a new isolated candidate that improves unseen-question usefulness without weakening source fidelity. The candidate must address five systemic failure classes exposed by V4.2:

1. missing or stale authoritative Slack knowledge, including late replies;
2. selection of a related source instead of the exact decision being asked;
3. wrong Finance, Greenlight, Sales Tech, Fulfillment, or Sales Questions ownership;
4. unsupported high-impact payment, deadline, contract, eligibility, and compliance claims; and
5. mechanical user-facing route language such as `Unresolved` or `Determine whether`.

## Isolation Boundary

- Candidate branch: `agent/ask-sales-v4-3-knowledge-routing-2026-07-23`
- Base commit: `283ce474bda95df84356c13c0c6c05f50a88c098`
- V3 production, its selector, API, page, database, Neon state, authentication, Slack, n8n, Google integrations, feedback, and conversation persistence are out of scope and must remain unchanged.
- Slack access is read-only. No message, reply, reaction, file, channel, canvas, or profile write is permitted.
- No local development server may be started.
- No merge, production deployment, alias change, knowledge publication, or cutover is authorized.
- Generated evaluation artifacts containing internal questions or answers remain local and untracked.

## Authority Rule

For the same sales-policy decision and scope, Rich Allen, Head of Sales, has precedence over Madeline Cary, Sales Ops, regardless of source recency. A later Madeline answer cannot supersede a conflicting Rich decision. Only a later applicable Rich decision may replace it.

This precedence is claim-scoped: it must not make a Rich answer control a different product, stage, action, object, or condition. Other named authoritative sources remain eligible under the existing authority and exact-decision gates.

The current main-ISTV reapplication minimum is therefore three months, based on Rich's explicit decision. Related exception scenarios must remain separate from the normal waiting-period rule.

## User Review As Development Evidence

The user's review of all 50 V4.2 comparison cases is a required development input. It establishes these product requirements:

- prefer a direct, confident answer when exact authoritative knowledge exists;
- preserve useful context and approved public-resource boundaries;
- allow safe abstention for genuinely complex, live, artifact, or insufficient-context requests;
- route actions to the exact owning channel;
- never expose internal planner wording in the final UI; and
- judge naturalness, usefulness, factual correctness, and route correctness separately.

The reviewed 50 cases may be used to diagnose general failure classes and run regression checks. They must not be used as promotion evidence. Runtime code must not contain their IDs, exact benchmark questions, or one-off answer overrides.

Any correction to the 50-case record is data hygiene, not a promotion-set rewrite. Preference labels, authoritative correctness, and action-routing expectations must remain separate fields.

## Permitted Implementation Work

1. A governed current-authority supplement compiled from read-only Slack threads with exact source, speaker, role, timestamp, scope, conditions, and late-reply state.
2. Deterministic claim-scoped authority precedence, including Rich-over-Madeline conflicts.
3. Retrieval and validation changes that require compatible decision object, relation, scope, lifecycle, conditions, and requested action.
4. Original-request-first route ownership for live actions and controlled artifacts.
5. A high-impact contradiction gate that fails closed when selected sources disagree or omit a material condition.
6. Natural, concise answer and route composition that never exposes internal need/planner text.
7. Paraphrased systemic tests and development replay; no benchmark-specific runtime branches.

## Freeze Protocol

Before any new evaluation set is selected or inspected:

1. implementation and deterministic tests must be complete;
2. the reviewed 50, retained 78, and prior V4/V4.1/V4.2 sets are development evidence only;
3. full tests, isolation, TypeScript, lint, and build must pass;
4. the candidate runtime commit and tree must be recorded; and
5. no runtime or tracked knowledge change may be made after the new set is opened.

If new evidence reveals a failure, the frozen candidate fails. The evaluation set cannot be used to patch that candidate.

## New Unseen Evaluation

After freeze, select a target of 40 and a minimum of 30 sanitized questions from current Slack threads not used in any prior evaluation or development fixture. Include answerable, route/live/action, controlled-artifact, follow-up/context, and natural conversational strata. Every answerable case must have an exact authoritative reply. Every route case must have either an explicit authoritative owner or a deterministic ownership rule; it must not be presented as source-answered gold.

Run production V3, frozen V4.1, and frozen V4.3 under the same provider conditions. V4.2 is retained as development history but is not the promotion baseline.

Evaluation must report separately:

- fully correct and materially correct partial answers;
- false abstentions;
- unsupported or contradictory claims;
- correct and incorrect route owners;
- answer completeness and condition preservation;
- naturalness and directness;
- follow-up/context preservation;
- provider failures, fallbacks, and latency; and
- two-pass blind-judge output used only for triage, followed by source review of every case.

## Release Gate

V4.3 is not eligible to replace V3 unless fresh evidence shows a meaningful practical gain over both V3 and V4.1, no material high-impact unsupported answer, exact live-action routing, no regression that offsets the usefulness gain, and explicit stakeholder approval. No percentage alone authorizes promotion.
