# Ask Sales FAQ Wording Hardening And Admin Triage

Updated: 2026-07-07

This dashboard change makes useful answers sound product-ready for reps and makes the admin review queue easier to prioritize.

## Runtime Behavior

- The runtime checks the full structured answer payload for internal wording, not only the top-level answer text.
- Blocked wording includes source-review phrases such as Slack evidence, internal guidance, governance log, candidate answer, evidence/source numbers, article IDs, file paths, RAG, manifests, source coverage, and approval-mechanics wording.
- If hidden wording appears, the runtime asks the configured model for one rep-facing wording repair.
- The repair must preserve the original facts, route flag, confidence label, confidence score, and selected source IDs.
- If hidden wording remains after repair, the runtime rejects the output and returns the normal safe fallback instead of showing internal process language.
- Obvious answer-style cleanup remains deterministic only where it is safe, such as changing "The rep should" to "You should".

## Source Cards

- Approved source cards still use approved FAQ metadata.
- Evidence-mode source cards now use rep-facing labels such as `Sales guidance`.
- The UI no longer exposes evidence source titles or AI source-selection mechanics as the card headline.

## Admin Review Categories

The admin overview computes read-only review labels for recent misses, feedback, and answers:

- `Wording cleanup`
- `Approved-topic matching`
- `Rich/owner approval gap`
- `Runtime reliability`
- `Good route review`
- `Good answer review`

These labels are display guidance only. They do not update Neon records and do not approve KB content.

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
