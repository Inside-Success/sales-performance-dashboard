# Ask Sales V5.1 implementation and evaluation

Date: 2026-07-24

## Decision

V5.1 is a meaningful improvement over the frozen V3 baseline on this new set, but it is **not approved for production replacement**. It answered substantially more questions, yet one high-confidence relationship error produced a clearly unrelated answer. Two live-action questions also went to the wrong Slack owner. The safe decision is to keep V3 live and keep V5.1 isolated.

No preview deployment was created because the post-freeze safety gate failed. A preview would not add evidence until the runtime defect is fixed in a new candidate.

## What changed in V5.1

- Added an explicit decision contract for actor, action, polarity, workflow stage, route owner, and operational effect.
- Added deterministic routing for Finance, Greenlight, Sales Tech, Fulfillment, and Sales Questions.
- Kept live mutation requests separate from stable policy questions.
- Prevented generic contract-link nouns from being treated as action requests.
- Repaired multi-need planning so a compound question is not copied into every atomic need.
- Added exact-definition protection and stricter same-decision selection.
- Forced controlling authority policies above ordinary rank cutoffs.
- Preserved Rich's three-month reapplication rule as controlling over lower authority.
- Added approved Slack knowledge for emergency payment links, changed payment arrangements, multi-episode recommendations, Next Level CEO filming timing, and other verified decisions.
- Removed backend `unresolved` phrasing from answered user-facing V5 responses while retaining route metadata.
- Preserved complete isolation: no production selector change, no database writes, no history persistence, and no V3 mutation.

## Verification before the sealed test

- Ask Sales suite: 43 files, 798 tests passed.
- TypeScript: passed with `tsc --noEmit`.
- Lint: passed.
- Isolation checks: 15/15 passed.
- Secret scan and `git diff --check`: passed.
- Webpack production build: passed.
- The ordinary Turbopack build was blocked only by this worktree's external `node_modules` symlink boundary; it was not an application compile failure.
- No local development server was run.

Consumed development diagnostics also completed with zero provider failures:

- Prior 50-question set: 33 answers, 1 partial, 14 routes, 2 controlled-artifact outcomes.
- Prior fresh 20-question development set: 10 answers, 2 partials, 7 routes, 1 artifact outcome before the final targeted repairs.
- Five-turn conversation diagnostic: 4 answers and 1 correct Finance route.

Those consumed sets were useful for development only. They are not promotion evidence.

## Post-freeze sealed comparison

Candidate freeze: `45fc2ac`

Dataset SHA-256: `47c17252e611c819153d62842e602d7b7a958d8358a8795bd6a87180063644dd`

Both systems completed all 20 cases with zero provider failures.

| Manual result | V3 | V5.1 |
|---|---:|---:|
| Correct/useful answer or correct action route | 3 | 9 |
| Partially useful but incomplete | 0 | 2 |
| Safe abstention / safe but unhelpful route | 14 | 6 |
| Incorrect Slack owner | 3 | 2 |
| Incorrect direct answer | 0 | 1 |

Raw runtime lanes:

- V3: 20 routes, 0 direct answers.
- V5.1: 9 direct answers, 11 routes.

For the 9 V5.1 direct answers, manual review found 6 correct, 2 incomplete, and 1 incorrect. For the five questions whose correct outcome was an action route, V5.1 routed 3/5 to the correct owner; V3 also routed 3/5 correctly, but on a different subset.

## Manual case audit

| Case | V5.1 assessment | Key result |
|---|---|---|
| 01 | Safe omission | Did not find the package upgrade/downgrade form navigation. |
| 02 | Safe omission | Did not answer the five-minute Zoom wait rule. |
| 03 | Correct route | Routed the refund action to Finance. |
| 04 | Correct route | Routed the payment/contract system failure to Sales Tech. |
| 05 | Safe omission | Did not recover the Keap-notes verification procedure. |
| 06 | Wrong owner | Sent an onboarding booking action to Sales Questions instead of Fulfillment. |
| 07 | Safe omission | Did not recover the social-support email/Money Mondays guidance. |
| 08 | Partial | Correctly said to ask about prior contact, but omitted recording it in Keap notes. |
| 09 | Correct route | Routed the current greenlight PDF/access request to Greenlight. |
| 10 | Wrong owner | Sent a Keap login failure to Sales Questions instead of Sales Tech. |
| 11 | Safe artifact abstention | Did not invent a Daymond intro URL, but did not surface the approved Slack file. |
| 12 | Correct | Answered the twice-daily call rule and claimed-lead meaning. |
| 13 | Correct | Distinguished `no answer` from explicit `no interest`. |
| 14 | Correct | Correctly allowed grand-opening footage as B-roll. |
| 15 | Partial with material omission | Said the contract may be shared, but omitted the authoritative caution that doing so before payment is not advised. |
| 16 | Correct | Put the rescheduled Call 1 under rescheduled stats, not new scheduled calls. |
| 17 | Safe omission | Did not answer that Standard-to-VIP upgrades are allowed before filming. |
| 18 | Correct with irrelevant preface | Correctly said where to enter notes and that leads cannot see them. |
| 19 | Correct | Applied Rich's compliance rule on marketing questions and spend amounts. |
| 20 | Incorrect answer | Answered a back-to-back Call 1 time-management question with an unrelated 20-percent-lead procedure. |

## Root-cause findings

The result confirms that the main remaining problem is not just missing knowledge.

1. **A fallback can override a correct source-plan abstention.** On case 20, retrieval found the directly relevant `back-to-back-call-time-management` record, but it was marked route/support only. A focused retry then promoted an unrelated `previously-claimed-twenty-percent-lead` card and answered with 100 confidence. The earlier source plan itself said the unrelated cards were irrelevant. This is a systemic control-flow defect, not a missing-answer wording issue.

2. **Action routing still depends too much on model request-kind labels.** The onboarding and Keap-login questions were recognizable live actions, but a `knowledge` label caused the deterministic owner rules to fall back to Sales Questions.

3. **Stable authoritative Slack answers are still being compiled as contextual support.** Several exact source records existed but were not answer-eligible, causing avoidable abstention on stable operational rules.

4. **Material qualifiers can be dropped.** The contract-before-payment answer preserved permission but lost the important `not advised` limitation because a narrower email-before-signing record was selected.

## Honest assessment and next gate

This architecture is moving in the right direction: it tripled correct/useful outcomes on the sealed set from 3 to 9 and kept most uncertain cases fail-closed. It is not yet safe enough to replace production because a sales tool cannot confidently answer an unrelated policy, and live-action routing must be dependable.

The next candidate should be V5.2, not an edit to this frozen V5.1 result. It should make four systemic changes:

1. Prohibit retry or fallback evidence from contradicting the source planner's decision object, actors, action, and workflow stage.
2. Compute live-action ownership deterministically from the original user request before model planning, then prevent the model from changing that owner.
3. Compile authoritative Slack replies into answer-eligible stable rules only when their scope and time stability are explicit; keep current links, access, and one-off actions route-only.
4. Require every material condition and caution from the controlling source to survive composition and validation.

After that code is frozen, it needs a new Slack-backed holdout whose replies are not opened until after the freeze. This 20-case set may be retained for regression diagnosis but must not be used to prove V5.2 readiness.

## Safety record

- Production V3 was not changed or redeployed.
- No production aliases or environment variables were changed.
- No Slack messages, reactions, edits, or other writes were made.
- No local development server was run.
- No new subscriptions or services were created.
