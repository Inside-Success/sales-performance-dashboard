# Ask Sales V5.5 blind human promotion gate

Date: 2026-07-26
Status: implemented and technically verified; human review pending; production promotion not authorized

## Decision in one paragraph

Frozen V5.5 has **not** earned production replacement. A new source-only comparison was sealed before either runtime was opened, executed against production V3 and frozen V5.5, repeated on the preregistered subset, and converted into a low-overload blind review. The primary diagnostic is unfavorable for both systems: of 18 prompts whose authoritative Slack answer was shown in the source gold, each runtime produced 17 explicit routes and one route-like conversation reply instead of a substantive answer. Both correctly routed the two live-action controls to Finance and Greenlight. Human pairwise scoring remains required, but the observed answer coverage already rules out a responsible V5.5 production recommendation.

## Isolation and safety

- Production V3 was not edited, deployed, reconfigured, or promoted.
- Frozen V5.5 runtime commit `f8d9915ba2be2d87374d748d8f3bb62e3b409afb` was not changed.
- The evaluation branch began from that exact commit. `git diff f8d9915... -- src/lib/ask-sales-faq/v5-5 src/lib/ask-sales-faq/v5 src/app/api/ask-sales-faq` remains empty.
- Slack was used read-only. No Slack message, reaction, edit, deletion, or workflow write occurred.
- No database, n8n, Google, Vercel configuration, deployment, subscription, or production write occurred.
- No local development server ran.
- A branch-scoped Preview environment was read only for the primary runtime and its temporary local environment file was deleted afterward. No credential is stored in these artifacts.

## Preregistered evidence

- Dataset: `tests/ask-sales-faq/v5-5-blind-human-gold-2026-07-26.json`
- Dataset SHA-256: `55208bc63a54dd3e1291fa6b122e65e9f1c9d23d62bebb9e198e8a0b4d69edb4`
- Pre-output seal commit: `3076d8d6ce13057d0fd239f6556a9665800ec319`
- Scope: 14 standalone questions plus three two-turn conversations, for 20 prompts total.
- Source construction: 18 answer prompts use authoritative threaded Slack resolutions; two safety controls use the current approved owner-route catalog.
- Leakage check: 333 previously used Slack evidence IDs were checked and the final set had zero source-ID overlap.
- Exclusions: ambiguous or unresolved threads, peer-only advice, client personal data, and questions selected because a candidate already answered them well.
- Authority handling: exact decision, scope, conditions, finality, recency, and role are evaluated together. Rich normally outranks Madeline, while a materially newer exact decision can control in context.

The gate was frozen before runtime output:

- at least four V5.5 net pairwise wins over V3;
- zero V5.5 serious operational errors;
- zero V5.5 wrong action owners;
- at least 80% conservative V5.5 acceptability;
- explicit owner approval even if all technical thresholds pass.

## Runtime result before human scoring

Primary report: `artifacts/ask-sales-faq-v5-5-blind-gate/primary-runtime.json`
SHA-256: `36c5dcd2165b39729e659c6044d7a4b18fe7d5ab39a3f077f335b66d3ed944ca`

| Observation | Production V3 | Frozen V5.5 |
|---|---:|---:|
| Prompts completed | 20/20 | 20/20 |
| Explicit route lane | 19 | 19 |
| Conversation lane | 1 | 1 |
| Answerable source-gold prompts routed or answered with route-like fallback | 18/18 | 18/18 |
| Provider attempts | 0 | 0 |
| Terminal provider failures | 0 | 0 |
| Mean latency | 67 ms | 1,831 ms |
| P90 latency | 87 ms | 2,643 ms |
| Finance action owner | correct | correct |
| Greenlight action owner | correct | correct |

These lane counts are not human correctness scores. They do show that the failure happened before answer composition: neither runtime admitted enough authoritative evidence to call the model on this new set. This is not a DeepSeek transport failure and cannot be fixed by changing prose generation alone.

## Repeatability

The preregistered nine-prompt subset was rerun in reverse system order.

- Report: `artifacts/ask-sales-faq-v5-5-blind-gate/repeatability-runtime.json`
- SHA-256: `b0f533893a8a32da736180f7509d4be6782cd1d47c046a288a5748a0b35320bb`
- Exact answer, lane, route flag, and route-channel differences from the primary run: `0/18` system outputs.
- Provider failures: zero.

The poor answer coverage is therefore repeatable on this subset, not a one-off model variation.

## Human review packet

Open `artifacts/ask-sales-faq-v5-5-blind-gate/ASK-SALES-BLIND-REVIEW.html` directly in a browser.

- one question at a time;
- four batches of five;
- authoritative rule displayed above the two candidate answers;
- system identities hidden and balanced by independent question/conversation group;
- a two-choice judgment plus an optional short note;
- answers saved locally when browser storage is available, with safe in-memory fallback;
- feedback downloadable or copyable as JSON;
- self-contained file with no external scripts or network calls.

Packet ID: `v55-blind-55208bc63a54`
Packet file SHA-256: `4219ba8eff341c081cfdfbdb98c69c54d44dd39ceae5460708f9ba5a35ca64a2`

The system key is deliberately separate in `sealed-unblind-key.json`. Do not open it before the review is complete.

After the reviewer returns the completed JSON:

```bash
pnpm score:ask-sales-faq:v5-5:blind-review -- --feedback=/absolute/path/to/ask-sales-blind-review-feedback.json
```

The scorer rejects incomplete, mismatched, or unblinded feedback; maps A/B choices only after review; checks the frozen thresholds; verifies the two action owners from runtime output; and never authorizes production automatically.

## Verification completed

- dataset seal and prior-source overlap validation;
- 20/20 paired primary runtime completion;
- 9/9 paired reverse-order repeatability completion;
- exact repeatability comparison: 18/18 stable outputs;
- blind mapping completeness, balance, and conversation stability;
- packet/key/runtime/dataset hash binding;
- self-contained/no-network HTML checks;
- credential-pattern scan;
- browser rendering and interaction check without a local server;
- zero browser console errors or warnings;
- incomplete-feedback rejection and synthetic completed-feedback scorer test;
- project tests, TypeScript, scoped lint, isolation validation, and GitHub checks recorded with the final evaluation commit.

## Honest conclusion and next decision

V5.5 remains the strongest earlier V5 candidate on consumed and production-distribution diagnostics, but this independent set reveals that its knowledge-access improvement is not general enough. It is not meaningfully better than V3 here, it is much slower, and neither system delivers the answer coverage the sales team needs. Replacing production now would most likely preserve the current over-routing problem while adding latency; it would not deliver the promised step change.

Finish the blinded review because it provides auditable human evidence and may reveal differences in route wording or safety. Regardless, do not promote V5.5 unless the preregistered gate passes and the owner explicitly approves it. If the gate fails, the next implementation should target the governed knowledge publication/access boundary revealed by these unseen source-gold misses, not patch these 20 questions or loosen fail-closed safety globally.
