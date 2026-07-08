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
