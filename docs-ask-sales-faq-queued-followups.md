# Ask Sales FAQ Queued Follow-ups

Updated: 2026-07-03

This dashboard change keeps the Ask Sales FAQ composer usable while the chatbot is answering.

## Behavior

- The textarea remains editable during an in-flight answer.
- Pressing Enter or clicking send while an answer is loading queues the draft as a follow-up.
- Queued follow-ups are shown above the composer with remove and clear controls.
- After a successful answer, queued follow-ups send one at a time using the latest conversation context.
- If an answer fails, the remaining queue pauses instead of being lost. The user can resume, remove, or clear queued follow-ups.
- Switching chats or starting a new chat is blocked while an answer or queued follow-up is active, so late responses do not append to the wrong conversation.

## Implementation Surfaces

- UI/state: `src/components/ask-sales-faq/ask-sales-faq-chat.tsx`
- Static integration validation: `scripts/validate-ask-sales-faq.mjs`

The API contract did not change. The browser still sends a bounded recent message window to `POST /api/ask-sales-faq`, and the API still treats the last user message as the current question.

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
