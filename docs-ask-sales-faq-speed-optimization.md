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

The runtime now handles this as an AI planning step only after the hard policy guard reaches the default abstain state. The planner has three allowed outcomes:

- `conversation_reply`: a natural reply for acknowledgments, rephrasing/shortening requests, or short confirmations that can be answered solely from the recent assistant answer;
- `approved_article`: a high-confidence route into one existing approved article;
- `unsupported`: the existing safe fallback path.

Safety boundaries:

- The planner is not allowed to add policy, prices, discounts, owners, links, exceptions, or process steps.
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

- `node scripts/validate-ask-sales-faq.mjs`: 60 / 60 passed.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `git diff --check`: pending final commit check for this docs/code pass.
- Dashboard commit: `28ae844`.
- Speed-code Vercel Production deployment: `dpl_7dWtZvzjbD5hizToNPJkmJqkuS83`; later docs-only deployments may supersede the exact alias deployment without changing the runtime code.
- Production alias: `https://sales-performance-dashboard-rose.vercel.app`.
- Anonymous `/ask-sales-faq` redirects to sign-in.
- Anonymous `POST /api/ask-sales-faq` returns controlled `not_signed_in` JSON.
- Vercel production logs after guard probes showed no logs/errors.
