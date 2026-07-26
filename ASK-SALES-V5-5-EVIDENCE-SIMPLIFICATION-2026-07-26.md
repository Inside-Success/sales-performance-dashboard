# Ask Sales V5.5 Evidence Simplification And Evaluation

Date: 2026-07-26

## Executive decision

V5.5 is a meaningful architectural improvement over frozen V5.4, especially for exact relationship matching, canonical package facts, broad approved-policy overviews, natural follow-ups, and avoiding stale temporary statements. It is the strongest isolated V5 candidate built so far.

V5.5 is **not approved to replace production V3 yet**. The available evaluation is diagnostic rather than promotion evidence: the previously used test sets are consumed, the 125 production-log questions have no independent source-only SME labels, model answer/route decisions still vary on some borderline wording, and latency has a long tail. V3 remains live and unchanged.

## Isolation and immutable baselines

- V5.5 runtime identity: `v5.5-isolated`.
- Dashboard draft PR: [#82](https://github.com/Inside-Success/sales-performance-dashboard/pull/82), stacked on frozen V5.4.
- Documentation draft PR: [#57](https://github.com/Inside-Success/faq-chatbot/pull/57), stacked on the V5.4 documentation branch.
- Production selector: unchanged; live production still selects V3.
- Frozen V5.4 commit: `3ccd714` and unchanged.
- V5.5 uses the existing isolated Preview-only API and lab; it does not persist conversations or bypass the Preview capability boundary.
- No production alias, Vercel environment, database row, n8n workflow, Slack message, knowledge release, or subscription was changed.
- No local development server ran.
- The saved production V3 policy-matching replacement remains separately pending.

## What V5.5 changes

### 1. Final raw question-to-record entailment

The final source decision compares each raw user need with raw approved records. A record can answer only when a verbatim supporting span exists and matches the requested actor, action, object, relationship, product, stage, duration, amount, and material qualifiers.

This prevents observed relationship reversals such as:

- a show catalog being used as an award list;
- installment amounts being used as package prices;
- “Amazon is only for VIP” being used as proof that VIP is only on Amazon;
- a Keap-specific disqualification condition being applied when Keap was not stated;
- a generic criminal-history rule being applied to an unspecified prison/incarceration case.

### 2. Publisher-time conflict ownership

The request runtime no longer tries to choose a policy winner merely because one source is newer or more senior. Materially incompatible publish candidates are identified for publisher/admin resolution and withheld at runtime. Rich remains the highest Sales authority when the exact decision is the same, while recency, scope, finality, and exact decision identity still matter; this is not a blind global name rule.

### 3. Controlled authoritative Slack support

Stable, reusable operational answers from Rich, Mike, Rudy, Raul, and Madeline may reach final entailment without being promoted globally. Case-specific, live-only, tentative, and explicitly temporary statements remain excluded. A statement limited to “right now,” “for now,” or “at the moment” cannot become durable policy merely because older metadata marked it stable.

### 4. Retrieval recall without V3 answer bypass

V5.5 adds raw lexical recall, resolved-subject queries for follow-ups, and publisher-sibling expansion. V3-style retrieval can help locate evidence, but V3 cannot answer through this isolated runtime. Every final sentence still passes the V5.5 source gate.

### 5. Exact and collective composition

- One exact record is preferred for one exact need.
- Genuine SOP, approved-guidance, complete-rule, and inclusion overviews may use a bounded non-conflicting set.
- If one atomic rule from a canonical approved article is selected for a broad overview, its non-conflicting canonical publisher siblings are included so an overview does not silently omit the rest of the article.
- Vague records such as “plus additional VIP items” cannot satisfy a broad “what else is included?” request. An enumerated package record must carry that answer.
- Verified source text is composed directly; the runtime skips a lossy second drafting pass when every need is already resolved.

### 6. Stable policy versus live owner action

Stable questions such as “may the applicant reschedule?” and “may I create a custom plan?” remain answerable from policy. Requests to create links, verify money, change a sheet, issue a Greenlight letter, or perform another live action still route to the responsible channel.

### 7. Natural conversation and routing language

Greetings, acknowledgements, safe rewrites, and immediate follow-ups remain conversation-aware. A fully answered record no longer receives a user-facing “unresolved” route merely because the underlying evidence originated as an operational support record. Eligibility cases that still require an owner decision continue to route.

## Evaluation protocol

The code was frozen before the final broad reruns. The last safety change added one deterministic incarceration qualifier after a manual audit; it was then rerun on the affected fresh case and both matching production-log cases. No answer-count tuning followed the final runs.

The evaluated sources were:

1. the consumed user-reviewed 50-case set;
2. the consumed independent 43-prompt set;
3. the consumed 13-case post-freeze Slack set;
4. the complete privacy-reduced non-admin production population available from 2026-07-13 through 2026-07-25: 125 responses, 82 conversations, 114 unique normalized questions, 25 multi-turn conversations, maximum four turns;
5. an independent 12-case owner-routing subset;
6. targeted source audits for the final high-risk corrections.

Lane counts are coverage diagnostics, not correctness percentages. Only a source-backed human judgment can label an answer correct.

## Results

### Complete production-derived population

| Runtime | Answer | Partial | Route | Other | Answer/partial | Provider attempts | Unsuccessful attempts | Mean | P50 | P90 | Max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Live V3 | 58 | 0 | 66 | 1 conversation | 58 | not comparable | not comparable | 18.6s | 17.2s | 26.4s | 36.3s |
| Frozen V5.4 | 41 | 9 | 69 | 3 artifact, 2 clarify, 1 conversation | 50 | 451 | 4 | 16.9s | 15.8s | 24.0s | 46.7s |
| V5.5 | 47 | 8 | 69 | 1 conversation | 55 | 228 | 6 | 14.4s | 12.3s | 28.2s | 45.3s |

V5.5 recovered five answer/partial outcomes over V5.4 while roughly halving provider attempts and improving mean and median latency. Its P90 is worse than V5.4 and its answer/partial count remains below V3. These totals do not establish which runtime is more correct.

### Consumed 50-case regression

V5.5 produced 27 answers and 23 routes with 88 successful provider attempts and no unsuccessful attempt.

- 24 of 30 answer-labelled cases answered.
- Six answer-labelled cases routed.
- Nine live-lookup cases routed.
- Three of four artifact-labelled cases routed; one returned safe search guidance.
- Five of seven route-labelled cases routed; two answered from later authoritative source evidence that invalidated the older label.

This set is useful for regression only. It was repeatedly used during V3–V5 development and cannot prove generalization.

### Independent 43-prompt regression

V5.5 produced 19 answers, one partial, 18 routes, and five natural conversation turns. All 64 provider attempts succeeded.

- 19 answer-labelled cases answered.
- One answer-labelled case partially answered.
- Five answer-labelled cases routed.
- All 12 route-labelled cases routed.
- The artifact-labelled case routed.
- Three conversation-labelled cases remained conversation turns; two answer-labelled social turns were handled as conversation.

The immediate previous V5.5 rerun produced the same 20 answer/partial total, though one borderline case moved between answer and partial. This is evidence of bounded model variance, not a score improvement.

### Fresh 13-case regression

The broad run produced nine answers, three partials, and one route. The post-audit prison qualifier changed the effective final result to nine answers, two partials, and two routes.

Strong source-backed results include current Cast Member HQ status, approved custom-plan and DJ rescheduling boundaries, old DJ lead follow-up, one-platform VIP wording, the Built For More script, multi-partner episodes, post-sale ownership, VIP bolt-on boundaries, internal subscriber-count protection, and contract screen-sharing.

Open results include:

- the prospect-recording-on-Zoom question still routes even though this dataset contains an answer;
- Money Mondays is only partially answered and routes current logistics;
- the prison-history gold conflicts with other scoped Slack evidence and lacks the exact offense/incarceration conditions. The final system routes rather than choosing a risky rule at runtime.

### Production smoke and manual source audit

The final 15-item production smoke produced 11 answers, one partial, and three routes. The corrected high-risk outcomes were manually inspected:

- awards question: safely routed; no show-list substitution;
- VIP platform question: answered “one Tier-1 platform” from current canonical evidence;
- VIP follow-up: answered with the actual enumerated VIP package row;
- 20 Percent Dial-Out SOP: returned all 17 verified rules, including no Sunday dialing, without a false unresolved message;
- America's Top Lawyers passoff overview: included all non-conflicting canonical article rules rather than one isolated atom;
- Apple/Tier-1 guarantee: correctly prohibited guarantees;
- upgrade deadline: correctly stopped at filming.

### Owner routing

The independent owner subset was 12/12 across Finance, Greenlight, Sales Policy, Sales Tech, and Fulfillment.

A separate non-independent diagnostic over 217 governed route cards was only 28/217 with 178 unclassified. That diagnostic is not a clean gold set: many stored “question families” are answer text or policy fragments rather than user routing questions. It still exposes a real maintenance weakness in route-card normalization and means 12/12 must not be presented as universal routing proof.

## Verification

- Focused V5.5 and isolated API tests: 25/25 passed.
- TypeScript: passed.
- ESLint: passed after removing one unused local variable.
- Complete Ask Sales suite: 851/851 passed across 52 files after raising one retrieval-heavy test timeout from five to ten seconds.
- TypeScript and zero-warning ESLint: passed.
- Optimized Next.js production build: passed.
- All 50, 43, 13, 15-smoke, 125-production, and targeted safety runs completed.
- No local server ran.

## Honest assessment

V5.5 is headed in the right direction and is not another cosmetic iteration. It directly fixes the failure class that motivated the redesign: retrieval can locate broadly, but only exact raw evidence may authorize an answer. It also makes broad governed overviews and follow-ups materially more useful without giving V3 a direct answer bypass.

It is still not proven ready to replace V3. The largest remaining gaps are:

1. no independent source-only SME labels for the complete production distribution;
2. model variability on borderline answer-versus-route decisions;
3. false abstentions where source evidence exists, such as the Zoom-recording case;
4. incomplete or conflicting source governance in a few high-impact areas, especially criminal-history eligibility;
5. P90/max latency and six recovered provider failures in the 125-response run;
6. route-card question-family normalization is not mature enough for broad measured recall.

## Recommendation and next gate

Keep V3 live. Do not promote, merge into the production selector, or change the production alias yet.

The next step should be a blind, source-only SME comparison of V3 versus V5.5 on a preregistered stratified sample drawn from the 125 production questions plus genuinely new questions. Score correctness, harmfulness, completeness, route destination, conversational continuity, and latency. Require:

- zero critical/harmful wrong answers;
- zero wrong action owners;
- a meaningful human-scored utility lead over V3, not merely more answers;
- acceptable repeatability on the same high-impact questions;
- an agreed latency ceiling;
- explicit stakeholder approval.

If V5.5 passes, use an isolated Preview and then a small reversible canary before any full replacement. If it does not materially beat V3 under blind review, stop runtime tuning and repair the governed knowledge/route-card records before another architecture iteration.
