# Ask Sales FAQ Policy Guard Enforcement

Date: 2026-07-08

## What Changed

The Ask Sales FAQ runtime now enforces the generated FAQ policy guard before any model call.

Runtime order:

1. Redact sensitive text.
2. Evaluate the current user question directly against `ASK_SALES_FAQ_POLICY_RULES`.
3. If the direct guard reaches default abstain and the current message is a short conversational follow-up, ask DeepSeek to classify the turn before contextual policy routing.
4. If the turn is only conversational, return a concise natural reply without source cards or new policy.
5. If the planner selects one existing approved article, continue through the approved-answer path.
6. If the short-turn planner does not resolve it and the question looks like a policy follow-up, use recent chat context only to resolve the policy topic.
7. If no approved policy rule or high-confidence approved article matches, return a normal route response without broad retrieval answering.
8. If an approved answer or route rule matches, send the selected approved article as the controlling source.
9. Add only tightly scoped supporting RAG chunks when they are tied to the matched approved article/topic.
10. If the rule requires routing, force the final outcome to `route_from_approved_article` even if the model omits `needs_route`.

## Why

The meeting with Rich/Mike showed the previous AI-first broad-RAG path could answer sensitive topics too confidently from nearby Slack/source evidence. The new policy-first path keeps useful model-generated wording while preventing unapproved retrieval-only answers.

The 18-question live regression check also showed that overly strict exact matching can miss approved-topic follow-ups. The current hybrid keeps the policy guard as the safety gate while allowing short follow-ups and scoped supporting context.

The July 9 signed-in follow-up check showed a second issue: harmless conversational turns felt unnatural because they were treated like new policy questions. The conversation planner is intentionally narrow so the bot can answer "thank you" or "so I should not promise that, right?" naturally without reopening broad hallucination-prone answering.

A later July 9 signed-in retest showed one remaining ordering bug: short follow-ups like "so basically I should not promise him anything right?" and "Can you make that shorter?" could still be captured by contextual policy routing before the planner saw them. The runtime now gives those short conversational follow-ups to the planner before contextual policy matching. The model is also explicitly blocked from saying "let me connect you with a specialist" or "someone will reach out" unless an approved source authorizes that exact handoff.

## Synced FAQ Runtime Data

- Approved rep-facing articles: 19.
- Generated policy-aware RAG chunks: 1,698.
- New Rich/Mike-approved coverage includes opt-out/DNC, 20 percent ownership, qualification/show fit, contracts, main ISTV Call 2 cohorts, post-sale handoff, America's Top Lawyers passoff, Mastermind/red-carpet fee, scam/bad-review objections, failed payments, missing-show dropdowns, and Apple TV/vendor/value boundaries.
- New Rich/user-confirmed July 8 coverage includes `#sales-finance-requests`, `#sales-tech-requests`, `#sales-questions-requests`, `#greenlight-requests`, main ISTV 3-month reapply minimum, proof exceptions to Rich, and DJ/NLCEO no-cohort/no-discount.
- Latest DJ/NLCEO first-payment timing coverage routes questions about future first-payment timing, a few weeks delay, or payment-date holds before reps promise a date; ordinary DJ/NLCEO pricing and listed payment-plan questions still answer directly.

## Verification

- `node scripts/validate-ask-sales-faq.mjs`: 54 / 54 passed.
- Latest natural-conversation pass: `node scripts/validate-ask-sales-faq.mjs` 60 / 60 passed.
- Latest short-follow-up ordering pass: `node scripts/validate-ask-sales-faq.mjs` 62 / 62 passed.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- Production alias: `https://sales-performance-dashboard-rose.vercel.app`.
- Latest short-follow-up ordering code commit: `a8ae1c1`.
- Latest short-follow-up ordering production deployment: `dpl_A73MBu86pzE6QcFEkSpRBqczrBNV`.
- Verify the current Vercel deployment with `vercel inspect` after each pushed dashboard commit.
- Anonymous page/API guards should pass after deployment.
- Production error logs should be checked after guard probes.

No local dev server was started.

## 2026-07-09 Naturalness And Authority-Boundary Tightening

Status: implemented, pushed to GitHub, and locally verified without starting a local dev server.

What changed:

- The DeepSeek conversation planner is now accepted only for natural chat turns, thank-yous, short rewrites, and short confirmations.
- Fresh sales-policy/action questions about offers, deposits, payments, discounts, greenlights, qualification, holds, or exceptions cannot be accepted as casual `conversation_reply` answers.
- `conversation_reply` output now saves as conversation source mode but renders as normal chat text, not as a structured policy card.
- Planner summaries/sections are ignored for conversation replies so internal-looking lines like "Brief friendly reply..." do not appear above the answer.
- Approved-answer prompting now starts with the shortest useful live-call answer and uses sections only when they add real boundaries or steps.
- DJ/NLCEO critical fallback keeps the same safety boundaries but can honor explicit short-answer requests with a concise approved fallback.

Safety kept:

- Direct policy rules still run first.
- Approved articles still control policy answers.
- Broad unmatched retrieval-only answering remains blocked.
- No caching, model downgrade, hard-coded social script, Slack write, Google write, n8n workflow write, or local dev server was used.

Verification:

- `node scripts/validate-ask-sales-faq.mjs`: 65 / 65 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx tsc --noEmit`: passed after `next build` generated the required Next type artifacts.
- Dashboard runtime code commit: `327c483`.
- Vercel Production deployment reached Ready: `dpl_2mwVzPeVPoTev6eNYHmT7mxzg2bS`.
- Production alias: `https://sales-performance-dashboard-rose.vercel.app`.
- Anonymous `/ask-sales-faq` redirected to sign-in.
- Anonymous `POST /api/ask-sales-faq` returned controlled `not_signed_in` JSON.
- Vercel errors-only build log check showed no build errors.
- Vercel runtime errors/log check found no errors or warning/fatal logs after guard probes.
- Signed-in production retest is still pending.

## 2026-07-09 Duplicate Structured Summary Display Fix

Status: dashboard UI fix implemented and locally verified without starting a local dev server.

What changed:

- The chat renderer now suppresses the top-level summary only when it is an exact duplicate of the first structured section titled `Answer`.
- This fixes the signed-in screenshot where the DJ/NLCEO answer appeared once as a paragraph and again inside the `Answer` card.
- The route note, source button, non-duplicate summaries, and all other answer sections still render normally.

Safety kept:

- No model, prompt, policy guard, approved article, RAG, API, database, Slack, Google, or n8n behavior changed.
- The fix is presentation-only and does not make the bot more deterministic or freer-answering.

Verification:

- `node scripts/validate-ask-sales-faq.mjs`: 65 / 65 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx tsc --noEmit`: passed.
- Touched-file `git diff --check`: passed.
- Dashboard code commit: `1fe4877`.
- Vercel Production deployment for the code commit reached Ready: `dpl_D62c8NCEjzBysbZi2xK7BTDiXFYg`.
- Signed-in visual retest is still pending.

## 2026-07-09 Short-Answer And Option-List Formatting Fix

Status: dashboard runtime presentation shaping implemented, pushed, locally verified, and production-deployed without starting a local dev server.

What changed:

- Explicit short-answer requests such as "very short", "one line", "one sentence", "shorter", or "brief" now keep the visible structured answer to one concise answer line instead of adding an extra `Answer` card.
- Dense option paragraphs with several parenthesized payment/package options can now be rendered as structured bullet items.
- The formatter uses only text already returned by the approved answer path; it does not select policy, add prices, create offers, or change routing.

Safety kept:

- No model downgrade, caching, fallback-to-any-approved-answer behavior, approved-KB change, RAG expansion, API/database schema change, Slack write, Google write, or n8n workflow change.
- Policy guard, approved articles, critical validation, grounding validation, route notes, request guards, and rate limits remain active.

Verification:

- `node scripts/validate-ask-sales-faq.mjs`: 66 / 66 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx tsc --noEmit`: passed.
- Touched-file `git diff --check`: passed.
- Dashboard code commit: `8e13e31`.
- Vercel Production deployment for the code commit reached Ready: `dpl_AmbnWDSMVxgjjVnaTEw7npYB1Lr9`.
- Signed-in retest is still pending.

## 2026-07-09 Source Routing And Presentation Contract Hardening

Status: dashboard runtime/source-policy fix implemented, pushed, locally verified, and production-deployed without starting a local dev server.

What changed:

- Added a source-level route rule for greenlight letter requests, urgent greenlight sends, and greenlight-letter status/escalations. These route to `#greenlight-requests`.
- Added a critical greenlight-letter validator/fallback so greenlight answers cannot substitute `#sales-finance-requests`.
- Added an abstain guard for live account-specific commission tier, leaderboard, Bill.com, and payout questions.
- Added short-answer display metadata so explicit one-line/short requests do not rebuild a duplicate `Answer` card.
- Expanded presentation-only normalization for markdown bullets, inline labeled payment options, dense option groups, and comma-separated show lists.
- Added a section-label contract: use `What you can say` only for literal script wording; use `What you can do` for actions.

Safety kept:

- No fallback-to-any-approved-answer behavior.
- No caching, model downgrade, broad deterministic answer path, RAG expansion, API schema change, database schema change, Slack write, Google write, or n8n workflow change.
- The AI answer path still runs after approved source selection and still passes rep-facing cleanup, critical validation, grounding validation, and presentation shaping.

Verification:

- `node scripts/validate-ask-sales-faq.mjs`: 67 / 67 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx tsc --noEmit`: passed.
- Touched-file `git diff --check`: passed for runtime/generated/validator files.
- Dashboard code commit: `5f4e959`.
- Vercel Production deployment for the code commit reached Ready: `dpl_7gfgHvjo7gnA5BNtt9hLPwGVnEJV`.
- Vercel build errors-only log check showed no build errors.
- Vercel runtime error/log check showed no runtime errors, warnings, or fatal logs for the deployment check window.
- Anonymous signed-out page/API guards still returned sign-in / `not_signed_in`.
- User signed-in 28-question retest is still pending.

## 2026-07-09 Final Presentation Polish

Status: dashboard runtime polish implemented, pushed, locally verified, and production-deployed without starting a local dev server.

What changed:

- Adjacent duplicate structured sections are merged after presentation normalization. This fixes repeated section headers such as two `What you can do` cards without changing the answer facts.
- Explicit short DJ/NLCEO fallback answers now use a shorter direct sentence while preserving the required high-risk facts: no cohort rule, no same-day discount, main ISTV cohort rules do not apply, listed payment options only, and no promised hold/future payment date without owner approval.
- Critical-answer repair warnings are emitted only when the repaired answer and the approved fallback both fail validation. A valid final fallback no longer creates misleading warning logs.

Safety kept:

- No approved article, source route, policy guard fact, RAG scope, model, API, database, Slack, Google, n8n, caching, or fallback-to-any-approved-answer behavior changed.
- Critical validation and approved fallback validation still run before reps see high-risk answers.

Verification:

- `node scripts/validate-ask-sales-faq.mjs`: 68 / 68 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Touched-file `git diff --check`: passed.
- Dashboard code commit: `a2ec01a` (`Polish Ask Sales FAQ presentation validation`).
- Vercel Production deployment for the code commit reached Ready: `dpl_GarRvRj6cWQ4HJoYXLVx8CHkroBW`.
- Vercel build errors-only check showed no build errors.
- Vercel runtime errors/log check showed no errors, warnings, or fatal logs for the new deployment check window.
- Anonymous `/ask-sales-faq` still redirects to sign-in.
- Anonymous `POST /api/ask-sales-faq` still returns controlled `not_signed_in` JSON.

## 2026-07-09 Real Slack Question Context-Routing Fix

Status: implemented locally without starting a local dev server.

What the first 20-question real Slack retest showed:

- The bot had a real context-leakage failure mode: unrelated standalone questions could inherit old greenlight/cohort context from earlier messages in the same chat.
- The issue was not solved by adding more broad deterministic answers. The correct fix was to make current-question routing authoritative and only use recent context for true follow-ups.
- Some misses had current Madeline Slack replies, so those were added as approved KB coverage instead of leaving them as generic fallbacks.

Runtime change:

- `runAskSalesFaq` now derives `routingConversationContext` from `shouldUseConversationContextForRouting`.
- Direct policy rules run against the current question only.
- The old direct `matchPolicyGuard(recent context + current question)` path was removed.
- Recent context is still available for natural follow-ups such as "make that shorter", "thank you", and short pronoun-based confirmations.

KB/rule coverage added from confirmed owner replies:

- America's Authors episode availability and correction wording.
- Legacy Makers docs/info plus DJ-side passoff boundary.
- Pre-audition video sharing boundary.
- VIP conversion page / $30K rebrand example handling.
- Minors with parent/guardian present.
- Legal/regulated hemp and dispensary fit wording.
- License Options / reuse license document caution.
- DJ/NLCEO no-main-cohort timing for delayed Call 2 / funds-unavailable situations.
- 4-pay / August filming / Mastermind fulfillment hotline double-check.
- Short-notice onboarding fulfillment hotline notification.
- Contract before Call 2: allowed but not advised.
- Greenlight social-check/internal-status clarification.

Safety kept:

- No broad answer fallback was added.
- No local dev server, Slack write, Google write, n8n change, API schema change, DB schema change, cache change, or provider/model change.
- Unsupported questions still fail closed unless current approved guidance controls the answer.

Validation target:

- Dashboard validator now checks that context routing is filtered and that the generated bundle contains the real Slack regression rules.
- FAQ policy guard has 111 regression cases after adding the real Slack questions and the July 9 screenshot follow-up cases.

## 2026-07-09 July 9 Screenshot Follow-Up Hardening

Status: implemented locally and verified without starting a local dev server. Deployment and signed-in retest are still required after commit/push.

What changed:

- Added approved fallback hierarchy in `src/lib/ask-sales-faq/runtime.ts` for matched approved articles when the provider is unavailable or returns unusable output. This stays scoped to the matched article; broad unmatched questions still fail closed.
- Added criminal/prison/fraud/background routing under the qualification/reputation rubric.
- Updated Call 1 pricing guidance so it preserves the default no-price-before-Call-2 rule while allowing Rich's narrow disqualification exception when the prospect clearly has no business and is not financially qualified.
- Added payment-holding/funds-unavailable timing handling that distinguishes main ISTV from DJ/NLCEO and avoids promised holds, custom payment dates, or exceptions without the current owner.
- Added a UI display guard so structured answer cards cannot hide the substantive raw answer.
- Synced the generated approved FAQ bundle and policy-aware RAG index from the FAQ source repo.

Validation:

- `node scripts/validate-ask-sales-faq.mjs`: 71 / 71 passed.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- FAQ-side source validation also passed: policy guard 111 / 111, answer contract 119 / 119, runtime orchestrator 119 / 119, retrieval simulation 111 / 111.

Safety kept:

- No broad fallback-to-any-approved-answer behavior.
- No model/provider/cache/API/database schema change.
- No Slack, Google, Drive, Sheets, or n8n write.
- No local dev server.

## 2026-07-09 Second-Pass Live Retest Hardening

Status: implemented locally and verified without starting a local dev server. Commit/push and signed-in production retest are still required.

What the signed-in 20-question retest still exposed:

- The internal-material route handled an audition recording deletion/vault request but returned only generic "check whether approved to share" wording.
- The greenlight/cohort route handled a family emergency / out-of-town cohort exception but returned the wrong `#greenlight-requests` answer.
- The payment-hold route handled a funds/2.5k question but assumed DJ/NLCEO even though the question did not say which product/show it was.

Runtime changes:

- Added critical answer guard `pricing-ambiguous-payment-hold-product-check` so ambiguous payment-hold answers must first confirm main ISTV vs DJ/NLCEO and cannot assume DJ/NLCEO.
- Added critical answer guard `internal-recording-delete-vault-route` so recording answers cannot suggest sending, deleting, or vaulting recordings yourself.
- Added critical answer guard `greenlight-main-istv-proof-exception-route` so genuine documented emergency/cohort exceptions route to Rich/current owner, not generic greenlight-letter handling.
- Added approved article-specific fallback builders for:
  - `internal-material-sharing-boundaries`
  - `greenlight-pdf-and-cohort-deadlines`
- Synced the generated approved FAQ bundle and policy-aware RAG index from the FAQ source repo after updating the approved internal-material article.

Validation:

- `node scripts/validate-ask-sales-faq.mjs`: 71 / 71 passed.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- FAQ-side source validation also passed: policy guard 113 / 113, answer contract 121 / 121, runtime orchestrator 121 / 121, retrieval simulation 113 / 113.

Safety kept:

- No broad fallback-to-any-approved-answer behavior.
- No model/provider/cache/API/database schema change.
- No Slack, Google, Drive, Sheets, or n8n write.
- No local dev server.
