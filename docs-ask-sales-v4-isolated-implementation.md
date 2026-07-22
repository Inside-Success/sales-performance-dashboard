# Ask Sales V4 Isolated Implementation

Date: 2026-07-22

Status: **implemented and verified end to end in a separate protected Vercel Preview; intentionally not connected to production and not approved for production promotion.**

## Outcome

The post-launch V4 recommendation is implemented as an isolated evaluation and stakeholder-review path. It can now run its real three-stage DeepSeek path in the protected Preview. The existing V3 production selector, normal Ask Sales API, production page, Neon data, conversations, feedback, source-review workflows, governed publisher, and production deployment were not changed by this implementation.

The working branch is `agent/ask-sales-v4-isolated-2026-07-21`, based on dashboard main `1641c3fb9b410aa5a0d43c68b41edb0d04fbfc2b`. The completed candidate and evaluator are frozen in dashboard commit `2d2ba16`. The branch is published as draft dashboard PR [#70](https://github.com/Inside-Success/sales-performance-dashboard/pull/70). Merge, production cutover, and production promotion remain separate future decisions.

At the final GitHub check, PR #70 remained open and draft, its governed-release validation completed successfully, and its merge state was clean.

## Architecture

The governed corpus contains decision metadata that a text-only vector migration would discard: product scope, exclusions, action, entity, decision key, authority, quality, answerability, blockers, supersessions, and source lineage. V4 therefore uses a zero-subscription hybrid retriever over the current materialized governed registry rather than adding a new database simply to resemble conventional RAG.

```text
Question + bounded conversation context
        -> V3-compatible turn/reference and product-scope resolution
        -> V4 hybrid retrieval over the governed policies
        -> exact unresolved-decision and product-boundary checks
        -> atomic need planner
        -> evidence-only answer composition
        -> claim/need validator plus deterministic fact guards
        -> answer, useful partial, clarification, live lookup, artifact route, or safe route
```

Retrieval combines BM25, phrase/question-family overlap, character trigrams, structured-field overlap, scope filtering, authority/answerability boosts, reciprocal-rank fusion, decision-key diversification, exact blocker matching, governed overlays, and narrow deterministic governed families. A vector service remains an option only if labeled recall analysis later proves a retrieval gap.

The normal model path uses three bounded DeepSeek JSON stages: planning, composition, and validation. Each stage records sanitized attempts and fails closed. Unsupported sentences are removed; if no supportable claim remains, the response safely clarifies, partially answers, requests a controlled artifact or live lookup, or routes the unresolved decision. The isolated API also fails closed before composition when its provider is not ready.

Important controls include:

- atomic evidence and completion checks for every need in a compound question;
- exact product, actor, timing, relationship, condition, quantity, and action compatibility;
- exclusion of `discovery_only` material from answer authority;
- exact blocker and product-boundary handling before answer composition;
- deterministic guards for money, guarantees, platform coverage, rights, refunds, qualification, schedule, quantity, and other high-risk facts;
- separate, explicit route metadata for the unresolved part of a useful partial answer; and
- a deliberately narrow exact-answer path for stable governed families when a model call is unnecessary.

## Isolated Preview And Security

- Lab page: `/ask-sales-faq/v4-lab`
- Lab API: `/api/ask-sales-faq/v4-isolated`
- Separate Vercel project: `ask-sales-v4-isolated-lab`
- Project ID: `prj_shQosMg7WwKGTUULtovVAhWTTDdp`
- Verified protected Preview deployment: `dpl_AxjzaWVMvXBtj7KeTe4qsguQZWfV`
- Protected Preview URL: `https://ask-sales-v4-isolated-helsacg4f-admin-88375990s-projects.vercel.app`
- Deployment state: `READY`

The lab is available only when the V4 isolation flag is enabled in a Preview environment. The exact lab page has a narrowly scoped dashboard-auth bypass, while Vercel Deployment Protection still guards the deployment and the API separately requires a constant-time checked capability token of at least 24 characters. No token or model credential is documented here.

The API is intentionally persistence-free. A transitive dependency validator checks the route and its local dependencies for Neon, SQL, conversation, feedback, history, or other write paths. Both the page and API are no-indexed, deny framing through CSP and `X-Frame-Options`, and use a no-referrer policy.

Conversation continuity uses an encrypted and authenticated AES-256-GCM history token with the `v4h2` envelope. The token contains at most two prior user/assistant pairs, expires after one hour, and is bound to the conversation, knowledge snapshot, and runtime identity. Message content is sanitized before it enters the token, and strict schema, role, size, integrity, and expiry checks fail closed. Sanitization is best-effort rather than a promise that arbitrary real secrets or personal data are safe, so the lab UI explicitly instructs testers to use only fictional or already-redacted inputs.

The lab accepts at most ten messages of 6,000 characters each and rejects request bodies above 70 KB. Its request-rate and concurrency guards are intentionally in memory: 20 requests per capability token per ten-minute window and at most two concurrent model requests per token **per warm Vercel instance**. They are useful lab controls, not distributed global rate limits. The lab also uses a shared capability token rather than per-user identity; both are explicit limitations of this isolated test surface.

## Hosted Smoke Verification

The protected deployment passed the complete hosted smoke sequence:

1. readiness reported the isolated model path ready;
2. an invalid capability token was rejected with HTTP 401;
3. a real request completed the DeepSeek planner, composer, and validator stages and returned a supported answer;
4. the returned AES-256-GCM `v4h2` history token was accepted on a follow-up and preserved bounded context;
5. the API and page returned the expected no-index, no-referrer, anti-framing, and related security headers; and
6. the rendered lab exposed the fictional/already-redacted-input warning.

The hosted Vercel build also passed. Preview access is optional and remains protected; this verification does not make the lab public or connect it to production.

## Evaluation Governance

The evaluator now distinguishes V3 and V4 effective-corpus snapshots and records separate hashes, so an end-to-end comparison cannot be mislabeled as a same-corpus experiment. Answer correctness/completeness and routing correctness are scored orthogonally, which allows a response that correctly answers and also routes an unresolved part to receive the right disposition instead of being treated as automatically incorrect.

Raw model output is retained as an immutable artifact. Any scored derivative is separate and hash-bound to that raw artifact. A noncanonical or unscored run can never produce a passing promotion decision; it remains `not_evaluated` even when its engineering results look strong.

A canonical promotion evaluation requires all of the following:

- an externally preregistered evaluator/candidate commit and runtime;
- at least 50 retained cases and at least 10 sealed holdout cases;
- all six required evaluation strata represented in both retained and holdout roles;
- the same exact provider configuration for V3 and V4;
- three alternating V3/V4 runs with order-aware retry accounting;
- a clean preregistered commit and matching knowledge/runtime fingerprints;
- independent, source-only SME gold labels; and
- a blind human score bundle before the promotion gate is evaluated.

The existing five-case holdout remains sealed and unopened. It is insufficient for the canonical minimum and must not be treated as a completed holdout evaluation.

## Exact-Code Retained Replay

The final retained diagnostic is:

- `artifacts/ask-sales-faq-v4/paired-2026-07-22T01-57-27-888Z.json`
- `artifacts/ask-sales-faq-v4/paired-2026-07-22T01-57-27-888Z.md`

It completed 78/78 launch-log cases using the fresh V3 and V4 effective corpora. All 63/63 V4 model attempts succeeded with no model failure and no retry. The execution split was 47 zero-model cases, 15 one-attempt cases, and 16 three-attempt cases.

Observed end-to-end latency in this diagnostic was:

| Runtime | p50 | p95 | Average | Maximum |
| --- | ---: | ---: | ---: | ---: |
| V4 | 149 ms | 14,134 ms | 3,626 ms | 15,123 ms |
| Stored V3 | 17,110 ms | 28,832 ms | 16,144 ms | not recorded here |

An independent engineering audit decomposed the 78 prompts into 117 substantive needs. All 117/117 were appropriately handled in the retained replay: 61 answer needs, 27 route needs, 5 live-lookups, 3 artifact lookups, 2 clarifications, 2 intentionally partial needs, and 17 conversation/rewrite needs. It found 0 unsupported factual claims, 0 missing required routes, 0 wrong routes, and 0 false abstentions; all 28 route-required cases used the expected channel set, including the intentional multi-channel case.

This is strong regression-engineering evidence, not a promotion score. The artifact records a dirty working-tree runtime at HEAD `ce937e3`, while its exact implementation fingerprint is preserved as code hash `97f1f9e7f3ec3ae4ac36651ff76e751f7c733e41f3d9036753ce08056578aad7`; that implementation is now frozen in commit `2d2ba16`. It has no independent SME gold, judge scores, or blind human scores and therefore remains noncanonical and `not_evaluated` for promotion.

The following incomplete or accidental artifacts were deleted/excluded and must not be used as evaluation evidence:

- `paired-2026-07-21T21-37-23-708Z.json` and `.md`;
- aborted `paired-2026-07-21T23-22-00-333Z.json`; and
- accidental no-model `paired-2026-07-21T23-43-14-619Z.json` and `.md`.

## Final Verification Matrix

No local development server was started.

- Focused V4 tests: **371/371 passed across 15 files**.
- Full Ask Sales tests: **607/607 passed across 30 files**, including unchanged V3 behavior.
- Static Ask Sales validator: **107/107 passed**.
- Transitive V4 isolation validator: **15/15 passed**.
- TypeScript: passed with no errors.
- Scoped ESLint: passed with zero warnings.
- `git diff --check`: passed.
- Optimized local Next.js production build: passed without starting a server.
- Isolated Vercel Preview build: passed.
- Hosted readiness, authentication rejection, real three-stage model request, encrypted-history follow-up, security headers, and UI warning: passed.

The current dependency audit reports 14 advisories: 2 low, 6 moderate, 6 high, and 0 critical. The exact production-main checkout reports the same set, so this is baseline-equivalent rather than a V4-introduced regression. No automatic or breaking `audit fix` was run.

## Production Isolation

- Final read-only recheck: remote dashboard main remained `1641c3fb9b410aa5a0d43c68b41edb0d04fbfc2b`; production deployment `dpl_8UxUBMivafKEQN7fiy5aVMdETEFw` remained `READY`, its production aliases remained attached, and the production project build-ignore command remained unset.
- Three earlier V4 branch commits triggered failed non-production Preview attempts in the production-linked Vercel project. None reached `READY`, changed the production target, or moved an alias. The exact-branch deployment guard prevented any new production-project deployment or Vercel check for final candidate `2d2ba16`.
- The normal production selector remains V2/V3-only; V3 remains the selected live runtime.
- Normal `/api/ask-sales-faq` does not import V4.
- Normal `/ask-sales-faq` does not import or link the lab.
- The production selector, normal API/page, and shared V3 provider were byte-compared with `origin/main` during isolation verification.
- The V4 credential, history secret, capability token, feature flags, deployment, and hosted tests exist only in the separate isolated Preview project.
- The production alias was not moved, no new production deployment was created, and the V4 branch was not merged.
- No Slack, Google, n8n, Neon, or production API write was made.
- No subscription, provider upgrade, or marketplace product was purchased.
- No local development server was run.

The saved policy-matching replacement remains a separate pending project. V4 neither implements nor supersedes `POLICY-MATCHING-REPLACEMENT-PLAN-2026-07-21.md`.

## Honest Readiness Assessment

V4 is materially stronger than the first isolated implementation checkpoint: its real provider path works in the protected Preview, all retained model attempts succeeded, the 117-need engineering audit found no substantive handling defect, and the expanded security and governance suites pass. That is enough to begin controlled stakeholder review after the canonical evidence package is prepared. It is not evidence that the chatbot is “perfect,” and it is not authorization to replace V3.

Presentation polish remains in several retained responses: repeated or awkward phrasing in `qa-1-3`, `qa-2-7`, `qa-3-8`, `qa-4-1`, `qa-6-2`, `qa-8-1`, and `qa-8-4`. Four additional reservations (`qa-2-9`, `qa-3-4`, `qa-8-2`, and `qa-8-3`) are nonmaterial blocker metadata that did not harm the user-facing result. These should be considered during human review without restarting a case-by-case patch loop before stronger evaluation evidence exists.

The candidate/evaluator freeze is complete at `2d2ba16`. The remaining sequence is:

1. obtain independent source-only SME gold plus an externally preregistered, stratified holdout of at least ten cases while leaving the current five sealed;
2. run the three canonical alternating V3/V4 comparisons under exact provider parity;
3. attach the blind human score bundle and evaluate the promotion gate;
4. complete protected-Preview stakeholder review; and
5. only after explicit approval, design a separate cutover, rollback, deployment, and production-health plan.

There is no `element.md` in this repository. This file is the dashboard implementation record; the FAQ documentation repository maintains its corresponding `implementation.md` and handoff records.
