# Ask Sales FAQ Speed Optimization

Status: implemented locally on 2026-07-08. Production push/deploy verification is tracked in the FAQ repo handoff docs.

This change optimizes the Ask Sales FAQ runtime without replacing normal answers with broad deterministic templates.

## Runtime Behavior

- DeepSeek `deepseek-v4-pro` remains the primary model.
- The policy guard still runs before any model call.
- Unmatched or unapproved topics still fail closed before model generation.
- Approved articles remain the controlling answer authority.
- Supporting RAG chunks are still supporting context only; they do not become standalone answer authority.
- Critical-answer validation, repair, and narrow approved fallback remain active.

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

## Validation

Run without starting a local dev server:

```bash
node scripts/validate-ask-sales-faq.mjs
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```
