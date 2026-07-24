# Ask Sales V5.2 controlled-decision implementation and evaluation

Date: 2026-07-24

Status: implemented, frozen, verified, and manually evaluated in isolation. V5.2 is materially safer than production V3 on a genuinely unseen source-backed Slack set, but it is less useful overall and does not pass the production-replacement gate. V3 remains live and unchanged. No V5.2 Preview was promoted or manually deployed.

## Plain-language decision

V5.2 solved part of the problem, not the whole problem.

It cut critical failures from nine in V3 to three by preventing several confident wrong rules and by routing sensitive live actions. It also resolved the Rich-versus-Madeline reapplication conflict correctly as three months. However, it answered too few of the unseen questions whose answers existed in the source material. Its manually reviewed utility was 35%, below V3's 43.75% on the same 40 cases.

The safe decision is therefore:

- keep V3 in production;
- retain V5.2 as the isolated safety/control-plane baseline;
- do not spend another iteration adding question-specific V5 matcher patches;
- build the next candidate around governed hybrid retrieval over all approved atomic source records, with the V5.2 authority, owner, conflict, and qualifier controls around it.

## Frozen implementation

- Dashboard branch: `agent/ask-sales-v5-2-controlled-decision-2026-07-24`
- Base head before V5.2: `64fa0918036dfb9082e51c514018315e46c70f61`
- Runtime freeze: `5aff892`
- Initial source-selection freeze: `fa53da6`
- Replacement source-selection freeze: `1eaace1`
- Source-only gold freeze: `ac6ad8c`
- Production selector changed: no
- Production database or workflow changed: no
- Slack writes: none
- Local development server run: no
- Manual Preview deployment: no; the promotion evidence failed first

## What V5.2 added

### 1. Non-bypassable decision identity

Every source selected by the model, deterministic recovery, retry, or fallback must match the original need's distinctive actors, action, object, stage, polarity, and operational effect. A broad topic neighbor is not enough.

This directly targets the V5.1 failure where a back-to-back appointment question received a 20-percent-lead answer.

### 2. Contextual authority, not a fixed speaker rule

Authority selection considers all of these together:

- whether the records address the exact same decision;
- organizational role;
- specificity and explicitness;
- effective date and recency;
- source finality and material conditions.

Rich normally outranks Madeline as Head of Sales, but that is not an unconditional override. A materially newer, exact, explicit Madeline decision can beat a very old or general Rich statement. Close or unresolved conflicts fail closed. The tested reapplication conflict resolves to Rich's three-month rule because his record is the exact controlling decision and is not stale enough to be displaced.

### 3. Owner binding before model planning

Clear live actions are bound from the original request before the model can relabel them:

- payments, refunds, commissions, and transaction confirmation to Finance;
- Greenlight letters and live approval actions to Greenlight;
- CRM, calendar, recording, and access failures to Sales Tech;
- onboarding and post-sale delivery actions to Fulfillment;
- remaining case-specific sales-policy decisions to Sales Questions.

### 4. Conservative stable-rule compiler

The V5.2 compiler reviewed 2,624 policies, including 1,750 operational policies, and promoted 91 stable reusable operational rules into answer evidence. It rejects volatile dates and quantities, current links/status, live finance or Greenlight actions, case-specific eligibility, uncertain/deictic replies, and conflict-prone cohort or reapplication records unless separately governed.

Raw Slack replies are never treated as automatic truth. Only reviewed, attributable, scoped records can become answer evidence.

### 5. Material-condition preservation

The answer contract checks that cautions, exceptions, conditions, and operational effects from the controlling source survive paraphrasing. A permissive answer that drops a material caution is withheld rather than presented as complete.

### 6. Evaluation governance

The final 40 cases came from the read-only Sales Questions channel and had reliable threaded replies. The runtime and parent-message selections were committed before replies were opened. Eighteen initially selected parents overlapped previous fixtures; they were removed from promotion evidence and replaced from previously unread threads. The final 40 parent timestamps are unique and absent from earlier evaluation fixtures.

The test set intentionally contains both answerable knowledge and action/current-state requests. Unsafe thread content such as unverified allegations, unverified episode titles, and case-specific criminal eligibility was not blindly copied into gold answers.

## Unseen 40-case result

Artifact: `artifacts/ask-sales-faq-v5-2/fresh-slack-v3-v52.json`

Manual source review: `artifacts/ask-sales-faq-v5-2/fresh-slack-v3-v52-manual-review.json`

Run SHA-256: `1d09d0b5c17e945802a0635550eb51af4e166b75e21b5688a4381f09244ca7ab`

Both V3 and V5.2 completed all 40 requests with zero model-provider failures. The AI judge was not the promotion authority; every result was manually checked against the sealed source-only record.

| Manual result | V3 | V5.2 |
|---|---:|---:|
| Correct/useful answer or exact correct route | 13 | 10 |
| Safe and useful but incomplete | 9 | 8 |
| Safe but unhelpful, non-resolving, or wrong owner | 9 | 19 |
| Critical confident mistake or relation mismatch | 9 | 3 |
| Weighted utility | 17.5/40 (43.75%) | 14/40 (35%) |

Raw V5.2 lanes were 10 answers, three partials, one controlled-artifact result, and 26 routes. V3 returned 16 answers and 24 routes.

### Meaningful V5.2 improvements

- It used Rich's controlling three-month reapplication rule.
- It correctly denied a separate Daymond meeting.
- It correctly required rescheduling when the prospect was a passenger in a moving car.
- It preserved the English-only/no-Spanish-promise boundary.
- It routed Greenlight, pending-felony, and refund actions more safely.
- It avoided V3's serious Keap-versus-HubSpot, wire handling, cross-side selling, upgrade-contract, Master Calendar, Zoom-recording, discount-exception, and show-transfer mistakes.

### Remaining unacceptable failures

- Fresh relation mismatch: an ISTV-to-NLCEO movement question received an unrelated delayed-Call-2 answer.
- Fresh irrelevant preface: a criminal-history route included an unrelated canceled-lead rule.
- Wrong owner: a commission action went to Sales Questions instead of Finance.
- Wrong owner: two onboarding/delivery actions went to Sales Questions instead of Fulfillment.
- Avoidable abstentions remained on documented rules including 20-percent outreach, HubSpot, promotional activities, Built for More scripts, Tier 1, SAG, time-zone handling, family-member email compliance, and English-only materials.

This means V5.2's safety controls work, but its primary knowledge-access path does not generalize well enough.

## Consumed diagnostic sets

These are regression evidence only and cannot justify promotion.

### Previous reviewed 50

Artifact: `artifacts/ask-sales-faq-v5-2/retained-previous-50-v52.json`

- 50/50 completed, zero provider failures.
- 31 answers, one partial, 16 routes, and two controlled-artifact outcomes.
- V5.1 previously produced 33 answers, one partial, 14 routes, and two artifact outcomes on this known set.

V5.2 broadly retained known-set behavior but became slightly more conservative. The contrast between this strong retained replay and the weak unseen result confirms the user's overfitting concern: success on already-consumed questions is not reliable evidence of fresh generalization.

### Five-turn conversation diagnostic

Artifact: `artifacts/ask-sales-faq-v5-2/retained-conversation-v52.json`

- Five of five requests completed with zero provider failures.
- Four were answered and one correctly routed to Finance.
- Conversation memory and the natural follow-up worked.
- One contract answer dropped the screen-sharing/not-advised caution.
- One earliest-SMS answer was unsupported even though the old gold expected a route.

Conversation handling is functional, but retrieval and qualifier grounding remain the limiting factors.

## Verification

- Focused V5.2 tests passed.
- Evaluation-governance tests passed.
- TypeScript passed.
- ESLint passed with no reported errors.
- Ask Sales isolation validation passed 15/15.
- Stable-rule audit passed with 91 promotions and a matching snapshot count.
- The optimized Next.js production build passed.
- `git diff --check` passed.
- The full Ask Sales suite passed 808/808 tests across 47 files.
- No local development server was started.

One retrieval test took about four seconds alone and crossed Vitest's default five-second limit only under full-suite worker contention. Its test timeout was raised to 15 seconds without changing the assertion or runtime behavior; it passed independently before that harness-only adjustment.

## Honest architecture conclusion

V5.2 is a forward step in safety but not a production candidate. It should not replace V3, and repeatedly adding deterministic matches to V5 would recreate the same overfitting loop.

The next candidate should be a governed hybrid retrieval architecture:

1. Keep V5.2 as the control plane for owner binding, decision identity, authority, conflicts, and qualifier validation.
2. Store every approved atomic source record in a versioned retrieval index with claim ID, actors, action, object, scope, conditions, authority, effective date, stability, route owner, and source reference.
3. Use lexical/BM25 and embedding retrieval together only as candidate generation. Do not let vector similarity directly authorize an answer.
4. Use model-generated query variants for recall, then require an exact relation/entailment reranker to prove that a candidate answers the actual decision.
5. Compose only from cited approved claims, and validate that every material qualifier is preserved.
6. Route current-state, live-action, volatile, close-conflict, and unsupported needs to their exact operational owner.
7. Connect the existing approved knowledge-refresh workflow to immutable index versions only after admin approval, with rollback and no raw-Slack auto-publication.
8. Freeze that runtime before another high-quality source-only unseen set; use blind/manual review as the promotion authority.

This is not a recommendation to discard all V5 work. It is a recommendation to stop treating a small static promotion set and handcrafted matching as the primary recall mechanism.

## Production and pending work

- V3 remains the only normal production runtime.
- No production alias, workflow, database, Slack message, or knowledge release was changed.
- V5.2 must remain isolated and unmerged.
- The separate saved V3 policy-matching replacement remains pending and was not implemented, superseded, or folded into V5.2.
