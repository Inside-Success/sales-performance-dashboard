# Ask Sales V5.13 Evaluation Summary

Date: 2026-07-28
Runtime: `v5.13-isolated`
Production promotion: no

## Purpose

V5.13 adds an immutable final decision contract after V5.12 entailment. It rejects selected evidence when the exact decision text does not answer the requested relationship, object, workflow stage, timing, or action intent. It also adds the owner-confirmed current studio address and two narrowly source-reviewed Slack decisions.

## Complete production replay

The isolated candidate replayed all 134 privacy-reduced responses across 87 real production conversations.

| Runtime | Answer | Partial | Route | Conversation | Answer/partial |
| --- | ---: | ---: | ---: | ---: | ---: |
| Historical V3 | 61 | 0 | 72 | 1 | 61 |
| V5.12 | 70 | 11 | 52 | 1 | 81 |
| V5.13 | 58 | 12 | 63 | 1 | 70 |

V5.13 completed 285 provider-stage attempts. Four attempts failed and recovered; no response ended with a provider-only failure. Mean latency was 15,513 ms and P90 was 26,092 ms.

Manual engineering review found that V5.13 removed the principal V5.12 wrong-relationship failures while retaining more answer/partial coverage than historical V3. Remaining gaps include the contract/payment sequence, show-season/episode-count scope, and conservative variability in a small number of answerable cases.

## Focused nine-case gate

- V3: four answers, five routes.
- V5.13: five answers, one partial, three routes.
- All 17 provider stages succeeded.
- The candidate answered four clear recent Slack rules plus the current address, routed the live Greenlight action, and blocked three known relationship substitutions.

The compact blinded owner-review packet is local at `artifacts/ask-sales-faq-v5-13-regression/blind-review/ASK-SALES-BLIND-REVIEW.html`. Do not inspect the sealed unblind key before feedback is submitted.

## Verification

- 60 Ask Sales test files and 953 tests passed.
- ESLint passed.
- TypeScript passed.
- Optimized Next.js Webpack build passed.
- No local development server ran.
- Production V3 and all connected production systems remained unchanged.

## Release position

V5.13 is a meaningful safety improvement and a credible direct-replacement candidate, but it is not approved for production. Complete the compact blind review and verify the two named knowledge gaps before requesting explicit promotion approval.
