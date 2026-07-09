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

## Short-Answer And Dense Option Formatting Fix

The 2026-07-09 signed-in check after the duplicate-summary fix showed a separate presentation issue: an explicit one-line DJ/NLCEO question could still render a concise summary plus a long `Answer` card containing payment plans in one dense paragraph.

Implemented dashboard fix:

- Short-answer requests now force the structured visible answer to the direct answer only and remove extra sections from the display payload.
- Dense option paragraphs are reshaped into bullet items when the model already returned several option groups such as package/payment-plan choices.
- Route notes and source cards remain unchanged.

This is not a new answer path:

- It does not change provider/model selection, prompts that select policy, approved articles, RAG scope, route decisions, pricing facts, or critical validation.
- It does not add caching, hard-coded answer content, or fallback-to-any-approved-answer behavior.

Latest verification:

- `node scripts/validate-ask-sales-faq.mjs`: 66 / 66 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx tsc --noEmit`: passed.
- Touched-file `git diff --check`: passed.
- Dashboard code commit: `8e13e31`.
- Vercel Production deployment for the code commit reached Ready: `dpl_AmbnWDSMVxgjjVnaTEw7npYB1Lr9`.
- Signed-in retest is still pending.

## Source Routing And Presentation Contract Hardening

The 2026-07-09 28-question review found correctness/presentation issues that were not speed issues:

- greenlight-letter questions could select finance/payment routing;
- live commission-tier questions could borrow the wrong finance article;
- explicit short answers could still rebuild a duplicate `Answer` card;
- show/payment lists could still render as dense paragraphs.

Implemented dashboard fix:

- Added greenlight-letter source routing and critical validation for `#greenlight-requests`.
- Added an abstain guard for live commission tier, leaderboard, Bill.com, and payout questions.
- Added explicit short-answer display metadata to prevent duplicate `Answer` fallback cards.
- Expanded presentation-only formatting for existing list-like answer text and section labels.

This does not change the speed path:

- No provider/model downgrade, caching, fallback-to-any-approved-answer, API schema change, DB schema change, Slack write, Google write, or n8n workflow change.
- The normal answer-quality path remains source selection -> AI answer -> rep-facing cleanup -> critical validation -> grounding validation -> display shaping.

Latest verification:

- `node scripts/validate-ask-sales-faq.mjs`: 67 / 67 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx tsc --noEmit`: passed.
- Touched-file `git diff --check`: passed for runtime/generated/validator files.
- Dashboard code commit: `5f4e959`.
- Vercel Production deployment for the code commit reached Ready: `dpl_7gfgHvjo7gnA5BNtt9hLPwGVnEJV`.
- Vercel build/runtime checks were clean in the deployment check window.
- Signed-in 28-question retest is still pending.

## Final Presentation Polish

The 2026-07-09 signed-in 28-question retest after source-routing hardening showed no policy-critical wrong answers, but it still exposed small product-polish issues:

- adjacent structured sections could repeat the same title, especially duplicate `What you can do` blocks;
- the DJ/NLCEO short fallback was safe but longer than needed for an explicit one-line request;
- critical-repair warnings could appear in Vercel logs even when the final approved fallback shown to the rep was valid.

Implemented dashboard fix:

- Adjacent duplicate display sections are merged generically after existing section normalization.
- The DJ/NLCEO short-answer critical fallback keeps the required safety facts while using a shorter direct sentence.
- Critical-repair warnings are held until after approved fallback validation, so a successful final fallback does not create misleading warning noise.

This does not change the speed path or answer authority:

- No approved-KB fact, policy guard, route rule, RAG scope, model, API schema, DB schema, Slack, Google, n8n, caching, or fallback-to-any-approved-answer change.
- The normal answer-quality path remains source selection -> AI answer -> rep-facing cleanup -> critical validation -> grounding validation -> display shaping.

Latest verification:

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

## Composer Draft Preservation

The 2026-07-09 signed-in UI use found one queue-state issue separate from answer quality: if the rep typed a new draft while the bot was finishing or auto-sending a queued follow-up, the composer could clear that draft.

Implemented dashboard fix:

- Added a guarded composer clear helper so the UI only clears the exact question that was just sent or queued.
- Preserved intentional behavior: when the rep sends/queues the text currently in the composer, that text clears.
- Preserved draft behavior: if the composer now contains different text, queued auto-sends leave it alone.
- Added a static Ask Sales FAQ validator check for this queue/composer edge case.

This is not a speed or answer-quality change:

- No model, approved KB, policy guard, route decision, RAG scope, API schema, DB schema, Slack, Google, n8n, caching, or answer-generation behavior changed.

Latest verification:

- `node scripts/validate-ask-sales-faq.mjs`: 69 / 69 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Touched-file `git diff --check`: passed.
- Dashboard code commit: `2feef7d` (`Preserve Ask Sales FAQ composer drafts`).
- Vercel Production deployment reached Ready: `dpl_AJ1MdM3bg6o58cXsQHogoxhANx8D`.
- Vercel build errors-only check showed no build errors.
- Vercel runtime error/log checks showed no errors, warnings, or fatal logs for the deployment check window.
- Anonymous `/ask-sales-faq` still redirects to sign-in.
- Anonymous `POST /api/ask-sales-faq` still returns controlled `not_signed_in` JSON.
