# Call 2 coaching efficiency release — September 8, 2026

> Runtime compatibility repair published after two natural failures. See [the repair record](MAGIC-MIKE-COACHING-RUNTIME-FIX-2026-09-08.md) for current versions and actual n8n sandbox verification. Natural full-delivery verification remains separate.

## State

Published official and manual workflow nodes and connections were read back and match the candidate. Natural eligible post-release report delivery is still pending. This successor supersedes the model/cost/architecture sections of the earlier September 8 coaching release, while retaining its report version marker and dashboard behavior.

## Scope and decisions

- Official and manual coaching: one Sonnet 5 structured writer (medium reasoning) and one Sonnet 5 factual review (high reasoning), replacing three Opus 5 stages. Disconnected confirmation nodes are retained for scoped rollback.
- Manual coaching also bypasses the older duplicate Sonnet 4.6 generator; the structured writer supplies the existing eligibility/refusal contract. The official joint scoring/coaching generator remains because scoring still depends on it. Its old coaching is superseded, but removing that generation safely requires separate scoring work.
- Existing compliance, scoring, shared provider, safety screen, targeted repair, delivery nodes and shared context document remain unchanged. No Ask Sales or manager-page change.
- Coaching-only guidance incorporates refreshed Call 2 script, onboarding, Green Light framework, welcome email, licensing options, FAQ, closing and role-play guidance. Contract review before payment is permitted. Individual payment arrangements are not promoted to universal policy. Shared Google documents were not edited.
- Publish supported material recommendations and specific strengths; optional polish remains internal. Check counterevidence and preserve uncertain outcomes. An audited, cited outcome correction is allowed; invalid source references and incomplete reviews fail closed. Conservative publication filters withhold unsupported payment holds, reduced initial commitments and written delivery guarantees. These filters can also omit useful advice; they are not a complete semantic policy engine.
- Full-transcript caching is disabled for these two requests. Matching medium settings reused cache but missed unsupported criticism. Matching high settings increased latency and truncation. The selected medium/high pair did not reuse the same cached prefix, so cache writes added cost. Other provider callers are unaffected.

## Evidence and cost

Eighteen full transcripts span disputed, positively rated and unrated official calls plus two manual submissions. Feedback ratings are sampling signals, not accuracy labels. Older disputes remain relevant. Three additional unrated calls extended the original fifteen-call comparison. This is a selected sample, not a blinded statistical proof of universal improvement.

The final writer plus review averaged $0.166545, range $0.082628–$0.30404, with mean combined provider latency 57.81 seconds. The earlier three-Opus sample averaged $0.7016: approximately 76% lower new-coaching-stage cost. Estimates use provider token accounting and current Sonnet 5 prices ($2/M input, $10/M output), not an account billing reconciliation. Evaluation retries and other stages are excluded. Pricing source: https://platform.claude.com/docs/en/about-claude/pricing

At the observed 900 official reports/30 days (30/day), this portion is approximately $5/day. At 200/300 eligible calls it is approximately $33/$50 per day, before existing scoring, compliance, safety, repairs and other account use. A $30–40 whole-account daily ceiling at 300 calls is not established.

Quality checks exposed and addressed: missed payment confirmation, inconsistent audit rejection fields, missing strength explanation, optional or unsupported payment-hold advice, and a coaching/compliance wording collision. The stronger reviewer was retained after cheaper reviews missed faults. No claim that errors or defensive reactions are impossible.

## Verification and limitations

Local checks include 14 renderer/audit regression tests, five dashboard tests, and 18 structured output validations, node compilation and graph/source alignment, refusal cases, exact unchanged compliance request comparison, TypeScript and production build. Tests call only the provider webhook; downstream document and callback payloads are constructed locally without sending them. No test notifications, duplicate reports, Google document edits or Slack messages.

Eight representative official/manual downstream replay cases passed during final candidate development. Four were rechecked after the neutral fallback wording adjustment, including both manual cases, a strong official call and a fresh unrated call. Source identifiers, report fields and manual callback metadata passed; callbacks were constructed locally, never submitted. Final content inspection retained the fresh call's supported funding-approval criticism and did not invent a fault in the strong-call check. Existing safety/repair may still edit coaching where compliance conflicts are detected.

Provider HTTP 524 timeouts occurred during isolated safety replays; affected checks passed on retry. Existing retries are retained; provider availability and latency are not fixed by this coaching release. Natural eligible post-release Call 2 delivery has not yet been observed. Successful isolated execution or published configuration does not prove live end-to-end delivery.

## Operations and rollback

Private baselines, source copies, full prompts, transcript evidence, candidate graphs, exact inverse operations and readbacks are outside this public repository in `.magic-mike-sonnet5-2026-09-08/`. Do not commit private material. `scripts/coaching-release/build-efficiency-candidate.py` constructs a candidate from that private input and never contacts a service.

Before any rollback, refresh active state and compare changed nodes/edges with the released candidate. Validate scoped inverse operations; do not restore a stale entire workflow over unrelated changes. n8n updates to an active workflow publish immediately.

The existing `magic-mike-call2-coaching-2026-09-08` generation marker continues to label new reports Enhanced and older unmarked reports Legacy. The model is recorded as `claude-sonnet-5`; revision is `call2-sonnet5-efficiency-2026-09-08`. No historical reports are rewritten. No naturally generated Opus report was observed before this successor.

## Published workflow verification

- Official `L8Nn7xncA9ZPDdWA`: active version `01e3a58a-5910-4c36-9807-907f0e3d20a5`, 110 nodes, five scoped operations.
- Manual `BMRrGxHyXMcgO6j3`: active version `00cc001a-012b-4e5f-be6c-a534b1ee621a`, 48 nodes, fifteen scoped operations. n8n omits an empty connection entry after disconnecting the old AI Report; the builder now matches that serialization. Active graph matches candidate.
- Shared provider `CiDBJxWJZCDRJChK`, joint scoring `35bFcPYdHSADpyTN`, and score persistence `iG6pvqUTn0askw9y`: unchanged nodes, connections and active versions verified.
- Runtime validator: official retains the same eight pre-existing Code-node array-shape diagnostics, 141 warnings versus 139 baseline, zero invalid connections. Manual has zero errors, 69 warnings versus 66 baseline, zero invalid connections. New warnings identify deliberately disconnected AI nodes and updated chain lengths. Actual node JavaScript and source/refusal fixtures pass; this is not a warning-free validation claim.
- Latest observed stored official report remains 5802 (September 7); manual remains 109 (September 5). Do not call short successful trigger executions proof of complete delivery.
- Baseline rollback versions: official `d3d89d11-16da-4849-979e-09db5d200a60`; manual `6c829611-3e18-492d-9ce9-78d9f6ca70f2`.

GitHub publication and deployment verification are recorded in the operator handoff after merge. This repository change is generic tooling and documentation only; dashboard application code and environment are unchanged. Checked deployment triggers: Git pushes invoke Vercel builds; the Ask Sales GitHub workflow path filters do not match this change.
