# Ask Sales V5.3 independent promotion gate

Date: 2026-07-25

Status: completed in isolation. V5.3 failed the preregistered independent promotion gate and must not replace production V3. The result is decisive enough that the optional repeatability run was stopped; repeating it could not reverse the failed usefulness, conversation, or action-owner thresholds. Production V3 remains live and unchanged.

## Decision in plain language

The earlier V5.3 result was a real safety improvement on revealed development material, but it did not generalize to this independent set. On 43 newly selected prompts, blind manual source review found:

| Independent human review | V3 | V5.3 |
|---|---:|---:|
| Pass | 21 | 10 |
| Partial | 9 | 7 |
| Fail | 10 | 26 |
| Critical | 3 | 0 |
| Weighted utility | 25.5/43 (59.3%) | 13.5/43 (31.4%) |
| Wrong live-action owners | 3 | 5 |

Head-to-head, V5.3 won four prompts, V3 won 19, and 20 tied. V5.3 eliminated the three critical V3 mistakes, which is important, but it became far too reluctant and lost the natural conversation and follow-up behavior required by the product. Safety improved; overall usefulness did not.

The honest decision is therefore **do not promote V5.3**. This does not mean the V5 work was wasted: it isolated the safety controls worth keeping and exposed the exact architectural gaps that must be fixed next. It does mean that continuing to loosen or patch V5.3 against already revealed questions would be the wrong approach.

## What was implemented

No candidate runtime or knowledge was changed. The implementation was an independent, reproducible evaluation and promotion gate around frozen V5.3 runtime commit `d8f38678e85023ade37e9f4bf61d582f6cbbb2c8`:

- a source-only Slack gold set sealed before model output;
- a validator proving no source overlap with earlier evaluation fixtures and artifacts;
- an alternating paired V3/V5.3 runner with stateless standalone cases and stateful conversations;
- deterministic A/B blinding with a separate unblind key;
- explicit blind human source grades, with AI judging excluded from promotion authority;
- preregistered safety, usefulness, route-owner, conversation, and stakeholder gates;
- a reproducible post-gate knowledge-access diagnostic.

The pre-output seal is commit `72b71dc6dbcbd8a43127aebfe8a973569499c98c`. The dataset hash is `3ce9873f6203d8775bbe663530ecbf1fbf019d94d89b36e10137a9ac59ddbe63`.

## Independent dataset

The set contains:

- 30 standalone questions;
- six conversations containing 13 prompts;
- 43 total prompts;
- 69 unique read-only Slack source messages;
- zero overlap with 147 source timestamps already used by prior evaluation fixtures or artifacts.

Every standalone question had a reliable threaded Slack reply. The set covers stable rules, conflict/supersession, relationship ownership, action routing, controlled artifacts, sensitive cases, numeric and scope boundaries, greeting, acknowledgment, rewrite, topic switch, immediate referent, correction, compound qualification, and natural out-of-scope handling.

Source gold and thresholds were written before runtime output. Neither V3 nor V5.3 was tuned after the questions or replies were opened.

## Promotion gate result

The preregistered technical gate required all of the following:

1. V5.3 weighted utility at least ten percentage points above V3;
2. zero V5.3 critical errors;
3. zero V5.3 wrong live-action owners;
4. at least 75% V5.3 conversation weighted utility;
5. complete provider-backed outputs and safe repeatability;
6. stakeholder approval before any production change.

Actual result:

- usefulness lead: failed; V5.3 trailed V3 by 27.9 points;
- critical-error ceiling: passed; V5.3 had zero while V3 had three;
- exact action ownership: failed; V5.3 had five wrong owners;
- conversation utility: failed; V5.3 scored 1/13 weighted (7.69%) versus V3 at 9.5/13 (73.08%);
- output completeness: passed; both systems completed 43/43 with no terminal provider failure;
- repeatability: not run after the primary gate failed decisively;
- stakeholder approval/cutover authorization: absent.

The two recovered V5 provider attempts did not create a terminal failure. Raw lane counts were not used as quality scores because a routed answer may still contain useful or incorrect claims.

## What the source review found

V3's three critical failures were exactly the kind of mistakes V5 was designed to prevent:

- it replaced first-booked-call ownership with a negotiate-between-reps rule;
- it replaced first-contact ownership with a negotiate-between-reps rule;
- it suggested that a rep could approve a serious criminal-history case rather than requiring Rich's case-by-case decision.

V5.3 avoided those errors. Its problem was over-abstention and wrong workflow ownership:

- 26 of 43 V5.3 outputs failed to resolve the question;
- greetings, thanks, rewrites, topic switches, and immediate referents frequently fell into generic policy routing;
- post-sale onboarding and Mastermind actions went to Sales Questions instead of Fulfillment;
- a live payment-link defect went to Finance instead of Sales Tech;
- a live 20-percent-list update went to Sales Questions instead of Sales Tech;
- a controlled split-payment follow-up went to Sales Questions instead of Sales Tech.

## Bigger root cause: not just missing knowledge

The diagnostic distinguishes knowledge freshness from retrieval/admission behavior.

Of 40 source-backed prompts, only 15 had at least one exact selected source ID already present in the frozen V5 answer-evidence corpus; 25 did not. The current governed KB is therefore missing substantial newer authoritative Slack material. That is a real source-refresh/release coverage problem.

However, missing knowledge does not explain the whole failure:

| Source-coverage stratum | Prompts | V3 utility | V5.3 utility |
|---|---:|---:|---:|
| At least one exact source present | 15 | 46.7% | 33.3% |
| Exact selected sources absent | 25 | 68.0% | 34.0% |
| Natural turns without a policy source | 3 | 50.0% | 0.0% |

V5.3 remained weak even when exact source lineage was present. Its own runtime metadata exposed false conflict/admission decisions. For example, the contract-amendment case retrieved multiple aligned `no edits` sources, yet the source controller labelled them conflicting and routed because no claim-scoped resolution existed. The model analysis itself said no conflict existed.

The non-pass diagnostic categories overlap because one prompt may have more than one cause:

- 18 missing or unretrieved knowledge;
- 14 conflict or authority-resolution problems;
- six evidence-admission problems;
- six conversation-handling problems;
- five wrong action owners;
- three other incomplete answers.

This means the next solution must address the whole knowledge-access pipeline. Merely adding more Slack text will not fix false conflict handling, and merely lowering thresholds will recreate V3's critical mismatches.

## Correct next architecture

Do not discard the V5 safety work, and do not promote the current V5.3 implementation. Build a new isolated candidate that combines V3's recall/conversation strength with V5's decision safety:

1. **Governed knowledge completeness.** Use the existing read-only discovery, admin approval, immutable release, and publisher workflow to compile every approved reusable Slack decision into atomic answer evidence. Current actions, mutable links/files, and case decisions remain route-only. This is a governed release problem, not permission for raw Slack answering.
2. **Claim-level consensus before conflict.** Normalize each source into an atomic decision, polarity/effect, scope, conditions, authority, and effective date. Sources that say the same thing must reinforce one decision instead of being treated as conflicts. Only opposite effects on the exact same decision enter conflict resolution.
3. **Decision-scoped authority and recency.** Resolve genuine opposing claims by exact scope, conditions, finality, recency, and role. Rich normally outranks Madeline, but a newer exact Madeline decision may control an older broad Rich statement. Close genuine conflicts still fail closed.
4. **V3 as recall, never final authority.** Let broad V3-style retrieval contribute candidate source claims, but require the V5 exact-decision, condition, authority, and validation contract before any claim reaches the user. This retains recall without inheriting V3's three critical answers.
5. **Deterministic live-owner precedence.** Classify a live action from the original request before retrieval. Finance, Greenlight, Sales Tech, Fulfillment, and Sales Policy must be mutually checked against workflow stage and object. A generic policy route cannot overwrite a recognized operational owner.
6. **Separate conversation control plane.** Handle greeting, thanks, rewrite/style requests, topic switches, corrections, and out-of-scope conversation before policy retrieval. This layer may transform or acknowledge already grounded content but cannot introduce policy facts.
7. **Two independent future gates.** First test retrieval only on unseen paraphrases whose controlling sources are confirmed present in the frozen KB. Separately test knowledge freshness by passing newly approved sources through the refresh/release path. Mixing absent-source freshness cases into a retrieval-only score hides the responsible layer.

The 43 prompts are now revealed development diagnostics. They may be used as regression tests but cannot become promotion evidence or question-specific runtime rules. A later candidate must freeze before another independently selected, coverage-aware Slack gate.

The separate saved production V3 policy-matching replacement remains pending and was not implemented, superseded, or folded into this evaluation.

## Safety and isolation

- Production V3 selector, routes, code, data, authentication, deployment, and alias changed: no.
- Slack access: read-only; no message, edit, reaction, or other Slack write occurred.
- n8n, Google, database, Vercel production, subscription, and external-service writes: none.
- Candidate runtime/knowledge tuning after source reveal: none.
- Local development server: not run.
- Invalid no-provider dry-run artifacts were discarded and were never scored.

## Evidence artifacts

Final verification passed:

- independent dataset validator: 43 prompts, 69 unique Slack source messages, zero overlap with 147 prior evaluation sources;
- paired real-model execution: 43/43 V3 and 43/43 V5.3 outputs, zero terminal provider failures;
- Ask Sales tests: 820/820 across 48 files;
- isolation validation: 15/15;
- TypeScript: passed;
- full ESLint: passed with zero warnings;
- optimized Next.js production build: passed;
- diff and secret scans: passed;
- local development server: not run.

- `tests/ask-sales-faq/v5-3-independent-slack-gold-2026-07-25.json`
- `artifacts/ask-sales-faq-v5-3-independent-gate/primary-runtime.json`
- `artifacts/ask-sales-faq-v5-3-independent-gate/primary-blinded-packet.json`
- `artifacts/ask-sales-faq-v5-3-independent-gate/primary-blinded-human-review.json`
- `artifacts/ask-sales-faq-v5-3-independent-gate/primary-unblind-key.json`
- `artifacts/ask-sales-faq-v5-3-independent-gate/primary-unblinded-score.json`
- `artifacts/ask-sales-faq-v5-3-independent-gate/knowledge-access-diagnostic.json`
