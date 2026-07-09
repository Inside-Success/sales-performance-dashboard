# Ask Sales FAQ Queued Follow-ups

Updated: 2026-07-09

This dashboard change keeps the Ask Sales FAQ composer usable while the chatbot is answering.

## Behavior

- The textarea remains editable during an in-flight answer.
- Pressing Enter or clicking send while an answer is loading queues the draft as a follow-up.
- Queued follow-ups are shown above the composer with remove and clear controls.
- After a successful answer, queued follow-ups send one at a time using the latest conversation context.
- If an answer fails, the remaining queue pauses instead of being lost. The user can resume, remove, or clear queued follow-ups.
- Switching chats or starting a new chat is blocked while an answer or queued follow-up is active, so late responses do not append to the wrong conversation.
- The composer only clears the exact question that was intentionally sent or queued. If a rep types a newer draft while the bot is answering, queued auto-sends no longer wipe that newer draft.

## Implementation Surfaces

- UI/state: `src/components/ask-sales-faq/ask-sales-faq-chat.tsx`
- Static integration validation: `scripts/validate-ask-sales-faq.mjs`

The API contract did not change. The browser still sends a bounded recent message window to `POST /api/ask-sales-faq`, and the API still treats the last user message as the current question.

## 2026-07-09 Draft Preservation Fix

The first queue rollout correctly let reps type while an answer was loading, but a later auto-send could still clear whatever was currently in the composer. The chat UI now clears the composer only when its current value still matches the question being sent or queued.

This is UI state only. It does not change model routing, policy guard behavior, approved answers, context windows, API payloads, database writes, Slack, Google, or n8n.

Verification:

- `node scripts/validate-ask-sales-faq.mjs`: 69 / 69 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Touched-file `git diff --check`: passed.
- Dashboard code commit: `2feef7d` (`Preserve Ask Sales FAQ composer drafts`).
- Vercel Production deployment reached Ready: `dpl_AJ1MdM3bg6o58cXsQHogoxhANx8D`.

## n8n Scope

No n8n workflow change is required for this fix. Ask Sales FAQ runtime remains dashboard/API code. The existing n8n workflow only mirrors saved feedback from Neon to the Google Sheet.

## Verification

Run without starting a local dev server:

```bash
node scripts/validate-ask-sales-faq.mjs
npm run lint
npm run build
git diff --check
```
