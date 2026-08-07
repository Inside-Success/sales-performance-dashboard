# Rep Scoring V5 Fairness-First Calibration Release

Date: August 8, 2026

## Goal

V5 rebuilds the call reviewer around fairness and the real Call 1 / Call 2 scripts without replacing the current manager system before human calibration. It fixes the verified architectural problems in V4: technical or incomplete transcripts could become low scores; prospect difficulty and closability were not separately visible; Call 1 over-rewarded progression and could punish a correct rejection; generic dimensions did not match the operating scripts; and negative findings could be produced without enough contextual control.

## Release boundary

- V4.3 production coordinator `dSULjXP2oh1kXeRb` and worker `KncPcmxT0xDQcEds` were not edited.
- V4.4 remains the current manager view and rollback reference.
- V5 worker `Ypg69KeD1401mNDg` and one-time launcher `PFmOzEFTgOl2R4Qy` are separate and inactive after calibration.
- Neither V5 workflow has a schedule. No V5 full backfill was started.
- Source Airtable calls and Google transcripts are read-only. V5 writes only versioned rows to the isolated base `appEQQkTlJnc7tJgi`.
- Slack, Coaching, Ask Sales, and Google content were not changed.

## V5 scoring contract

The reviewer follows this order:

1. Decide whether the transcript is gradeable, partially gradeable, or not gradeable. Technical, truncation, attribution, and prerecorded-content limitations are explicit and cannot silently lower the rep's score.
2. Classify the prospect opportunity as viable, limited, not currently closable, or unknown. This affects interpretation and applicability, never the arithmetic score.
3. Evaluate only fairly observable, rep-controlled, script-aligned checkpoints.
4. Treat advancing a suitable Call 1 prospect and intentionally rejecting an unsuitable one as valid successful progression decisions.
5. Judge repetition and call length contextually. A difficult prospect may reasonably need more time or clarification; pressure and unsupported claims receive no credit.
6. Allow zero strengths, zero improvements, or zero critical findings. No negative quota exists.
7. Require an independent verifier and exact transcript evidence before a checkpoint contributes to the deterministic score.

Applicable checkpoints use deterministic points: `completed=100`, `partial=60`, `missed=20`. Not-applicable and not-observable checkpoints are excluded. A material verifier disagreement or fewer than three verified checkpoints withholds the numeric score and sends the assessment to human review.

## Script-aligned checkpoints

Call 1:

- Consent, purpose, and time control — 15%
- Story and expertise discovery — 20%
- Commercial need and consequence discovery — 20%
- Fit, authority, readiness, and capacity — 20%
- Correct progression decision — 15%
- Concrete next step, stakeholders, and pre-work — 10%

Call 2+:

- Reconnection, agenda, and prior context — 10%
- Personalized story and value — 20%
- Soft commitment and stakeholder alignment — 15%
- License, price, terms, and understanding — 20%
- Objection diagnosis and response — 15%, not applicable when no objection occurred
- Ethical close or concrete follow-up — 15%
- Contract, payment, and onboarding — 5%, not applicable when agreement was not reached

## Bounded calibration result

The one-time launcher selected exactly six Call 1 and six Call 2+ calls from immutable V4.3 history, using low/middle/high V4.3 score positions only for sample diversity. It dispatched 12 independent, idempotent worker executions. All 12 reached the immutable-score write and completed their processing-ledger record.

- 12 assessments finalized
- 6 Call 1 and 6 Call 2+
- 10 verifier-approved numeric calibration scores
- 2 numeric scores withheld for material fairness disagreement
- 0 workflow crashes
- 0 critical findings forced
- 0 source-system writes

The two withheld cases prove the fail-closed behavior: one primary assessment was rejected for treating a firm, reasonable prospect decline too harshly; another exposed a real policy question about prerecorded material versus the rep's live framing and follow-up. They remain visible in the human review page with the verifier's warnings.

## Private manager experience

Route: `/manager/rep-scoring/v5-calibration`

The page uses the existing `REP_SCORING_ADMIN_EMAILS` gate. It groups exactly six Call 1 and six Call 2+ cards. Each detail page shows transcript reliability, prospect opportunity, external factors, script checkpoints, supported strengths/improvements, verifier warnings, exact evidence, and transcript provenance in that order. It repeatedly labels the output as calibration-only and not a personnel decision.

## Verification evidence

- Both n8n workflows validate with zero errors and zero invalid connections.
- Launcher execution `457690` produced 12 distinct sub-executions: `457699` through `457710`.
- Each of those 12 executions succeeded and reached `Create Immutable Call Score`, `Complete Ledger`, and `Run Complete`.
- The V5 launcher and worker were deactivated after completion.
- Five scoped Vitest tests pass.
- TypeScript and scoped ESLint pass.
- The first local Next.js build compiled successfully, then the local type-check worker exceeded the laptop's default 2 GB Node heap. No local server was started.
- Vercel preview deployment `dpl_8Vx73iewHt9AFFmrZpiy8d4Byuk3` reached `READY`; its remote build completed compilation, TypeScript, static generation, and route emission successfully for Git commit `9c572d398fc96e0bca69fdec451fcf938d78b5a1`.
- The preview environment does not contain the production Auth.js secret, so it correctly cannot be used for an authenticated manager-session test. Authentication is not weakened or bypassed; the final authenticated route and data verification must use the production environment after release.

## Human gate before backfill

The V5 scoring contract is not yet approved for full history. Syed must review the 12 supplied assessments and identify repeatable errors. Any correction must use a new prompt/config version and preserve these rows. A full backfill begins only after that feedback and explicit approval.
