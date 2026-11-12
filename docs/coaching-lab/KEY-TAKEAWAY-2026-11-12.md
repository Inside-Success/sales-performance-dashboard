# Fixed Key takeaway section — November 12, 2026

## Authorized scope
Use **Key takeaway** as the fixed opening heading and one clear call-specific takeaway underneath. Apply to all reports from the current November12 coaching generation, including automatic and manual reports and their existing Google Docs. Preserve all other coaching content, scores, source evidence, reviewed records and delivery state.

## Implementation
- The shared renderer supplies the fixed heading and one paragraph for Tyler v2 reports. Earlier non-v2 layouts remain unchanged.
- Future production prompt instructions request one direct takeaway, normally one sentence, without a headline/subheadline or repeated “learn how” introduction. The contract accepts a single paragraph and retains compatibility with existing/in-flight two-line summaries.
- `coaching-key-takeaway-revisions.json` contains the explicitly reviewed opening-copy consolidations for the 31 existing current-generation reports (29 automatic, 2 manual). Exact original-summary matching prevents accidental application to changed text. This is a finite presentation migration, not model training or a call-specific coaching rule. Original reviewed payloads and safety digests are not rewritten.
- Unmatched in-flight two-line summaries are rendered as one paragraph without dropping text. No added provider request, node, or paid regeneration.
- Existing native Google Docs receive revision-guarded edits confined to the opening section; all later paragraphs remain unchanged. Existing document IDs and report links are preserved; no redelivery or Slack messages.

## Verification and rollout
Local coaching suite: 361 tests passed. Production build passed. All 31 saved reports still validate against their source/safety bindings; replay confirms everything after the opening is unchanged and payloads are byte-identical.

The scoped workflow builder refreshes the shared renderer/validator bundles and the presentation instruction on fresh core/official/manual snapshots. Model configuration, governed knowledge, node topology, schedules, provider checkpoints and recovery logic remain unchanged. Installation must reject concurrent drift and retain each prior published snapshot for rollback.

Live rollout, authenticated UI verification, and 31-document readback are pending. Record final receipts below before claiming completion.
