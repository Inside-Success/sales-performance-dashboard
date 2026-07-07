# Ask Sales FAQ Policy Guard Enforcement

Date: 2026-07-07

## What Changed

The Ask Sales FAQ runtime now enforces the generated FAQ policy guard before any model call.

Runtime order:

1. Redact sensitive text.
2. Evaluate the current user question against `ASK_SALES_FAQ_POLICY_RULES`.
3. If the current question does not match and looks like a short follow-up, use recent chat context only to resolve the policy topic.
4. If no approved policy rule matches, return a normal route response without calling DeepSeek/Claude and without attaching a source card.
5. If an approved answer or route rule matches, send the selected approved article as the controlling source.
6. Add only tightly scoped supporting RAG chunks when they are tied to the matched approved article/topic.
7. If the rule requires routing, force the final outcome to `route_from_approved_article` even if the model omits `needs_route`.

## Why

The meeting with Rich/Mike showed the previous AI-first broad-RAG path could answer sensitive topics too confidently from nearby Slack/source evidence. The new policy-first path keeps useful model-generated wording while preventing unapproved retrieval-only answers.

The 18-question live regression check also showed that overly strict exact matching can miss approved-topic follow-ups. The current hybrid keeps the policy guard as the safety gate while allowing short follow-ups and scoped supporting context.

## Synced FAQ Runtime Data

- Approved rep-facing articles: 17.
- Generated policy-aware RAG chunks: 1,687.
- New Rich/Mike-approved coverage includes opt-out/DNC, 20 percent ownership, qualification/show fit, contracts, main ISTV Call 2 cohorts, post-sale handoff, America's Top Lawyers passoff, Mastermind/red-carpet fee, scam/bad-review objections, failed payments, missing-show dropdowns, and Apple TV/vendor/value boundaries.

## Verification

- `node scripts/validate-ask-sales-faq.mjs`: 47 / 47 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Vercel Production deployment: `dpl_24N5hE5KhFzp8ggbEMTabHPHrdHg`.
- Production alias: `https://sales-performance-dashboard-rose.vercel.app`.
- Anonymous page/API guards passed.
- Production error logs after guard probes: no logs found.

No local dev server was started.
