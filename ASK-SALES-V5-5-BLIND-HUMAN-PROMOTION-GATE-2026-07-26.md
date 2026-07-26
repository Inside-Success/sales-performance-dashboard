# Ask Sales V5.5 provider-corrected blind diagnostic

Date: 2026-07-26
Status: valid provider-backed diagnostic; blind human review pending; production promotion blocked

## Executive decision

Do not replace production V3 with V5.5. The first 20-question comparison was invalid because neither system had a usable model provider and the candidate side called V5.4 while being labeled V5.5. A corrected isolated run now compares the real production V3 runtime with the frozen V5.5 runtime on the same DeepSeek model. V3 answered materially more of the source-answerable questions. V5.5 was faster, but over-routed clear rules and changed one decision on the repeatability run.

The corrected blind review is useful for direct human answer preferences. It is not fresh unseen promotion evidence because the questions and source gold were already exposed during the invalid first review. A non-bypassable repeatability hold also blocks promotion regardless of the human score.

## What was corrected

- Real runtime entrypoints: production V3 versus frozen isolated V5.5.
- Provider parity: the same DeepSeek model and direct-provider mode for both systems.
- Provider preflight: missing configuration now stops before any runtime output is written.
- Provider-backed minimums: provider-unavailable fallbacks cannot masquerade as a completed comparison.
- The doctor gold now follows Mike and Rich's Zoom clarification: practice ownership is not required; a hospital-employed doctor can qualify; a nurse is not a doctor.
- The Call 2 pricing gold now requires the $20,000 Standard package first, followed only by approved upsell/downsell options and listed installment plans based on fit and financial position. Reps must not show all packages at once or invent a custom split.
- The reviewer now shows one question, one verified rule, and Answer A/B at a time. Backend disposition labels are hidden.
- The scorer independently checks decision repeatability and cannot pass the technical gate while any mismatch remains.

## Isolation and governance

- Production V3 was not edited, deployed, reconfigured, or promoted.
- Frozen V5.5 runtime commit `f8d9915ba2be2d87374d748d8f3bb62e3b409afb` was not changed.
- No Slack message, reaction, edit, deletion, or workflow write occurred.
- No database, n8n, Google, Vercel configuration/deployment, subscription, authentication, knowledge release, or production write occurred.
- No local development server ran.
- Existing Vercel Preview configuration was read only to check provider availability. No deployment or environment write occurred, and the temporary local environment file was deleted.
- The saved production V3 policy-matching replacement remains separately pending and was not implemented or superseded.

## Corrected evidence identity

- Dataset: 14 standalone prompts plus three two-turn conversations, 20 prompts total.
- Prior Slack evidence IDs checked: 333.
- Prior source-ID overlap: zero.
- Dataset SHA-256: `32cb80bf99b6def87aa2715347aa32a4d5b5aebdc9d59a6569e24722bb63605f`.
- Evaluation commit: `4428175fab02dccf39cd9d8c27be0bbad5f2a634`.

The zero source overlap still protects against copying earlier source records, but the user's invalid first review exposed these questions and their rules. For that reason, this corrected execution is classified as a provider-backed diagnostic rather than a fresh promotion holdout.

## Valid provider-backed result

| Measure | Production V3 | Frozen V5.5 |
|---|---:|---:|
| Prompts completed | 20/20 | 20/20 |
| Answer lanes | 16 | 12 |
| Route lanes | 3 | 7 |
| Conversation lanes | 1 | 1 |
| Provider-backed outputs | 20 | 19 |
| Successful provider attempts | 74/74 | 33/34 |
| Terminal provider failures | 0 | 0 |
| Provider-unavailable outputs | 0 | 0 |
| Mean latency | 15,097 ms | 11,074 ms |
| P90 latency | 19,174 ms | 13,188 ms |

V5.5 recovered from its one unsuccessful attempt and completed every prompt. The answer-coverage difference therefore comes from runtime evidence selection/adjudication, not provider absence.

Primary runtime SHA-256: `dbdb92251630c38a6f3a29f5696dd23b7b52a59279d37cec37234e24e8d35781`.

## Manual engineering audit

V3 had stronger coverage. V5.5 routed clear answerable rules for:

- the five-year ISTV placement guarantee;
- the $20,000-first Call 2 quote sequence;
- the same-week Call 2 rule;
- hospital-employed-doctor eligibility;
- the editing timeline.

V5.5 gave clean source-aligned answers for several other rules, including Daymond John cohort handling, ROI, OnceHub cancellation, cast-member privacy, minors, authors, and live onboarding. It was faster and used fewer provider attempts.

Both systems failed the chopped-reels follow-up. V5.5 repeated the full-episode rule instead of resolving the new object, while V3 contradicted itself. V3 also omitted the exact $20,000 baseline in the Call 2 pricing answer and added avoidable detail in some responses. Keeping V3 live is a risk-minimizing decision, not a claim that V3 is already ideal.

## Repeatability promotion hold

The reverse-order nine-prompt run found one material V5.5 decision change:

- `call1-pricing-turn-2`: the primary run answered; the repeat run routed to `#sales-questions-requests`.

The verifier status is `verified_with_promotion_hold`. The scorer independently recomputes the mismatch and sets `technicalGatePassed` to false while it remains.

- Repeatability SHA-256: `84b64a76c40b5ddc38a56d3a6751de1ef16c01ae5688d4738e022b62ac1e7b53`.
- Review packet SHA-256: `2005362a7557803f45cf17e223de505ac0f10dc8ee4d803e5e969939266f745a`.
- Packet ID: `v55-blind-32cb80bf99b6`.

## Review and fixed safety behavior

The corrected review is at:

`artifacts/ask-sales-faq-v5-5-blind-gate/provider-corrected/ASK-SALES-BLIND-REVIEW.html`

It contains four batches of five questions, saves progress locally with an in-memory fallback, makes notes optional, and exports schema-validated feedback JSON. The mapping remains hidden and balanced by independent question/conversation group. The scorer rejects incomplete or mismatched feedback, checks material errors and wrong action owners, enforces the repeatability hold, and always leaves `productionPromotionAuthorized` false until a separate approved release decision.

## Verification

- corrected source/dataset validation passed;
- the no-provider negative test failed closed before producing invalid output;
- valid primary execution completed 20/20 for each system with provider/model parity;
- reverse-order repeatability execution completed 9/9 for each system;
- packet/key/runtime/dataset hash binding passed;
- hiding, mapping balance, conversation mapping, and no-network checks passed;
- responsive browser rendering and save/next navigation passed without a local server;
- synthetic completed feedback proved that the repeatability hold cannot be bypassed even when all human answers are marked acceptable;
- TypeScript, scoped lint, project tests, production build, isolation/diff checks, secret scanning, and governed GitHub checks are recorded on the final branch head.

## Honest conclusion and pending work

This correction is meaningful because it replaces an invalid comparison with real provider-backed evidence. The evidence does not support V5.5 promotion: V5.5 remains over-conservative on accessible knowledge and is not fully decision-stable. V3 should remain live.

Pending in order:

1. Complete the corrected blind review and preserve its score as diagnostic human evidence.
2. Do not change V5.5 merely to win these 20 consumed prompts.
3. If further runtime work is separately authorized, repair evidence adjudication/admission and follow-up intent resolution systemically, then freeze the new candidate.
4. Evaluate that frozen candidate on a genuinely new, high-quality, source-only set that neither the developer nor reviewer used for tuning.
5. Require zero critical wrong-policy answers, zero wrong operational owners, stable repeat decisions, meaningful human usefulness over V3, and explicit owner approval before any isolated canary or production replacement.
