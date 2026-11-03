# FAQ consistency and usefulness — November 3, 2026

Candidate implementation; release and final evaluation acceptance pending. Do not interpret this file as proof of production deployment.

## Problem and scope

Recent real answers sometimes retrieved retired spreadsheet/Keap outreach instructions without the already-ingested HubSpot governing policy. A separate answer used the old 9 PM outbound cutoff. These are source-reconciliation gaps, not evidence that all knowledge needs rewriting. Four technical failures among 504 recent questions included three provider timeouts; this is not an answer-accuracy rate.

This change is limited to Ask Sales FAQ. Preserve the current GPT-5.6 Luna medium configuration, prompts, retrieval scoring/budget, Coaching, n8n, authentication, environment and database schema. Slack and Google sources remain read-only; no messages sent. Use today's successful source snapshots and live read-only product navigation; the Drive plugin's current fetch endpoint was unavailable. Do not advance source scan watermarks or claim another full refresh.

## Changes

- Explicitly retire 16 wholly superseded records for sheet allocation/logging and outbound cutoff. Attach current governing records to 31 retained historical fragments (23 operational/KPI and eight ordinary refund fragments). Mixed Slack/channel ownership guidance survives with the distinct current didn't-book coordination rule. Preserve SMS/email timing, scheduled Sunday reality appointments, DNC and ownership exceptions.
- Add actual approved pre-audition/morning/no-show message copy to the existing SOP records, including truthful prior-attempt wording and rebooking eligibility. Preserve the distinction from after-Call-1 and buyer welcome messages.
- Keep the explicit main-ISTV versus Daymond John refund boundary beside older contract/video excerpts. Preserve separately scoped event fees and conditional deposits. The first held-out run exposed the missing relationship; do not characterize the subsequent corrected run as untouched held-out evaluation.
- Expand the existing booking SOP with documented First Call Public Calendar and Call 2 Personal Calendar notification verification. No invented automatic-delivery schedule.
- Add source-grounded KPI expectations with an explicit RPC/RPCT formula gap. Add verified Magic Mike Coaching/report/self-submission navigation and call-stage eligibility. The FAQ explains actions; it cannot perform them.
- Retry only the failed provider stage, once per entire request, for timeout or HTTP 502/503/504. Keep the normal 18-second per-call limit, allow up to 30 seconds only for the one recovery attempt, and enforce a 90-second provider-work deadline inside the 120-second route budget. All recovered answers still pass review/schema/evidence validation. Auth, quota/balance, malformed response and accounting failures are not retried. Existing attempt diagnostics plus retryCount expose recovery without storing rejected drafts.
- Remove parenthesized internal evidence aliases from displayed prose. Label the composer, announce loading accessibly, and avoid submitting during IME composition. No layout redesign or new UI dependencies.

## Validation approach

Freeze 60 real questions with actual bounded histories: 30 focused cases plus 30 held-out first turns. Run baseline and candidate with the same model/settings and cost ledger. Read answers, not just status labels: a truthful clarification or source gap is not a wrong answer; a confident obsolete instruction is. Preserve protected pricing, DNC, product separation and handoff boundaries. Test transient recovery deterministically as well as observing live provider behavior. Do not tune individual held-out wording.

Private evidence is in `.magic-mike-faq-consistency-2026-11-03/` outside both repositories. Initial evaluation costs and interrupted reservations remain accounted for. An initial governance test caught incorrectly labelled provenance for the two new resource records; corrected to the existing resource convention before final evaluation.

## Rollback

Revert this scoped FAQ change and its paired export if needed, preserving later independent changes. Knowledge-publication receipt must match the actual active hash. The November 3 source checkpoint remains the source coverage baseline; this reconciliation does not change which Slack/Drive material was scanned.

Evaluation found long useful answers finishing just below the old 18-second cutoff and repeated 18-second timeouts on two detailed questions. The recovery attempt therefore has a bounded 30-second allowance rather than repeating the same inadequate timeout. Normal calls remain at 18 seconds; there is still only one retry, with a 90-second total work deadline and no model/context expansion.

## Verified checks before publication

- 469 FAQ tests passed locally and in GitHub CI after the provenance and refund-relationship corrections, with TypeScript, scoped ESLint and production build passing. 107 static safety checks passed locally.
- The offline direct-query/prior-user-context retrieval audit covered 504 questions: 213 candidate sets changed; all stayed within 36 records. This is coverage/budget evidence, not 504 fact-checked answers or an accuracy score.
- Hosted preview builds and its sign-in boundary work. Preview intentionally has Google sign-in disabled; do not change auth to bypass that. Verify the authorized production release with the existing work-profile session and persisted answer metadata.
- A broad reality-materials request timed out in both the baseline and the first complete candidate run. Its answer-stage retry recovered, but its subsequent review timed out and correctly withheld the draft. The full post-refund-correction evaluation retains the earlier results and all new failures; it is not a retry-until-pass process. Recovery is resilience, not an outage-proof guarantee.

## Matched answer evaluation (completed before release)

Baseline `2a311e3228f32d41` / knowledge `54cf9e5a767fbf779b44d058`; initial complete candidate `c763cf322d60f28f` / knowledge `a97a64fc5b2e132a397f084b`; corrected final candidate `cd8fae8b12b1ea77` / knowledge `b1200af630bfa49e3b132326`. Each has all 60 frozen real questions with bounded real history. The final candidate has 2,592 active records (16 obsolete records retired, two resources added). The 30 initially held-out cases stopped being unseen after the first complete comparison. Final evaluation was a complete rerun after the refund relationship correction, not selective replacement of failures. All intermediate outputs and conservative failed-call cost reservations are retained privately.

Observed practical changes:

- The broad 20% SOP question now explains HubSpot Assign, 100/day, actual outbound Call records and separate Outreach fields instead of the old sheet/75-lead/Keap instructions.
- The KPI question now supplies documented rolling-30-day expectations and the current dashboard while explicitly retaining the missing RPC/RPCT denominator. It does not invent the formula.
- The no-show follow-up now contains approved copy, truthful prior-attempt wording and the distinction between one supplied template and the two-text requirement.
- The documentary refund question now includes the product-specific rule rather than only an old insolvency fragment. An initial candidate incorrectly introduced a generic three-day term; the family-level governing link corrected that before publication.
- Coaching navigation is now available in evidence and produced a useful reviewed answer in the first complete candidate. The final matched run hit an unclassified provider-response failure during review for that question; do not count its unseen draft as a successful delivered answer.
- Current payment plans, opt-out handling, separate reality/documentary rules and provisional filming dates remained represented in the inspected comparison. Exact template sources, terminology such as DFD, KPI formulas and individual account actions still have genuine coverage limits. This is not proof that every answer is correct.

Technical outcomes: baseline 1/60 failure; first complete candidate 1/60; final candidate 2/60 (one provider-invalid-response at review and one answer-timeout/recovery followed by review timeout). Final recovery succeeded for two other questions. Small sequential runs cannot establish an improved production failure rate. Median latency was 16.78 seconds baseline and 15.93 seconds final; final p95 was 53.97 seconds versus 34.36 seconds baseline because recovery allows a longer wait. The user-visible tradeoff is fewer immediate aborts for some transient failures, at the cost of occasional roughly one-minute waits. Do not claim zero failures or a statistically proven reliability gain.

The final model labels were 25 answer, 19 partial, four clarification, four action_route, three sales_advice, two knowledge_gap, one conflict and two technical_failure. These labels are not accuracy grades. A supported clarification, source limitation or human-only action can still be useful; a full-looking answer can still require review. No overall accuracy percentage is asserted.

Six additional fresh-wording checks completed without technical failures: current outreach, outbound hours, main documentary refund, DJ refund, separately scoped deposit uncertainty and Coaching/self-submission access. Their answers were inspected; the deposit question correctly did not transfer a one-on-one refund note to an unverified filming package. Total isolated evaluation spend, including intermediate runs and conservative failed-call reservations: approximately $1.8817 of the authorized $20 ceiling. No further broad model tuning was performed.

Release decision: accept the scoped source reconciliation and bounded recovery after passing automated checks and reviewed examples. Content usefulness improved on the targeted failures; there is no basis to claim perfect answers or a lower overall failure rate from this sample. Preserve the recorded source gaps and provider limitations for later observational review.
