# Ask Sales V5.4 Coverage And Consensus Evaluation

Date: 2026-07-25

## Executive decision

V5.4 is a meaningful recovery from V5.3 and it generalizes to several genuinely unseen Slack questions, but it is not safe enough to replace production V3.

The new candidate answers substantially more source-backed questions than V5.3, restores natural greetings and acknowledgments, and correctly routes most live Finance, Greenlight, Fulfillment, and Sales Tech actions. However, a post-freeze fresh holdout exposed one high-impact relationship mismatch and one wrong action owner. The older 43-prompt gate also contains an incorrect refund follow-up caused by relationship carryover. Those are production blockers because a salesperson could act on the wrong rule.

Production V3 remains live and unchanged. V5.4 remains isolated, unmerged, and diagnostic-only.

## Frozen scope

- Implementation branch: `agent/ask-sales-v5-4-coverage-consensus-2026-07-25`
- Dashboard draft PR: [#81](https://github.com/Inside-Success/sales-performance-dashboard/pull/81)
- Documentation draft PR: [#56](https://github.com/Inside-Success/faq-chatbot/pull/56)
- Runtime freeze commit: `d4e426c3c816a48faa85226c3295ddd63a5e0ec5`
- Holdout selection commit: `9c8747125feecfd254e603a17a639c5fd18e4659`
- Timestamp correction commit: `924070e`
- Runtime identity: `v5.4-isolated`
- Knowledge layer: `coverage-consensus-r4`
- Production selector: unchanged; production still selects only V2/V3.

The runtime was committed before the fresh Slack questions and gold answers were selected. No runtime or knowledge code was changed after fresh outputs were revealed.

## What V5.4 changes

### 1. Broader governed knowledge admission

V5.3 admitted too little reusable Slack knowledge. V5.4 evaluates operational source records for authority, recency, scope, volatility, uncertainty, sensitivity, and whether the record describes reusable policy or a live one-off action.

- Effective corpus: 2,625 policies.
- V5.4 governed operational promotions: 92.
- Every promotion retains source IDs, approvers, review date, decision identity, and risk metadata.
- A first broad classifier would have admitted 543 records. Its audit exposed legal, quota, temporary, and live-case records, so it was rejected before freeze. The final classifier admits 92 only.

Rich does not win through a blind global rule. Exact decision, scope, recency, finality, and authority are evaluated together. Rich's reviewed three-month main-ISTV reapplication rule remains controlling. A newer, specific Madeline decision can still control a different or genuinely superseded decision.

### 2. Effect-aware source consensus

The old conflict logic could treat two differently worded sources that meant the same thing as a conflict. V5.4 groups evidence by material decision and operational effect. Aligned sources can support one answer; opposite permission, incompatible numbers, or incompatible obligations still fail closed.

### 3. Recall without V3's answer bypass

V5.4 can use V3 retrieval as candidate generation, but V3 cannot answer directly. Candidates must still pass V5 decision identity, relation, material-condition, authority, action-owner, and sentence-grounding gates.

Retrieval now preserves more direct candidates across compound needs and anchors to the user's wording. A bounded exact-source fallback can answer only when a complete, single decision is already resolved by governed source evidence.

### 4. Deterministic action ownership

Live action requests are bound before knowledge generation:

- payment verification or financial action -> `#sales-finance-requests`
- Greenlight action or letter update -> `#greenlight-requests`
- post-sale/onboarding action -> Fulfillment hotline
- system, link, spreadsheet, or record mutation -> `#sales-tech-requests`
- unresolved reusable sales policy -> `#sales-questions-requests`

Stable policy questions may still be answered; the chatbot must not claim it completed a live action.

### 5. Conversation handling

Greetings, acknowledgments, safe rewrites, out-of-scope conversation, and an automatic-approval correction are handled separately from policy retrieval. Follow-up questions still pass through policy relation checks instead of inheriting an answer merely because it appeared earlier in the conversation.

## Evaluation design

Three sets were run with the same frozen code and DeepSeek provider:

1. The previously independent 43-prompt gate, now regression-only.
2. The user's previously reviewed 50 questions, now regression-only.
3. A new 13-question Slack holdout selected after runtime freeze.

The new 13 were selected read-only from `#sales-questions-requests`. Unanswered, speculative, personal, low-quality, and non-authoritative threads were excluded. Gold answers were written from Rich or Madeline's threaded resolution before V3 or V5.4 was run.

- Dataset SHA-256: `1e47a4c2460e265ade95ab636973b329950f7b4b5867be669f9d2a60b98e019b`
- V5.4 fresh runtime SHA-256: `3a51f22d7615296f32491594eddf11dac87d399b350b0f9114406481c355f586`
- Prior-43 runtime SHA-256: `93f9475debe03e4ce67a8a26fd0acf61ddbc5d31bcfc4935ba79c56efc4dfc4f`
- Prior-50 runtime SHA-256: `0dd0229144fc9ec69cc28b756e260b4e0a6bfa226400a23d7ae9968af3a6ab45`

Lane counts were not treated as correctness. The source-backed manual review below controls the assessment.

## Results

### Prior independent 43 prompts

| System | Pass | Partial | Fail | Critical | Weighted utility |
|---|---:|---:|---:|---:|---:|
| V3 | 21 | 9 | 10 | 3 | 25.5/43 = 59.3% |
| V5.3 | 10 | 7 | 26 | 0 | 13.5/43 = 31.4% |
| V5.4 | 18 | 12 | 12 | 1 | 24/43 = 55.8% |

V5.4 recovers 10.5 weighted points over V5.3 and removes two of V3's three critical errors. It still trails V3 by 1.5 weighted points and retains one critical error: after a DJ refund question, the main-ISTV follow-up answered with an unrelated package-upgrade rule.

On the 13 conversation prompts, V5.4 scored four pass, five partial, three fail, and one critical. Greetings, acknowledgments, out-of-scope conversation, and automatic-approval correction improved materially. It still missed international and refund follow-ups, and the incorrect refund relationship makes the conversation layer not production-ready.

### User-reviewed retained 50

| System | Pass | Partial | Fail | Critical | Weighted utility |
|---|---:|---:|---:|---:|---:|
| V5.3 | 44 | 4 | 2 | 0 | 46/50 = 92% |
| V5.4 | 43 | 4 | 3 | 0 | 45/50 = 90% |

V5.4 produced 31 answers, 16 routes, two controlled-artifact responses, one partial lane, and zero provider failures. It remains strong on the known set but is slightly worse than V5.3. The remaining failures include Love Experts status, the one-platform wording in one phrasing, and supporting greenlight documents being sent to Greenlight instead of the source-approved Fulfillment destination.

This set cannot establish promotion because it is heavily consumed and was used throughout earlier development.

### Fresh post-freeze Slack 13

| System | Pass | Partial | Fail | Critical | Weighted utility |
|---|---:|---:|---:|---:|---:|
| V3 | 0 | 0 | 13 | 0 | 0/13 = 0% |
| V5.4 | 6 | 2 | 4 | 1 | 7/13 = 53.8% |

All 13 V3 outputs safely routed to Sales Questions. V5.4 answered seven, partially answered one, and routed five. Six answers were fully source-correct:

- Built For More uses the Next Level CEO script.
- prospects may not record sales calls on Zoom.
- three business partners may appear in one episode, with onboarding controls.
- production/studio executives own the post-sale relationship.
- webpage and social-rebrand deliverables are not lower-package bolt-ons.
- internal subscriber counts must not be shared.

The one-platform answer was useful but incomplete because it omitted submission to another platform after rejection.

The production blocker was the prison-history question. V5.4 retrieved an unrelated multi-partner/attendance rule and began with a confident `Yes` before routing the unresolved part. This is the exact relationship-contamination class the architecture is meant to prevent. It is one case, but one high-impact wrong relationship is enough to fail the promotion gate.

The fresh set also exposed false abstentions for the current Cast Member HQ status, old DJ lead follow-up, Money Mondays, and contract screen-sharing. The Cast Member HQ case was sent to Sales Tech rather than answered from the recent authoritative source.

## What the evidence means

V5.4 is not a wasted iteration. It proves that broader governed admission plus effect-aware consensus can generalize: six unseen source-backed questions that V3 refused were answered correctly. It also moves the old 43 from 31.4% in V5.3 to 55.8%.

It is also not the final solution. Its usefulness is still inconsistent by wording, and the exact relation boundary can fail when two policies share generic people/call language. The retained 50 remains easier than genuinely fresh data, so high retained accuracy must not be mistaken for readiness.

The architecture direction remains viable, but the current candidate must not be promoted. The next work should be a narrow safety-and-coverage repair on the frozen evidence model, not another wholesale V6 rewrite and not question-specific patches:

1. Make post-retrieval entailment reject evidence unless the source decision answers the user's exact actor, action, object, stage, and operational effect. This must catch the prison/partner and refund/upgrade leaks generically.
2. Add one owner-resolution table driven by operation and object, then verify every known Finance, Greenlight, Fulfillment, Sales Tech, and Sales Policy case. Do not let a keyword override the underlying operation.
3. Separate `current artifact unavailable` from `system mutation requested`; a missing share link is not automatically a Sales Tech action.
4. Improve admission/selection for recent complete authoritative decisions while keeping tentative, volatile, legal, and live-case evidence routed.
5. Re-run only consumed diagnostics during development. Freeze again before one more independent SME-selected or stakeholder-selected holdout.
6. Require zero critical errors, zero wrong owners, a material utility lead over V3, and strong conversation/follow-up results before an isolated Preview or shadow/canary.

If that narrow repair cannot eliminate relation contamination without losing the recovered coverage, stop pursuing this implementation and reassess the retrieval/entailment stack. Do not merge V5.4 as-is.

## Verification

- 829/829 Ask Sales tests across 51 files passed.
- 38/38 focused V5.2/V5.3/V5.4 tests passed before freeze.
- 15/15 isolation checks passed.
- TypeScript passed.
- ESLint passed with zero errors.
- Optimized Next.js production build passed.
- All 43 prior-gate, 50 retained, and 13 fresh prompts completed; no terminal provider failure occurred.
- Fresh 13 had zero provider failures; retained 50 had zero provider failures. Prior 43 had one unsuccessful intermediate provider attempt and zero terminal failures.
- Architecture audit and source-coverage audit run through checked-in package scripts.
- The first governed GitHub run completed all 827 tests but Vitest reported a worker RPC timeout after one 60.8-second recall file. That unchanged coverage was split into four smaller files; the runtime was not modified.
- No local development server ran.

## Safety and production isolation

- Production V3 code, selector, deployment, alias, database, authentication, and stored conversations were not changed.
- Slack was read only. No message, reaction, edit, join, draft, or file action occurred.
- n8n and the governed refresh/publisher workflows were not changed or executed.
- No Vercel production or Preview deployment was created in this phase.
- No subscription or paid service was added or upgraded.
- The DeepSeek credential was loaded only into one ephemeral shell environment, then unset. It was not written to a file, artifact, commit, or command.
- The existing approved knowledge-refresh workflow remains the long-term publication path. V5.4 derives from the governed effective corpus; its 92-record admission audit must rerun whenever that corpus changes.
- The saved production V3 policy-matching replacement remains separately pending and was not implemented or superseded.

## Final recommendation

Keep V3 in production. Preserve V5.4 as the strongest coverage-oriented diagnostic candidate, but do not merge, deploy, or replace V3 with it.

Authorize only one narrow V5.5-style repair if the project continues: exact relation entailment, owner resolution, and current-artifact classification, followed by a new independent holdout. Do not spend another iteration merely increasing answer count or tuning the consumed 43/50/13 questions.
