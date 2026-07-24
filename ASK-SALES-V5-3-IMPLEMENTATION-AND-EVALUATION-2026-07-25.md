# Ask Sales V5.3 evidence-admission implementation and evaluation

Date: 2026-07-25

Status: implemented and verified in the isolated V5 branch. V5.3 is materially safer and more useful than V5.2 on the source-reviewed 40-case diagnostic, and it performs strongly on the user's previously reviewed 50. It is not promotion-ready because every evaluated case is now revealed and 12 of the 40 source-answerable cases still receive avoidable non-resolving responses. Production V3 remains live and unchanged.

## Outcome in plain language

V5.3 fixed the most important failure class: it no longer treats broad topical similarity as permission to answer a different decision. It also makes a carefully bounded set of recent authoritative Slack rules available as dated answer evidence, while current state, mutable artifacts, live work, sensitive eligibility decisions, and close conflicts continue to route.

The result is a real improvement, not a perfect chatbot:

- source-reviewed 40: 21 pass, seven partial, 12 fail, zero critical; weighted utility 24.5/40 (61.25%);
- the same 40 previously scored V3 at 17.5/40 (43.75%) and V5.2 at 14/40 (35%);
- previously reviewed 50: 44 pass, four partial, two fail, zero critical; weighted utility 46/50 (92%);
- all 90 full-run cases and three targeted high-risk cases completed with zero provider failures.

These are consumed diagnostics. The 92% retained result is useful regression evidence but cannot support production promotion. The 61.25% source-gold result shows meaningful progress while also exposing remaining recall/admission misses.

## Isolated implementation

- Branch: `agent/ask-sales-v5-3-evidence-admission-2026-07-25`
- Runtime freeze: `d8f3867`
- Base V5.2 evaluation head: `fcb199348116f155db0e03359d6e99756e22090b`
- Draft stacked dashboard PR: [#79](https://github.com/Inside-Success/sales-performance-dashboard/pull/79)
- Draft stacked documentation PR: [#54](https://github.com/Inside-Success/faq-chatbot/pull/54)
- Production selector changed: no
- Database/history persistence added: no
- Slack, n8n, Google, Vercel production, and production aliases changed: no
- Local development server run: no

### Seven-stage diagnosis

The initial diagnostic separated the pipeline into source presence, admission, top-k retrieval, source planning, composition selection, route ownership, and final answer quality. This showed that the primary problem was not model prose. For the 26 answer-expected source-gold cases, exact lineage existed for 23, but only 15 were answer eligible and only eight reached the retrieval window. The implementation therefore changed evidence admission and retrieval rather than adding question-answer patches.

### Governed knowledge tiers

V5.3 keeps one immutable knowledge snapshot and classifies operational evidence into four tiers:

1. `stable_answer`: already governed, reusable answer evidence;
2. `active_scoped_answer`: a small set of recent, source-attributed, reusable rules that satisfy strict release-relative admission;
3. `historical_support`: useful for context and conflict review, but not enough to answer;
4. `live_route_only`: current state, mutable artifacts, one-off cases, and live operations that must route.

The compiler retained 91 V5.2 stable promotions and admitted 17 recent active-scoped rules. Active-scoped answers must carry their effective date. Numeric, temporal, high-risk, or sensitive rules require senior operational authority; unresolved, uncertain, case-specific, mutable, stale, or live-state material remains non-answering.

### Bounded hybrid retrieval and exact decision control

- Direct retrieval is anchored to the user's atomic wording.
- Model paraphrases and query expansion may improve recall but cannot redefine the question.
- Each need has a bounded maximum of 12 direct and four expansion candidates; a compound turn remains capped at 24 total candidates.
- Retrieval preserves the highest-scoring atomic decision inside a multi-decision policy instead of allowing a weaker fragment to overwrite it.
- Exact authority resolutions can select only their registered controlling policy IDs and exclude known neighboring policies.
- The source planner, retry, fallback, composition, and validator all remain inside the same decision identity and material-condition contract.

### Authority and conflict handling

Authority is not a blind name ranking. Exact decision identity, product scope, material conditions, specificity, finality, recency, and role are evaluated together. Rich normally outranks Madeline because he is Head of Sales, but a materially newer exact Madeline decision can control when it clearly supersedes an older or broader position. Close or unresolved conflicts fail closed.

Rich's reviewed three-month main-ISTV reapplication minimum is now the canonical controlling answer. A lower-scoring atomic fragment can no longer overwrite it during retrieval fusion, and source-plan retry/recovery preserves that canonical wording.

### Route ownership and sensitive cases

V5.3 binds live work to one of five owners before model planning:

- Finance: `#sales-finance-requests`;
- Greenlight: `#greenlight-requests`;
- Sales Tech: `#sales-tech-requests`;
- Fulfillment: the fulfillment hotline;
- Sales Policy: `#sales-questions-requests`.

Reusable knowledge questions remain answerable. Current mutations, account-specific checks, artifacts, and case-specific decisions route. Sensitive criminal-history or reputation cases cannot borrow general red-flag guidance; an explicit Greenlight action goes to Greenlight and another case-specific eligibility decision goes to Sales Policy.

### Source-reviewed corrections

- The Call 2 manual-booking fallback now uses the complete reviewed source: do not edit or use the Master Calendar; create a Google Calendar appointment, create a new Zoom meeting, and email the prospect the Zoom link.
- Bank-closure deadline exceptions no longer retrieve a neighboring Monday rejection-letter schedule.
- Cross-program transfer is distinct from moving a deal forward.
- Qualification guidance is separated from case-specific approval.
- Built for More script selection, Tier 1 submission count, SAG, phone onboarding, promotional-clause meaning, swag, and other stable decisions use the same generalized retrieval path.

The broad saved V3 policy-matcher replacement remains pending and was not implemented or folded into V5.3.

## Human source review

The controlling artifact is `artifacts/ask-sales-faq-v5-3/human-source-review-d8f3867.json`. It grades outputs against source-only gold and the user's authority corrections. Raw answer/route counts and AI-judge output are not promotion authority.

### Source-gold 40

| Result | V3 | V5.2 | V5.3 |
|---|---:|---:|---:|
| Pass | 13 | 10 | 21 |
| Partial | 9 | 8 | 7 |
| Fail | 9 | 19 | 12 |
| Critical | 9 | 3 | 0 |
| Weighted utility | 17.5/40 | 14/40 | 24.5/40 |
| Weighted rate | 43.75% | 35% | 61.25% |

V5.3's raw lanes were 14 answers, three partials, 22 routes, and one controlled-artifact response. Manual review—not lane counts—produced the quality result above.

Important improvements include the complete Call 2 booking procedure, correct three-month reapplication rule, correct bank-closure boundary, correct Built for More script, correct SAG answer, correct Daymond boundary, correct sensitive-case routing, and correct Finance/Greenlight/Sales Tech/Fulfillment ownership in the reviewed action cases.

The 12 remaining failures are mostly false abstentions where usable source knowledge exists: 20-percent outreach, HubSpot, cross-program reapplication, upgrades, cohort deadline handling, Tier 1 placement, time-zone procedure, failed-payment discount evidence, family-member email handling, no-show-rate interpretation, and acting-only/no-business qualification. These should be addressed through governed source-record admission and general retrieval behavior, not question-ID rules.

### Previously reviewed 50

V5.3 produced 32 answers, 16 routes, and two controlled-artifact outcomes. Human review scored 44 pass, four partial, two fail, and zero critical. The two avoidable failures were Love Experts status and the one-Tier-1-platform rule. This set was already reviewed by the user and repeatedly used during development, so it is regression evidence only.

The retained six-month gold label for the reapplication case is superseded by Rich's reviewed three-month decision. Later reviewed sources also make the direct Zoom-link and OnceHub first-text questions safely answerable despite older route-only labels.

## Verification

- Targeted live-model high-risk replay: 3/3 completed, zero provider failures; Call 2 answered from the exact reviewed policy, and both criminal-history cases routed to the correct owner.
- Full source-gold 40: 40/40 completed, zero provider failures.
- Full retained 50: 50/50 completed, zero provider failures.
- Admission/retrieval probes: 10/10.
- Ask Sales tests: 820/820 across 48 files.
- Isolation validation: 15/15.
- TypeScript: passed.
- ESLint: passed with zero warnings.
- `git diff --check`: passed.
- Optimized Next.js production build: passed.
- Secret scan of committed evaluation files: passed.
- Local development server: not run.

## Honest promotion decision

Do not replace production V3 yet.

V5.3 is headed in the right direction and is the first V5 iteration in this sequence to beat both V3 and V5.2 materially on the same 40 source-gold cases while eliminating critical errors in that review. However, the 40 and 50 are revealed, the current result still contains 12 avoidable failures, and no independent sealed post-freeze human-gold set has run against this final code.

The next gate is not another broad rewrite. Freeze V5.3, select a genuinely untouched, high-quality, stratified Slack set with reliable threaded answers, create source-only gold independently of runtime output, and run V3 and V5.3 blind. Promotion should require zero critical wrong-decision answers, correct owner routing, materially higher usefulness than V3, acceptable follow-up/natural-conversation behavior, and stakeholder approval. If that gate passes, use an isolated Preview and then a limited shadow/canary before any production switch.
