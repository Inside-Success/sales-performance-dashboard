# Ask Sales V4.4 Isolated Preregistration

Date: 2026-07-24

Status: authorized for isolated implementation. This record fixes the architecture and evaluation gate before runtime changes or unseen-set selection.

## Protected State

- Production V3 remains the only live Ask Sales runtime and must not be changed, merged, aliased, or written to during this phase.
- V4.4 is built only on `agent/ask-sales-v4-4-hybrid-retrieval-2026-07-24`, based on the frozen V4.3 record at `1426310a4bc7fa857e0487832a5ec3461fbac90a`.
- Slack, n8n, Neon, Google systems, production authentication, and production persistence remain write-free.
- No local development server may run.
- The user's reviewed 50 and V4.3's frozen 40 are development evidence only. They are permanently excluded from V4.4 promotion scoring.
- The saved V3 policy-matching replacement remains separately pending and is not part of V4.4.

## Hypothesis

V4.3's main failure is not absence of all relevant source material. In several failures the correct policy was retrieved but rejected because model paraphrasing changed the requested relationship, broad conflict signatures matched generic language, compound live actions were classified after retrieval, or a source-level record combined stable and time-sensitive claims.

V4.4 will test whether a full-corpus atomic decision ledger plus hybrid recall, original-request-bound relationship validation, and action-first routing can materially improve unseen usefulness without weakening authority or hallucination controls.

## Authorized Architecture

1. Compile every effective V4.3 corpus policy into source-verifiable atomic decision statements while preserving parent policy IDs, product scope, conditions, boundaries, authority, effective time, answerability, and source lineage.
2. Retrieve atomic decisions using lexical BM25, exact question-family matching, character similarity, structured product/action/entity signals, and deterministic sparse semantic vectors. Vector similarity retrieves candidates only; it never authorizes an answer.
3. Bind relationship, request kind, material conditions, and action ownership to the user's original atomic clause. Model expansions may improve recall but cannot change those governing facets.
4. Classify live Finance, Fulfillment, Greenlight, and Sales Tech actions before knowledge selection, including compound requests with more than one owner.
5. Apply exact claim-scoped authority and conflict controls after recall. Rich controls same-decision conflicts over Madeline or Raul. Explicit current/superseding language may retire an older contradictory position only when product, relationship, decision object, source chronology, and typed facts all match.
6. Keep stable knowledge answers separate from live record changes, current artifact identity, and case-specific approvals.
7. Measure retrieval recall, source selection, answer generation, and route ownership separately.

## Development Evidence

The consumed reviewed-50 and V4.3 frozen-40 cases may be replayed only to validate failure-family repairs and regressions. No question-specific runtime branch, answer template, source-ID exception, or hardcoded holdout answer is allowed.

## Freeze And Unseen Evaluation

1. Run component, full FAQ, isolation, static safety, TypeScript, scoped lint, and production build checks.
2. Commit a runtime freeze before selecting or opening any new evaluation source set.
3. Select a new source-backed Slack set from records excluded from every prior evaluation, source supplement, reviewed-50 case, and manually inspected source.
4. Run V3 and frozen V4.4 under the same provider conditions.
5. Manually review every source thread and every atomic need. The AI judge is advisory triage only.

## Promotion Gate

V4.4 is eligible for a production-replacement recommendation only if all of the following hold on the new unseen set:

- zero critical unsupported answers;
- correct or materially helpful performance beats V3 by at least 10 percentage points, or by at least four atomic needs on a 40-to-50-need set;
- fully correct answers do not regress;
- incorrect or unsupported needs do not increase;
- answerable false abstentions are lower than V3;
- live-action route ownership is at least as accurate as V3 and no high-impact request is sent to a materially wrong owner;
- follow-up and natural-conversation regressions are absent in the separate retained conversation suite; and
- an independent source review supports promotion.

Passing tests or improving the consumed development cases is not sufficient. If the new unseen comparison fails this gate, V3 stays live and V4.4 remains an isolated candidate.
