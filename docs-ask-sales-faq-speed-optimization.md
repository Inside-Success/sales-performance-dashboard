# Ask Sales FAQ Speed Optimization

Status: implemented, pushed, deployed, and production guard-verified on 2026-07-08. Natural conversation follow-up hardening was added on 2026-07-09.

This change optimizes the Ask Sales FAQ runtime without replacing normal answers with broad deterministic templates.

## Runtime Behavior

- DeepSeek `deepseek-v4-pro` remains the primary model.
- The policy guard still runs before any model call.
- Unmatched or unapproved topics still fail closed before model generation.
- Approved articles remain the controlling answer authority.
- Supporting RAG chunks are still supporting context only; they do not become standalone answer authority.
- Critical-answer validation, repair, and narrow approved fallback remain active.
- When the strict guard would otherwise abstain, a small DeepSeek conversation-planning call may classify the current turn as a natural conversational reply, a high-confidence approved-article match, or unsupported. It cannot create new policy.

## Speed Changes

- `FAQ_DEEPSEEK_DISABLE_THINKING` defaults to enabled behavior unless set to `false`.
- When thinking is disabled, the DeepSeek payload sends `thinking: { type: "disabled" }`.
- If DeepSeek rejects the thinking parameter, the runtime retries without that parameter.
- `FAQ_ALLOW_CLAUDE_FALLBACK` must be `true` before Anthropic/Claude is used as a fallback.
- Malformed or schema-invalid DeepSeek JSON gets one DeepSeek retry with the same approved evidence and stricter JSON instructions.
- The model evidence packet is reduced to the controlling approved article plus at most two tightly scoped supporting chunks.
- Approved article text gets more prompt room than supporting chunks.
- Answer and repair token caps are reduced to better match observed Ask Sales FAQ answer sizes.

## Safe Runtime Metadata

Saved assistant `answer_payload` rows may include `runtimeMetadata` with:

- provider attempts;
- provider/model;
- attempt latency;
- retry status;
- sanitized provider error text;
- DeepSeek cache token counts when returned;
- evidence candidate counts;
- evidence prompt character estimate;
- DeepSeek thinking flag;
- Claude fallback flag;
- critical fallback flag.

The chat UI normalizes stored payloads and renders only the visible structured answer fields.

## Natural Conversation Follow-ups

The 2026-07-09 follow-up pass addresses two signed-in testing issues without adding hard-coded chatbot scripts:

- short confirmations like "so basically I should not promise him anything right?" should get a concise answer based on the previous assistant answer instead of a full repeated policy dump;
- social turns like "thank you for your help" should get a short natural reply instead of the generic unconfirmed-answer fallback.
- shorten/rephrase requests like "Can you make that shorter?" should shorten the previous substantive assistant answer instead of reopening the full policy article.

The runtime now handles this as an AI planning step only after the direct hard policy guard reaches the default abstain state. For short conversational follow-ups, the planner now runs before contextual policy routing so old DJ/cohort/payment context cannot force a long policy answer before the planner sees the rep's actual intent. The planner has three allowed outcomes:

- `conversation_reply`: a natural reply for acknowledgments, rephrasing/shortening requests, or short confirmations that can be answered solely from the recent assistant answer;
- `approved_article`: a high-confidence route into one existing approved article;
- `unsupported`: the existing safe fallback path.

Safety boundaries:

- The planner is not allowed to add policy, prices, discounts, owners, links, exceptions, or process steps.
- The model is not allowed to tell the rep or prospect that it will connect them with a specialist, have someone reach out, or transfer them unless an approved source explicitly authorizes that exact handoff.
- New sales-policy questions still need an approved article or they fall back safely.
- Normal approved-answer generation, high-risk critical validation, grounding checks, and route behavior remain unchanged.
- Successful `conversation_reply` rows are logged as answers, not as admin misses.

## Validation

Run without starting a local dev server:

```bash
node scripts/validate-ask-sales-faq.mjs
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

Latest verified run after the natural-conversation follow-up pass:

- `node scripts/validate-ask-sales-faq.mjs`: 62 / 62 passed after the short-follow-up ordering and specialist-handoff guard update.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- Touched-file `git diff --check`: passed.
- Natural-conversation code commit: `96824fa`.
- Natural-conversation code Vercel Production deployment: `dpl_JDh5X1zwoSemP69zaWLffQbwt7h6`; later docs-only deployments may supersede the exact alias deployment without changing the runtime code.
- Short-follow-up ordering code commit: `a8ae1c1`.
- Short-follow-up ordering code Vercel Production deployment: `dpl_A73MBu86pzE6QcFEkSpRBqczrBNV`; later docs-only deployments may supersede the exact alias deployment without changing the runtime code.
- Production alias: `https://sales-performance-dashboard-rose.vercel.app`.
- Anonymous `/ask-sales-faq` redirects to sign-in.
- Anonymous `POST /api/ask-sales-faq` returns controlled `not_signed_in` JSON.
- Vercel `/api/ask-sales-faq` runtime errors: none found after deployment checks.
- Vercel warning/error logs for the deployment: none found after guard probes.

## Naturalness / Policy-Authority Follow-up Tightening

The 2026-07-09 follow-up testing after the short-follow-up pass showed the next failure mode:

- conversation replies were technically correct but rendered like forced answer cards;
- planner summary text could appear above the real answer;
- a new money/action question could be accepted as `conversation_reply` instead of going back through approved-policy authority;
- short-answer requests against DJ/NLCEO critical fallback could still feel like a long policy memo.

Implemented dashboard fix:

- `conversation_reply` is still AI-written by DeepSeek, but runtime acceptance now blocks fresh sales-policy/action questions from using that mode.
- Money/deposit/payment/discount/hold/exception/qualification/offer questions must route through the approved article path or fail closed.
- Chat UI renders `conversation_reply` as plain chat text.
- Stored conversation structured payloads now survive reload with `sourceMode: "conversation"`.
- Approved-answer prompting now favors the shortest useful live-call answer first.
- DJ/NLCEO critical fallback has a concise variant only when the rep explicitly asks for a shorter reply; the no-cohort/no-same-day-discount/no-custom-hold boundaries remain intact.

Latest local verification:

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

Still pending:

- Signed-in live retest for naturalness, approved-policy authority, and response time.

## Duplicate Structured Summary Display Fix

The 2026-07-09 signed-in UI check found one presentation issue after the naturalness tightening pass: a structured approved answer could show the same text twice when the answer `summary` exactly matched the first section titled `Answer`.

Implemented dashboard fix:

- The chat UI now compares normalized text for `summary` and the first `Answer` section body.
- If they are exact duplicates, the top summary is hidden and the structured card remains.
- If the summary adds distinct value, it still renders.
- Route notes, source cards, and later sections are unchanged.

This does not affect the speed path or answer-quality path:

- No provider/model/prompt/routing change.
- No caching, fallback-to-any-approved-answer, approved-KB change, or new deterministic answer rule.
- No API, database, Slack, Google, or n8n change.

Latest verification:

- `node scripts/validate-ask-sales-faq.mjs`: 65 / 65 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx tsc --noEmit`: passed.
- Touched-file `git diff --check`: passed.
- Dashboard code commit: `1fe4877`.
- Vercel Production deployment for the code commit reached Ready: `dpl_D62c8NCEjzBysbZi2xK7BTDiXFYg`.
- Signed-in visual retest is still pending.
