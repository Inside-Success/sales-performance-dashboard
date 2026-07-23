# Ask Sales V4.3 Knowledge And Routing Implementation And Evaluation

Date: 2026-07-23

Status: **implemented, source-reviewed, frozen, and evaluated in isolation. V4.3 failed the production replacement gate. V3 remains live and unchanged.**

## Decision

Do not replace production V3 with V4.3. This iteration made real improvements, especially on Rich-over-Madeline authority, exact high-impact conflict closure, live-action ownership, complete-condition preservation, and rep-facing route language. However, a new 40-case source-backed evaluation selected only after freeze found that V4.3 still falsely abstains on too many answerable questions and still makes several exact-relationship or route-owner mistakes.

The work is not wasted: it gives the project a safer authority and action-routing foundation, identifies the remaining architectural bottleneck with clean unseen evidence, and prevents another question-by-question tuning loop. It is not yet a production candidate.

## Isolation And Freeze

- Dashboard branch: `agent/ask-sales-v4-3-knowledge-routing-2026-07-23`
- Base V4.2 commit: `283ce474bda95df84356c13c0c6c05f50a88c098`
- Preregister commit: `691bc1575614e25c24d23dda4e2b9a9cdbe7cefc`
- Frozen runtime commit: `d8a8332b5b593cc7cfdb8ebfcb4bd4ef32ecbbe6`
- Freeze-record commit: `60218cf13005b6d29486edeef019d03eb29c5f57`
- Runtime was frozen before the unseen source records were selected or opened.
- No runtime or knowledge change was made after the freeze.
- Production V3, its selector, API, database, authentication, Slack, n8n, and Vercel alias were not changed.
- No local development server was started.

## What V4.3 Added

1. **Rich precedence at the exact decision level.** Rich Allen, Head of Sales, now outranks Madeline or Raul when they conflict on the same product, action, object, conditions, and policy decision. This does not let a broad Rich statement control an unrelated decision. The normal main-ISTV reapplication minimum is three months.
2. **Current governed authority supplement.** Twenty-six source records compile into 29 reviewed policies, including screenshots, the Mike/Rich meeting transcript, and authoritative Slack threads. Every record preserves speaker, role, timestamp, scope, conditions, and lineage.
3. **Conflict closure.** A claim-scoped resolution cannot be reopened merely because the model reports a related conflict. High-impact money, contract, deadline, eligibility, and compliance decisions fail closed when the exact controlling source is missing or contradictory.
4. **Relationship matching.** Candidate selection now compares the decision object, relation, product, actor, action, polarity, lifecycle, and material conditions instead of trusting broad topic similarity.
5. **Complete-condition preservation.** A completeness-locked authority source can replace an incomplete paraphrase with the complete approved decision, such as the phone-plus-Zoom-recording workaround.
6. **Original-action routing.** Live Finance, Greenlight, Fulfillment, Sales Tech, current artifact, and record-mutation requests are classified from the original request even if a model paraphrase softens the action.
7. **Natural route wording.** V4.3 no longer exposes internal phrases such as `Unresolved` or `Determine whether` in the rep-facing response.
8. **Systemic regression coverage.** New tests cover Rich precedence, unrelated-policy rejection, live versus reusable requests, artifact identity versus discovery, wire handling, full-condition preservation, route ownership, false model abstention recovery, and source-compiler precedence.

The historical generated operational Q&A remained byte-for-byte identical to V4.2. V4.3 adds a governed layer and runtime controls instead of rewriting the old corpus to fit the reviewed 50 questions.

## Development Evidence From The User-Reviewed 50

The user's feedback on all 50 comparison cases was preserved as development evidence only. It was used to identify systemic failure families, not to add question IDs or one-off answer overrides.

- Final full development replay: 28 direct answers, 3 partial answers, 19 routes, and zero generic fallbacks.
- A focused final check correctly handled the full wire-payment sequence, the phone/Zoom recording workaround, upgrade-form discovery, and the Sales Tech leaderboard route.
- Rich's three-month main-ISTV reapplication decision overrides Madeline's conflicting same-decision duration.

These results show that the targeted implementation worked on known failure families. They do not prove unseen quality and were not used for promotion.

## Frozen Unseen Evaluation

After freeze, 40 unique source records were selected from a 285-record sealed Slack candidate pool. The selection excluded all V4.3 supplement sources, prior evaluation and reviewed-50 sources, the one record exposed during pre-freeze tooling inspection, and classifier records found during source review to have joined unrelated thread content. Questions were paraphrased and sanitized only after selection.

The final set contained:

- 20 answerable policy questions;
- 12 live/action/route questions;
- 8 ambiguous or mixed questions; and
- explicit-context follow-ups evaluated with the same context for all systems.

All 40 source threads and every system answer were manually reviewed. One overbroad gold need asking for an unrequested channel-access mutation was removed before the final score. The final comparison contains 45 genuinely asked atomic needs.

### Runtime completion

| System | Main lanes | Provider failures | Average latency | P95 latency |
| --- | --- | ---: | ---: | ---: |
| V3 | 15 answers, 25 routes | 0 | 17.8 s | 27.2 s |
| V4.1 | 16 answers, 6 partials, 3 clarifications, 15 routes | 0 | 10.1 s | 17.2 s |
| V4.3 | 18 answers, 1 partial, 1 artifact, 20 routes | 0 | 18.4 s | 30.1 s |

Lane counts are not correctness scores.

### Dual-pass diagnostic judge

| System | Weighted utility | Critical unsupported |
| --- | ---: | ---: |
| V3 | 45.5 | 0 |
| V4.1 | **55.2** | 0 |
| V4.3 | 44.0 | 0 |

The same-model judge agreed with itself on the preferred system in 77.5% of cases and on per-need status in 83.3%. Twenty of 40 cases were consensus ties. It was useful for triage, but it accepted wrong or incomplete route ownership often enough that it is not promotion evidence.

### Manual source-backed review

| Outcome | V3 | V4.1 | V4.3 |
| --- | ---: | ---: | ---: |
| Correct or materially helpful needs | **31/45 (68.9%)** | 25/45 (55.6%) | 23/45 (51.1%) |
| Fully correct | 11 | 13 | 11 |
| Useful correct partial | 9 | 4 | 2 |
| Correct route | 10 | 7 | 9 |
| Correct clarification | 1 | 1 | 1 |
| Answerable false abstention | 7 | **5** | 11 |
| Incorrect or unsupported | **7** | 15 | 11 |

V3 is the strongest system on this frozen source review. V4.1 is faster and has fewer false abstentions, but its wrong-route and incorrect-answer count is too high. V4.3 reduces V4.1's unsafe/wrong count and removes internal route wording, but it gives up too much answer recall and still does not beat V3 overall.

## What The Judge Missed

The judge ranked V4.1 first, while manual source review ranked V3 first. The reversal came mainly from exact operational ownership and relationship checks that the judge treated too generously. Examples include routing a current payment action to Sales Questions instead of Finance, routing an onboarding recording to Sales Tech instead of Fulfillment, and accepting related operational text that did not answer the requested decision.

This confirms the user's concern: the AI judge is useful as a second opinion, not as the final authority.

## Remaining V4.3 Failure Families

1. **False abstention despite exact available knowledge.** V4.3 routed answerable questions about the Built for More script, Keap notes, five-year ISTV placement, the outbound news article, publicly approved result examples, and other stable rules.
2. **Exact relationship mismatch.** V4.3 answered a call-volume question with a Call 2 reschedule rule, explained changing daily-stat totals using the correction-thread procedure instead of the known technical glitch, answered ownership-credit review with the contact-at-start procedure, and answered an SOP request with the first-rep ownership rule.
3. **Wrong or incomplete action owner.** Finance, Fulfillment, Greenlight, and Sales Tech were still confused on several compound or naturally phrased actions.
4. **Incomplete object or condition matching.** V4.3 sometimes reached the right prohibition through the wrong artifact or attached an unrelated condition to a partially correct process.
5. **Latency.** V4.3 is substantially slower than V4.1 and slightly slower than V3 in this run.

## What Clearly Improved

- Rich's exact three-month rule is enforced over Madeline's conflict.
- High-impact explicit authority resolutions no longer reopen as generic conflicts.
- The reviewed wire, phone/Zoom, upgrade-discovery, and leaderboard cases are corrected systemically.
- Direct live Finance requests now route correctly in the natural imperative form.
- V4.3 produced zero provider failures and zero generic runtime fallbacks in both the 50-case development replay and frozen 40-case evaluation.
- The literal internal `Unresolved` label appeared in 11 V3 answers, 23 V4.1 answers, and **0 V4.3 answers**.
- No critical unsupported answer was found in the unseen run.

## Verification

- `npm run test:ask-sales-faq`: 37 files and 748 tests passed.
- `npm run validate:ask-sales-faq:v4:isolation`: 15/15 passed.
- Fresh-evaluation integrity, source traceability, and privacy validation passed.
- Scoped ESLint over every changed implementation and test file passed.
- `npx next build --webpack` passed TypeScript, compilation, page generation, and route collection.
- Turbopack's default worktree build could not follow the intentionally shared `node_modules` symlink outside the worktree root; this is why the valid webpack production build was used.
- `git diff --check` and anchored staged-secret scanning passed.
- No local development server ran.

## Honest Recommendation

Keep V3 in production. Do not merge, deploy, or promote V4.3.

The next candidate should not be another patch over these 40 questions. It should replace the remaining weak knowledge-access path:

1. compile the complete current authoritative corpus into atomic, source-verifiable decisions rather than relying on a small hand-curated supplement plus a noisy historical generated layer;
2. add hybrid semantic/vector retrieval for recall, but keep exact authority, scope, relation, condition, contradiction, and live-action gates after retrieval;
3. make route ownership a deterministic first-class decision before answer retrieval, including compound actions with more than one owner;
4. require source entailment and full-condition checks for every promoted Slack decision;
5. measure retrieval recall separately from answer generation so missing knowledge and selection failure cannot be confused; and
6. freeze that new architecture before using another untouched source-backed evaluation set.

This is a justified V4.4 direction, not authorization to implement or promote it. The saved production V3 policy-matching replacement remains separately pending and was not implemented or superseded.

## GitHub Publication

- Dashboard draft PR [#74](https://github.com/Inside-Success/sales-performance-dashboard/pull/74) contains the isolated V4.3 candidate and this result record.
- FAQ documentation draft PR [#49](https://github.com/Inside-Success/faq-chatbot/pull/49) contains the matching governance, current-work, and restart records.
- Both PRs are intentionally draft and unmerged because V4.3 failed the replacement gate.
