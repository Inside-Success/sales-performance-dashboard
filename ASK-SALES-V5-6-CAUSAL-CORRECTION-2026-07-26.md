# Ask Sales V5.6 Bounded Causal Correction

Date: 2026-07-26

Status: implemented, frozen, model-tested, and fully verified in isolation. Production V3 remains live and unchanged. V5.6 is not authorized for production.

## Why this iteration exists

The corrected V5.5 blind review established an important fact: the verified knowledge source shown above the answer was correct, but V5.5 still routed several answerable questions or lost parts of the controlling rule. That localized the main defect after retrieval: decomposition, admission, authority selection, entailment, or final composition could reject or truncate correct evidence that was already present.

V5.6 corrects those stages without weakening passive-chatbot action routing or the fail-closed boundary for absent, conflicting, or case-specific knowledge.

## Runtime changes

- Clear informational FAQs remain knowledge questions even when they contain operational topic words such as `editing`, `payment`, `link`, or `delivery`; live requests and mutations still route.
- An unchanged official payment link for an already signed plan is answerable. Creating or changing payment terms remains a Finance action.
- One concrete Call 1-to-Call 2 timing decision stays atomic rather than becoming artificial interval subquestions.
- Generic pricing questions no longer receive a synthetic case-specific eligibility decision.
- `authorized` can no longer trigger the unrelated `author` eligibility rule.
- Package-price and platform-exclusivity checks require their real relationship context.
- The chopped-reels follow-up resolves the new policy object instead of rewriting the previous answer.
- Claim-scoped authority resolutions are enforced before final selection. They consider the exact decision, specificity, recency, finality, and role rather than applying a blind person-level rank.
- Source-resolved multi-step procedures can require compatible records to be composed. The current paid-client upgrade procedure now includes the newer upgrade form followed by the compatible contract, payment-difference, fulfillment, and before-filming steps.
- The final answer uses the complete approved decision text when a single exact record controls, avoiding the incomplete short quote observed in V5.5.
- The causal trace records resolved need fields, ranked candidates, raw source text, admission/exclusion reasons, authority disposition, entailment verdicts, and selected source IDs.

Two owner-confirmed rules are isolated and publisher-pending only in V5.6:

- Main ISTV Call 2 starts with the $20,000 Standard package, then uses only the approved $30,000 VIP or $12,000 Lite move according to fit and finances. Only approved installment plans may be used; do not show all three prices at once or invent a split.
- Call 1 normally does not include pricing. Pricing is covered on Call 2 after greenlight. The narrow Rich-approved exception is using price only to disqualify when the prospect both has no business and is not financially qualified.

These overlays do not alter Neon, the governed refresh workflow, a knowledge release, or production V3.

## Frozen model evidence

All three compared systems used the same DeepSeek provider/model configuration. The exact V5.6 runtime under evaluation was frozen at commit `d859b05`.

| System | Completed | Answer | Route | Conversation | Provider attempts | Failed attempts | Mean latency | P90 latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Production V3 | 20/20 | 15 | 4 | 1 | 75 | 0 | 15,781 ms | 20,413 ms |
| Frozen V5.5 | 20/20 | 10 | 9 | 1 | 33 | 2 recovered | 22,156 ms | 33,366 ms |
| V5.6 | 20/20 | 18 | 2 | 0 | 38 | 0 | 10,422 ms | 12,150 ms |

The two V5.6 routes are the intended Finance and Greenlight live-action controls. Every source-answerable item in this reviewed 20 reached the answer lane. This is a meaningful correction of the known V5.5 false routes, but the set was visible during development and is not unseen promotion evidence.

### Repeatability

Five frozen runs of the same 20 prompts produced 100 outputs and 80 run-to-baseline comparisons:

- lane flips: 0;
- decision-boundary flips: 0;
- source-set flips: 0;
- exact-answer flips: 0;
- cases requiring manual variation review: 0.

The result rules out model non-determinism as a first-order defect on this packet. It does not prove correctness on unseen questions.

### Retained 50-question diagnostic

V5.6 completed all 50 prompts with 88/88 successful provider attempts:

- V5.5 answer -> V5.6 answer: 27;
- V5.5 route -> V5.6 answer: 2;
- V5.5 route -> V5.6 route: 21;
- V5.5 answer -> V5.6 route: 0.

The two recovered answerable cases were the paid-client upgrade procedure and the contract promotional-activity explanation. The retained set still contains clear source-answerable false routes for Next Level CEO social promo assets, its swag definition, and the Love Experts availability/subcategory rule. A Greenlight supporting-document example also has conflicting historical ownership context and requires a source-governance decision rather than a runtime guess. The upgrade answer is accurate but verbose and can be tightened after the correctness gate.

This set is retained regression evidence only. Lane counts are not correctness scores.

## Human review packet

`artifacts/ask-sales-faq-v5-6-causal/blind-review/ASK-SALES-BLIND-REVIEW.html` is the required next review. It:

- compares production V3 with V5.6;
- keeps the systems hidden;
- shows the already verified source rule above each pair;
- displays one question at a time in four batches of five;
- exports feedback JSON bound to the sealed packet;
- never authorizes production by itself.

Packet ID: `v56-blind-32cb80bf99b6`

Packet SHA-256: `3ca10b73356fc41aa2dad6fbc8faa08cce4d5207ab7e9bea1574fa5d7d29765c`

## Verification

- evaluation artifact verifier: passed;
- five-run repeatability: 100/100 outputs, zero flips;
- full Ask Sales suite: 863/863 tests across 53 files;
- focused V5.6, authority, and isolated-route suites: 81/81;
- TypeScript: passed;
- ESLint with zero warnings: passed;
- optimized Next.js production build: passed;
- isolated dependency and production-selector checks: 15/15;
- local development server: not run.

Core artifact SHA-256 values:

- three-way comparison: `cb267bde689f5732161cc8c73f0fa9fb61bcdc443d2404c91c1c1f258f0fb490`;
- repeatability analysis: `e150e38225bb222d2f4a26a9c7c8b46bceec1c4fe8cefd48694f3b60e5580804`;
- retained 50 runtime: `52613a30e386836e5a1dd5cb87e0d4b75c85f03bb171f7da5e5f035fbd17c65e`;
- blinded packet file: `823ef1160f240bd53f8dc08a453ca334ba08d76e5c995233293698b1b9559b4c`.

## Honest decision

V5.6 is the strongest V5 candidate so far and the change is meaningful, not cosmetic: it corrected the causal failure in which correct knowledge was present but rejected or incompletely composed, restored all reviewed source-answerable items in the 20-question diagnostic, preserved both action routes, added two retained-set recoveries without an answer-to-route lane regression, eliminated observed repeatability flips, and reduced latency substantially.

It is still not proven ready to replace production V3. The principal remaining risk is a source-answerable unseen question still being routed, plus the smaller but higher-impact risk that an unresolved freshness/authority conflict is answered with the wrong operational rule. The retained false routes prove coverage is not yet complete, and the 20-question result cannot establish generalization because it was used diagnostically.

Decision: keep V3 live. Have the project owner complete the blinded V3-versus-V5.6 review. If V5.6 has zero material wrong-rule answers, zero wrong action owners, and a meaningful human-usefulness lead, freeze it and run one genuinely new, high-quality, source-only Slack holdout selected before outputs are generated. Promotion still requires explicit stakeholder approval and a reversible release plan.

The saved V3 policy-matching replacement remains separately pending and is not implemented or superseded.
