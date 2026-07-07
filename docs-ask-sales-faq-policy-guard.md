# Ask Sales FAQ Policy Guard Enforcement

Date: 2026-07-07

## What Changed

The Ask Sales FAQ runtime now enforces the generated FAQ policy guard before any model call.

Runtime order:

1. Redact sensitive text.
2. Evaluate the current user question against `ASK_SALES_FAQ_POLICY_RULES`.
3. If no approved policy rule matches, return a normal route response without calling DeepSeek/Claude and without attaching a source card.
4. If an approved answer or route rule matches, send only the selected approved article to the model.
5. If the rule requires routing, force the final outcome to `route_from_approved_article` even if the model omits `needs_route`.

## Why

The meeting with Rich/Mike showed the previous AI-first broad-RAG path could answer sensitive topics too confidently from nearby Slack/source evidence. The new policy-first path keeps useful model-generated wording while preventing unapproved retrieval-only answers.

## Synced FAQ Runtime Data

- Approved rep-facing articles: 17.
- Generated policy-aware RAG chunks: 1,687.
- New Rich/Mike-approved coverage includes opt-out/DNC, 20 percent ownership, qualification/show fit, contracts, main ISTV Call 2 cohorts, post-sale handoff, America's Top Lawyers passoff, Mastermind/red-carpet fee, scam/bad-review objections, failed payments, missing-show dropdowns, and Apple TV/vendor/value boundaries.

## Verification

- `node scripts/validate-ask-sales-faq.mjs`: 46 / 46 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Vercel Production deployment: `dpl_24N5hE5KhFzp8ggbEMTabHPHrdHg`.
- Production alias: `https://sales-performance-dashboard-rose.vercel.app`.
- Anonymous page/API guards passed.
- Production error logs after guard probes: no logs found.

No local dev server was started.
