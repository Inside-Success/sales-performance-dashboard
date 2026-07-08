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
