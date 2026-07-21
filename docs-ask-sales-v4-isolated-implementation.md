# Ask Sales V4 Isolated Implementation

Date: 2026-07-21

Status: **implemented and verified in a separate protected Vercel Preview, but intentionally not enabled for hosted model traffic and not approved for production promotion.**

## Outcome

The post-launch V4 recommendation has been implemented as a clean-room evaluation path. The existing V3 production selector, normal Ask Sales API, production page, Neon data, conversations, feedback, source-review workflows, governed publisher, and production deployment were not changed.

The working branch is `agent/ask-sales-v4-isolated-2026-07-21`, based on dashboard main `1641c3fb9b410aa5a0d43c68b41edb0d04fbfc2b`. It is published as draft dashboard PR [#70](https://github.com/Inside-Success/sales-performance-dashboard/pull/70). It is not a production cutover branch. Merge and production promotion remain separate future decisions.

## Why This Is Not A Simple Pinecone Migration

The current governed corpus is small enough to retrieve in memory and already contains rich decision metadata: product scope, exclusions, action, entity, decision key, authority, quality, answerability, blockers, supersessions, and source lineage. Sending the same text to a new vector database would not by itself solve the observed false abstentions, compound-question omissions, neighboring-policy leakage, or unsupported-answer risk.

V4 therefore starts with a zero-subscription hybrid retriever over the current materialized governed registry. It combines BM25, phrase/question-family overlap, character trigrams, structured field overlap, scope filtering, answerability/authority boosts, reciprocal-rank fusion, decision-key diversification, and exact blocker matching. A vector service can still be evaluated later if a labeled recall analysis proves a remaining retrieval gap. It is not required merely to make the architecture look like conventional RAG.

## V4 Request Path

```text
Question + bounded conversation context
        -> V3 turn/reference and product-scope resolution
        -> V4 in-memory hybrid retrieval over current governed policies
        -> exact unresolved-decision and product-boundary checks
        -> atomic need planner
        -> evidence-only answer composition
        -> claim/need validator plus deterministic fact guards
        -> answer, useful partial, clarification, live lookup, artifact route, or safe route
```

The normal path uses three bounded DeepSeek JSON stages: planning, composition, and validation. Each stage records sanitized attempts and fails closed. Direct DeepSeek mode is V4-specific, DeepSeek-only, capped at 35 seconds per call, and does not retry. Vercel AI Gateway mode is explicitly selected, DeepSeek-only, capped at 32 seconds per call, and uses zero retries. The route maximum is 120 seconds; the configured three-stage budgets remain below it.

When the provider is unavailable, V4 can answer only a small deterministic whitelist of exact, stable governed families. It cannot turn broad similarity retrieval into a direct answer. The whitelist covers current canonical facts such as main prices/payment plans, same-day discount, DJ/NLCEO offers, Tier-1 boundary, app devices, current show catalog, negative watchability boundary, ROI/language boundaries, season capacity, exact Call 1/Post-Sale articles, contract-before-Call-2, and STOP reinstatement. Everything else remains bounded, clarified, looked up, routed, or requested as a controlled artifact.

## Safety And Grounding Controls

- Evidence is atomic and scoped per requested need. A compound request cannot be marked complete because one clause was answered.
- Answer cards must directly entail the need under the same product, actor, timing, relationship, conditions, quantity, and action.
- `discovery_only` content cannot become answer authority.
- `blocked_for_decision_keys` exclusions are applied before ranking.
- Unresolved blockers require compatible scope, matching action, and a specific decision subject/object; broad words and numeric suffixes cannot create a blocker by themselves.
- Exact whole-number amounts are normalized before comparison, so `$15,000` cannot collide on a generic `000` fragment.
- Deterministic sentence checks protect money, guarantees, platform coverage, rights, refunds, qualification, schedule, quantities, and other high-risk facts.
- A model validator cannot borrow evidence from another sentence or need.
- Unsupported sentences are removed. If no supported claim remains, the result routes safely.
- Partial answers expose only the unresolved part and its correct route.
- Exact show-list location, show watchability, season count, paid-all-three platform, STOP, contract-review, and client-email boundaries have permanent replay regressions.

## Isolated Lab Surface

- Page: `/ask-sales-faq/v4-lab`
- API: `/api/ask-sales-faq/v4-isolated`
- Separate Vercel project: `ask-sales-v4-isolated-lab`
- Project ID: `prj_shQosMg7WwKGTUULtovVAhWTTDdp`
- Verified Preview deployment: `dpl_3TrwLUwu5NMQRXk55jcYGaHpmvHk`
- Preview URL: `https://ask-sales-v4-isolated-rjnmvunh0-admin-88375990s-projects.vercel.app`

The lab is available only when `ASK_SALES_V4_ISOLATED=true` and `VERCEL_ENV=preview`. Its normal dashboard-auth bypass is limited to the exact lab page and marked through a sanitized internal request header. The deployment still uses Vercel Deployment Protection, the API requires a separate constant-time checked capability token of at least 24 characters, and both page and API are no-indexed.

The API is intentionally persistence-free. A transitive dependency validator checks the route and 16 local dependencies for Neon, SQL, conversation, feedback, history, or other write paths. The lab accepts at most ten messages of 6,000 characters each, rejects bodies above 70 KB, permits 20 requests per token per ten-minute window, and permits at most two concurrent model requests per token. These guards are in-memory because the clean-room path must not introduce a database.

## Hosted Model State

The code supports either an isolated direct DeepSeek credential or Vercel AI Gateway. The Preview is currently configured for Gateway selection, but `ASK_SALES_V4_MODEL_ACCESS_CONFIRMED=false` remains deliberate.

Actual account tests rejected DeepSeek V4 Pro, DeepSeek V4 Flash, and DeepSeek V3.2 for the available account tier and requested an upgrade. No credits, subscription, provider account, or upgrade was purchased. The final Preview readiness response is therefore `ready:false`; it also reports `modelConfigured:false` in the current runtime. Valid-token POST requests stop with HTTP 503 before any model call.

This is the correct fail-closed state. Enabling the flag without a successful live planner/composer/validator smoke would create a misleading lab.

The cleanest next option is to add an already-owned DeepSeek API key only to this isolated Preview and select direct transport. The alternative is explicit user authorization for Vercel AI Gateway credits/upgrade plus runtime OIDC confirmation. Either path must pass a real three-stage smoke before `ASK_SALES_V4_MODEL_ACCESS_CONFIRMED` can become `true`.

## Evaluation Harness

V4 includes:

- a redacted production launch-log exporter;
- a paired historical V3-versus-V4 replay runner;
- independent-gold and blind-judge schema support;
- need-level answer, partial, route, false-abstention, unsupported-claim, critical-claim, and latency metrics; and
- a fail-closed promotion gate.

The promotion gate requires adjudicated gold evidence, an independent judge, the same knowledge snapshot, zero unsupported claims, zero critical unsupported claims, zero technical failures, at least 90% weighted need utility, at most 5% false abstention, at least 90% route precision, and no V3 regression. A replay without those conditions is diagnostic only and cannot pass promotion.

## Final Verification

No local development server was started.

- Focused V4 tests: **102/102 passed** across runtime, retrieval, routes, fact guards, provider transport, evaluation, hosted-lab, and isolation suites.
- Full Ask Sales tests: **338/338 passed** across 23 files, including unchanged V3 provider behavior.
- Existing static Ask Sales validator: **107/107 passed**.
- New transitive V4 isolation validator: **10/10 passed**.
- TypeScript: passed with no errors.
- Scoped ESLint: passed with zero warnings.
- Optimized Next.js production build: passed and included only the two new isolated routes in addition to existing routes.
- `git diff --check`: passed.
- Independent clean-install parity on Node 22.13.1/npm 10.9.2: fresh `npm ci`, 338 tests, 107 static checks, 10 isolation checks, TypeScript, exact scoped ESLint, and the optimized build all passed without starting a server.
- The clean install exposed a critical advisory limited to Vitest 3.2.4's optional UI server. Vitest was patched to 3.2.7 and the entire verification matrix passed again; no Vitest/UI server was run.
- Final full and production-dependency audits both report 2 low, 4 moderate, 3 high, 0 critical. The production count matches the recorded base count, and no automatic audit fix was run.

Final historical launch replay artifact (ignored/local only):

`artifacts/ask-sales-faq-v4/paired-2026-07-21T17-07-33-635Z.json`

It replayed 78 real launch prompts without a model or judge:

- V4 lanes: 24 answer, 13 partial, 31 route, 5 clarify, 3 artifact, 1 live lookup, and 1 conversation;
- stored production V3 latency: p50 18,124 ms, p95 31,287 ms, average 19,149 ms;
- deterministic V4 latency: p50 80 ms, p95 120 ms, average 83 ms; and
- the final STOP, client-email, contract-review, airing-timeline, Tier-1, typo, show-list, and season-count regressions were manually rechecked.

A manual review of all answer/partial outputs found no explicit unsupported factual claim. That is useful safety evidence, but it is **not a quality score**: the historical rows span several V3 knowledge versions, V4 used only deterministic outage behavior, no adjudicated gold labels were present, and no independent judge ran.

## Production Isolation Proof

- Normal production selector remains V2/V3-only; V3 remains the selected live runtime.
- Normal `/api/ask-sales-faq` does not import V4.
- Normal `/ask-sales-faq` does not import or link the lab.
- Shared V3 provider code and tests were restored exactly to the branch baseline; V4 provider transport lives only in the V4 namespace.
- The isolated project contains only one final Preview deployment. Two earlier empty placeholder deployments, including an accidental Production-target 404 shell, were removed from the isolated project.
- Before GitHub publication, production project `prj_DwQt5q1eNv9WZwwc1IIa5zQvIH5e` temporarily received an exact experimental-branch ignored-build command. It was locally proven to return skip only for `agent/ask-sales-v4-isolated-2026-07-21`, then restored to its original `null` value immediately after publication.
- Vercel attempted branch deployment `dpl_DTL8ZcRARUQVMcQcAtCEDC7KpKSR`, but the already-known Preview resource-provisioning boundary failed before any application build. Production `main` remained `1641c3fb9b410aa5a0d43c68b41edb0d04fbfc2b`, and production deployment `dpl_8UxUBMivafKEQN7fiy5aVMdETEFw` remained `READY`.
- The production alias was not moved, no production deployment was created, and no lasting production-project reconfiguration remains.
- No Slack, Google, n8n, Neon, or production API write was made.

## Honest Readiness Assessment

The architecture, isolation boundary, UI/API, deterministic safety path, replay harness, and non-server verification are complete. The hosted model-backed product is not yet end-to-end proven, and V4 is not promotion-ready.

Before any production decision:

1. provide isolated model access without buying or upgrading anything unless explicitly authorized;
2. pass live planner, composer, and validator smoke tests in the protected Preview;
3. build and adjudicate a representative gold set from launch logs, including both correct routed answers and false abstentions;
4. run same-snapshot V3 versus V4 evaluation with an independent judge;
5. meet every promotion gate;
6. complete signed-in human review; and
7. authorize a separate cutover design, PR, deployment, health check, and rollback plan.

The saved policy-matching replacement is a different pending project. V4 does not implement or supersede `POLICY-MATCHING-REPLACEMENT-PLAN-2026-07-21.md`.
