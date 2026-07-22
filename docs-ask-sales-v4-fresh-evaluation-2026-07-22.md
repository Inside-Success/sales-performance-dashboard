# Ask Sales V4 Fresh Source And Production-Log Evaluation Protocol

Date: 2026-07-22

Status: **frozen before answer generation; diagnostic evaluation only; no production or promotion authority.**

Provider amendment before valid generation: the initial post-freeze command found that Vercel correctly withheld locally pulled values for sensitive direct API-key variables. Both runtimes therefore used their fail-closed no-model paths and the judge could not run. That invalid artifact is excluded from evidence. The paired evaluator was amended and re-frozen to inject fresh V3 with the same existing V4 DeepSeek Gateway provider via `runAskSalesFaqV3`'s dependency option. This changes no V3 runtime logic, retrieval, evidence, answer, validation, production selector, or live environment. Valid fresh runs use the same DeepSeek model, Gateway transport, disabled reasoning mode, zero provider fallback, and short-lived local OIDC authorization for both systems.

## Purpose

This evaluation checks whether isolated V4 generalizes beyond the retained 78-question replay and whether it would have helped on recent real production questions. It deliberately separates:

1. fresh authoritative Slack source-gold questions, which measure generalization; and
2. redacted recent production-log questions, which measure both the historical V3 user experience and a fresh current V3-versus-V4 comparison.

The result will be judged holistically. There is no fixed 90% or 95% target. Correct routing, safe partial help, unsupported-claim avoidance, follow-up quality, directness, reliability, and latency all matter alongside answer coverage.

## Frozen Datasets

| Cohort | File | Cases | Conversations | SHA-256 |
| --- | --- | ---: | ---: | --- |
| Fresh authoritative Slack | `tests/ask-sales-faq/v4-fresh-slack-source-gold-2026-07-22.json` | 13 | 12 | `7d994f94612f70db1d4fb82b15501ee2d539bec8a541b6a8add667de329f8f74` |
| Recent production V3 log replay | `tests/ask-sales-faq/v4-live-v3-log-replay-2026-07-22.json` | 16 | 10 | `fdaf638163864d8cfecb978170cedcec2ccc90fe2836ea116fad8cbfa4cdfe8b` |

The production snapshot was created by the existing one-`SELECT` redacted exporter. It covers 2026-07-13 13:00 UTC through the export boundary on 2026-07-22, contains 88 assistant turns in 59 hashed conversations, excludes viewer identity and free-text feedback, and has SHA-256 `6ffe442b834814d49578006af673c40b583b2cf852960109c410b7b4e7440486`.

## Source Selection And Gold Rules

- Slack was read only. No message, reaction, edit, deletion, upload, or other Slack write was made.
- Fresh cases use only redacted questions with a reliable threaded response from Sales Ops, the Head of Sales, Sales Ops and Training, or a directly confirmed operating owner.
- Tentative, contradictory, sensitive, live, or artifact-dependent details are labeled for clarification or precise routing instead of being forced into an answer.
- The production-log cohort includes good V3 answers, likely false abstentions, routed-but-correct answers, user corrections, artifacts, a short typo, multi-turn questions, and negative-feedback cases.
- Feedback is context, not factual gold. A down-voted route can still be correct, and an up-voted answer can still be incomplete.
- Gold was decomposed into atomic needs before generation. V3 and V4 responses are not evidence sources.
- The saved five-case sealed holdout remains sealed, unopened, and unused.

The fresh-contamination validator compared the 13 Slack prompts with 242 prior tracked questions. There were no exact or near-duplicate failures. The closest prior lexical match had Jaccard 0.2667. The same validator passed source traceability and redacted-question PII checks.

## Preregistered Diagnostic Runs

All generation uses the frozen candidate/evaluator commit produced with this protocol. No runtime, retrieval, policy, synonym, boundary, or question-specific change is allowed between these runs.

### Episode A - fresh Slack generalization

- dataset: fresh authoritative Slack source gold;
- V3 source: fresh runtime;
- V3 model adapter: evaluator-injected V4 DeepSeek Gateway provider (`--v3-provider=v4`);
- V4 source: fresh isolated runtime;
- runs: three;
- order: deterministic alternating V3-first/V4-first;
- model-backed provenance required;
- blind A/B diagnostic model judge enabled;
- promotion enforcement disabled.

### Episode B - recent logs, fresh current architectures

- dataset: recent production V3 log replay;
- V3 source: fresh runtime;
- V3 model adapter: evaluator-injected V4 DeepSeek Gateway provider (`--v3-provider=v4`);
- V4 source: fresh isolated runtime;
- runs: three;
- order: deterministic alternating V3-first/V4-first;
- model-backed provenance required;
- blind A/B diagnostic model judge enabled;
- promotion enforcement disabled.

This episode measures current end-to-end V3 versus current isolated V4. It does not erase the historical answers users actually received.

### Episode C - historical V3 user experience replay

- dataset: recent production V3 log replay;
- V3 source: captured production answer;
- V4 source: fresh isolated runtime;
- runs: one;
- order: alternating where applicable;
- model-backed V4 provenance required;
- blind A/B diagnostic model judge enabled;
- promotion enforcement disabled.

This episode answers the practical question: how would one isolated V4 run compare with the answer the rep actually received? It mixes historical V3 knowledge versions by design and cannot isolate architecture quality.

## Scoring And Interpretation

Need-level scoring keeps answering and routing separate. The report must include:

- weighted need utility;
- fully answered, useful-partial, correctly routed, and false-abstained needs;
- route precision and exact route-key correctness;
- unsupported and critical unsupported claims;
- follow-up/context behavior and correction handling;
- V3/V4/tie diagnostic preference;
- provider failures, retries, and technical fallbacks;
- p50 and p95 latency; and
- source segment and case-level review, especially every disagreement and every negative-feedback case.

V4 should be called better only if the improvement is broad rather than driven by a few cases, safety does not regress, correct routes remain correct, and the gains survive repeated runs. A more natural answer that invents policy is worse. A safe route for a genuinely unresolved live fact is correct. A technically correct route that withholds available governed help is still a utility defect.

The built-in judge is diagnostic and uses the same provider family. It is not an independent human or SME and cannot approve promotion. Manual engineering review must inspect all judge disagreements, unsupported-claim flags, false abstentions, provider failures, and routed negative-feedback cases.

## Anti-Overfitting Rule

These exact questions must not be added to runtime code, synonym lists, policy cards, or deterministic matchers. No answer-quality defect found here may be fixed and retested on the same fresh set as proof of generalization. A systemic fix, if justified later, needs a new untouched evaluation set.

## Safety And Isolation

- V3 production remains the sole live runtime and must not be changed, merged, promoted, or redeployed by this evaluation.
- The evaluation runs in-process test scripts only. No local development server may be started.
- Production Neon access is limited to the already completed redacted one-`SELECT` export. No Neon write or schema helper is allowed.
- V4 remains on its isolated branch and protected Preview project with no company-source or persistence write path.
- No Slack, Google, n8n, GitHub issue/comment, Vercel plan, subscription, purchase, or external-message write is part of generation.
- The local Gateway adapter uses only a short-lived OIDC token and does not retrieve, print, copy, or persist a production or Preview DeepSeek API key.
- Raw generated artifacts remain local and git-ignored. Only redacted datasets, hashes, summarized results, verification evidence, and documentation may be committed.
- The pending saved policy-matching replacement remains separate and untouched.

## Promotion Boundary

Even an excellent result here is diagnostic evidence, not production approval. Canonical promotion still requires independently supplied source-only SME gold, the separately preregistered at-least-ten-case sealed holdout, exact provider parity, a clean canonical run, blind human scoring, stakeholder acceptance, and a new explicit cutover authorization.
