# Ask Sales V4 Systemic Challenger: Implementation And Evaluation

Date: 2026-07-22

Status: **implemented and frozen in isolation; materially better than frozen V4 on two sealed diagnostic runs, but not safe or sufficiently proven for production. V3 remains live.**

## Release Boundary

- Branch: `agent/ask-sales-v4-systemic-knowledge-2026-07-22`
- Draft dashboard PR: [#71](https://github.com/Inside-Success/sales-performance-dashboard/pull/71)
- Frozen runtime commit: `7e639208f18a5b71ef144839c822ccf12ce9848f`
- Frozen tree: `4e46b94e51e08d06ead6a4344308205893f646e4`
- Production selector changed: no
- Production API/page changed: no
- Database, Neon, Slack, Google, n8n, feedback, or conversation persistence: none
- Local development server started: no
- Vercel Git deployment is disabled for this exact branch; no systemic Preview was created
- Existing frozen V4 and its protected Preview were not modified
- Saved policy-matching replacement remains a separate pending project and was not implemented

The systemic candidate has its own exact Preview-only page and API. Both reuse the isolated capability-token, AES-256-GCM bounded-history, no-index, security-header, request-limit, and provider controls. The production runtime selector still selects only V2/V3.

## What Changed

### Systemic knowledge compiler

The source pipeline collected 1,541 read-only authoritative Slack threads containing replies from Madeline, Mike, Raul, Rich, or Rudy. The generated operational bundle contains:

- 1,717 runtime policies;
- 492 independently source-verified answer policies; and
- 1,225 support/route policies that remain non-answering.

Twelve unsafe or unsupported candidates were withheld during compilation rather than promoted.

The user's additional screenshots and Mike/Rich Zoom transcript were processed as a separate curated authority register. Seven evidence records produced six bounded policies:

1. America's Best Doctors does not require practice ownership for an employed doctor;
2. Call 1 pricing is normally not discussed, with Rich's exact financial-disqualification exception preserved;
3. lead ownership lasts 30 days from the latest documented Keap contact;
4. same-day onboarding needs no separate notification only after every listed post-sale step is complete;
5. the new upgrade form must be used before selecting or sending VIP upgrade contract terms; and
6. the ISTV app wording is Roku, Fire Stick, or Apple TV, with routing when unresolved.

Ambiguous, duplicate, superseded, or non-answering transcript/screenshot material is recorded in the evidence register but was not converted into a confident policy. No screenshot or transcript binary was copied into the repository.

Hashes:

- generated operational bundle: `1f281316091e9e92fd48cc19ffa42714a6de1f283a86c88739c0704c146c39dc`
- generated source corpus: `f0d3e45beb3f9fc8e32d6c9de7b951ac44d376e317daddcd0296b0cc057bf0cb`
- generated classification: `4c03ec4666fdfa45515a500cac8abfe4819d29fc788ea6153d60250819d09fb5`
- curated supplement: `3e18e38c391bbafcdfb986674ea1b303f5de2207e7f12a5b59a77560edc5fa12`
- curated external-source aggregate: `a9804d966d70a242e631c22c8fe7fc2ff4b6f39bd8faefd4706a41212897dfd5`

### Runtime behavior

The 2,597-policy effective corpus is used through one generalized path rather than question-specific answers:

```text
conversation-aware need planning
  -> source-balanced hybrid retrieval
  -> per-need applicability and temporal/source precedence
  -> conditional evidence-only drafting
  -> sentence-to-need validation
  -> exact answer, useful partial, clarification, artifact/live lookup, or route
  -> evidence-aware arbitration against frozen V4
  -> fail closed to the safer candidate
```

Important controls include:

- operational Slack evidence cannot crowd governed policies out of retrieval;
- later, more exact evidence may supersede older or broader guidance;
- conditions may be explained but cannot be silently assumed;
- a general rule must be applied to the user's explicit scenario and requested outcome;
- current addresses and other changing artifacts route instead of quoting stale values;
- payment confirmation routes to Finance;
- missing contract/automation and record mutations route to Sales Tech;
- the arbiter may choose a safe route over an unsupported partial answer;
- unnecessary duplicate routes are treated as false abstention; and
- provider failure falls back only through the frozen safe path, never broad similarity.

## Deterministic Retrieval Check

Final pre-freeze retrieval over all 498 answer policies:

| Measure | Top 1 | Top 5 | Top 10 | Top 20 | Top 60 | Missing |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Structured question family | 99.40% | 100% | 100% | 100% | 100% | 0 |
| Structured source replay | 64.46% | 86.55% | 91.97% | 94.98% | 96.99% | 15 |

This is retriever-mechanics evidence, not an end-to-end quality or promotion score.

## Pre-Freeze Diagnostics

- Fresh 13: systemic answered/partially answered 12/13 versus 6/13 for frozen V4, with six helpful recoveries and no lost frozen-V4 answer. The two-pass diagnostic judge scored systemic 92.5, V3 6.5, and frozen V4 1.3; one cross-channel opt-out disagreement is a known gold/governance conflict.
- Curated authority five: systemic scored 96, V3 100, frozen V4 40. This primarily proves that the new source types enter the same generalized retrieval/grounding path; V3 already knew several of those rules.
- Conditional framing two: systemic scored 100, V3 90, frozen V4 15.
- Current-artifact/exact-route two: systemic and frozen V4 both scored 100 after the current-address, Finance, and Sales Tech routing controls.
- Retained 78: systemic produced four helpful route recoveries but scored 80.7 versus frozen V4's 98.5 on the old gold. Manual source inspection found several stale-gold conflicts where newer exact Slack supported systemic, but it also identified real relation/routing risks. Retained replay is regression evidence, not promotion evidence.

All model-judge values above are diagnostic. They are not independent human scores.

## Frozen Sealed Diagnostic

After commit `7e63920`, the previously unread 60-question source holdout was opened once and converted into fixed strata:

- 30 answer cases;
- 20 route/live/artifact cases; and
- 10 clarify/insufficient-evidence cases.

The same frozen DeepSeek transport ran V3, frozen V4, and systemic V4 independently. The runtime was not changed after either run.

Dataset SHA-256: `83f095e25725444d15f33277e25de630f8447157abdf227665dac413c545d4b4`

### Raw behavior

| Run | Systemic lanes | Frozen V4 answer/partial | Helpful over V4 non-answer | Less helpful than V4 answer | Systemic fallbacks | p50 / p95 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | 35 answer, 10 partial, 14 route, 1 clarify | 36 | 11 | 2 | 1 | 20.4s / 35.1s |
| 2 | 28 answer, 12 partial, 18 route, 2 clarify | 37 | 8 | 5 | 1 | 18.8s / 31.4s |

### Dual-pass source-grounded diagnostic judge

| Run | V3 utility | Frozen V4 utility | Systemic utility | Agreed winner counts: V3 / V4 / systemic / tie | Per-need judge agreement |
| --- | ---: | ---: | ---: | --- | ---: |
| 1 | 40.1 | 47.6 | **57.7** | 5 / 1 / 15 / 26 | 71.43% |
| 2 | 32.1 | 49.1 | **56.5** | 5 / 1 / 11 / 33 | 71.90% |
| Mean | 36.1 | 48.35 | **57.1** | pooled: 10 / 2 / 26 / 59 | not applicable |

Systemic beat frozen V4 by 10.1 points in run 1 and 7.4 points in run 2. That is a repeatable, meaningful directional improvement. It is not a production pass.

### Stability and judge limitations

- Systemic lane agreement across repeats: 83.33%.
- Frozen V4 lane agreement: 81.67%.
- Systemic normalized answers were byte-equivalent only 36.67% of the time; most differences were paraphrases, but some changed disposition.
- The judge's systemic per-need status agreement across the two executions was only 62.86%.
- In the 40 cases where both judge passes reached a consensus in both runs, only 27 retained the same consensus result.
- Some holdout records contain an atomic decision not actually requested in the root question.
- Some older holdout decisions conflict with later exact authority evidence now in the corpus.
- The generated holdout gold is source-derived model classification, not independent SME adjudication.

The judge is useful for finding failure clusters. Its score is not trustworthy enough to approve release by itself.

Artifact hashes:

- run 1: `3d434495651961c2a2b6fe38d93263663b6c6fdd524ecb5c9319f599eed73fab`
- run 1 judge: `4d70dc92a5bee5fef57566e750b81451152a130da734c6675c41cae1439613d9`
- run 2: `b8859af048ac85ced867eadc30c2a42751a778c84efdfcb33e2659464980f2af`
- run 2 judge: `5da00a2ee3df645e0cd70e6d49fe4dd6079456f44c8b9336a762303b1f3eb111`

Raw artifacts remain local and ignored because they contain internal evaluation questions and answers.

## Real Failures Found

The sealed run exposed issues that must not be hidden:

1. An “earliest SMS reminder” question can retrieve the unrelated 9 PM cutoff.
2. A criminal-record case can retrieve a conflicting violent/non-violent policy instead of the exact do-not-greenlight rule.
3. The inherited V4 upgrade answer gives contract/payment steps for a `$2,500` lock-in-to-Standard scenario whose source does not establish those steps. All three systems produced unsafe detail; systemic retained frozen V4 through the champion path.
4. “Where can I find phone call recording?” can answer with Zoom recording storage instead of the Sales Tech phone-recording request route.
5. A self-generated lead form question can route even though the source supports the standard onboarding process plus the commission distinction.
6. A no-show improvement answer can miss the explicitly requested pass-off/dummy-call volume guidance.
7. Several cases show source/gold conflicts, including Weekly Marketing Training and multi-partner limits. These need human supersession decisions rather than another automatic rule.

The lock-in upgrade case was the only unique systemic case flagged as critical unsupported in the sealed runs. The count varies by judge pass, but the underlying unsafe answer is real and inherited from frozen V4.

## Verification

| Check | Result |
| --- | --- |
| Full Ask Sales Vitest | 36 files, 657/657 passed |
| Isolation validator | 15/15 passed across both isolated routes |
| TypeScript | passed |
| ESLint | passed with zero warnings/errors |
| `git diff --check` | passed |
| Optimized Next.js production build | passed |
| Secret/path scan | supplied DeepSeek key absent; no hardcoded provider secret; no temporary source path |
| Runtime dependency closure | 27 local dependencies, no persistence/SQL/Neon path |

## Production-Unchanged Proof

Read-only verification after the frozen commit found:

- GitHub dashboard `main`: `1641c3fb9b410aa5a0d43c68b41edb0d04fbfc2b`;
- production selector blob: `e6378cc724694935f0780d6cdf5a6702630c90f5`;
- normal Ask Sales API blob: `75407019453aba057202e5de5435df60f024740c`;
- production alias `sales-performance-dashboard-rose.vercel.app`: deployment `dpl_8UxUBMivafKEQN7fiy5aVMdETEFw`;
- deployment state/target: `READY` / `production`.

After the branch and draft PR were published, the production-linked Vercel project's recent deployment list contained no deployment for the systemic branch. The production alias still resolved to the same `READY` production deployment above.

## Honest Decision

V4 is now heading in the right architectural direction. The knowledge-access problem was real, and promoting verified operational Slack decisions materially increased helpful answers on untouched questions. The repeat sealed result is stronger than V3 and frozen V4 by a meaningful margin.

It is still not “perfect,” not reliably stable enough, and not safe to replace V3. The sealed test found both relation errors and one critical inherited operational answer. The automated judge and generated gold also need human repair before their percentages can be treated as release truth.

Keep V3 live. Preserve this candidate as a frozen diagnostic milestone. The next quality phase should:

1. have an SME independently adjudicate atomic need relevance, source precedence, and the specific sealed disagreements;
2. create a new V4.1 branch for systemic relation/completeness fixes, never question-specific patches;
3. freeze V4.1 before opening a newly untouched, externally preregistered holdout;
4. run provider-parity repeats plus blind human scoring; and
5. discuss cutover only after zero critical unsupported answers, meaningful utility gain, acceptable false-abstention/route precision, stability, stakeholder approval, and a separately authorized rollback plan.

This implementation does not authorize merge, deployment, production cutover, or the separate saved policy-matching replacement.
