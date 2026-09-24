# Ask Sales source refresh and Luna comparison — September 24, 2026

Status: isolated candidate; not yet published. Production baseline is dashboard `fadaeade22cc96aa6e109893103d70ac8fd55f4c`, Ask Sales knowledge `a7b2510c5bf20052503b21d1` and GPT-5.6 Luna medium. Preserve all intervening coaching/UI releases.

## Authorized scope

Manual knowledge refresh from the September 21 full checkpoint plus targeted corrections; readable Slack channel mentions; matched GPT-6 Luna / GPT-5.6 Luna evaluation at medium reasoning. Combined paid ceiling $5. No source writes, Slack messages, scheduler activation or local server. FAQ-only model selection; other features keep their own models.

## Source review

355 Slack roots across four saved channels, all available pages; full relevant question threads and 28 newer replies in the long-running reality FAQ thread. Metadata checked for 43 registered accessible Google sources. Two changed Docs read, changed calendar-directory header verified, three additional/new Docs read. Original checkpoints/history remain intact. See accompanying machine-readable checkpoint for precise coverage and exclusions.

13 new source-reviewed records cover HubSpot SMS/Twilio vs Zoom voice; time-off notification to Olivia and calendar blocks; cancelled/no-show zero vs rescheduled assessment deferred; Island no-plus-one and show accommodation; tentative franchise tests; Millionaire Match House eligibility exception; earlier Island VIP studio documentary; Mansion merchandise/airing estimates; daily own-call review; the ten-part Call 2 value framework; Call 3 payment calendar; optional AI B-roll; overlapping outbound lead ownership. Older cancellation/time-off instructions are explicitly superseded. General reality guest benefits bring the Island exception with them. Training retains its verified schedule and now references the current SMS process.

Do not infer cancellation from a removed Love or Business Loom link. Do not promote unanswered questions, individual lead details, sponsorship jokes or rep speculation to company policy. The new linked Loom, SMS video and Slack voice message were not transcribed: no content claims are based on them. Two historically unavailable sources remain excluded. The calendar directory is linked as the living source, not copied into hard-coded rep calendars.

## UI change

A scoped Markdown AST plugin converts Slack channel mentions to safe HTTPS links while preserving paragraphs, lists, inline/fenced code and existing links. Verified names are readable; unknown or inaccessible IDs use “Open Slack channel” rather than an invented name. This works when displaying saved answers without mutating chat history. No model call is added.

## Evaluation and safety gates

35 frozen cases: 19 distinct recent production questions with preceding retained conversation context, plus 16 source-grounded regressions. Both models use the same final compiled knowledge, prompts, medium reasoning, token limits and pipeline. A shared locked spend ledger accounts for both models and unresolved attempts; evaluation ceiling $4.75 leaves $0.25 for bounded hosted verification. Manual blinded review will distinguish useful correct answers, necessary clarification, omissions and unsupported claims. Latency, actual token cost and repeat stability matter as well as quality; a newer model is not presumed better.

The first small compatibility run succeeded. An early partial evaluation was stopped to correct the new coaching record's provenance suffix before freezing the final source snapshot; its spend remains counted. No prompt or retrieval rewrite was made. Full results, selection and release receipts will be added before completion.

## Verification notes

The initial full suite identified two expected stale record IDs after source supersession and one new record mislabeled policy instead of coaching; corrected and targeted tests passed. TypeScript also exposed pre-existing possibly-undefined response assertions in the recently added coaching test; three explicit test assertions now fail clearly if no response exists. No coaching runtime behavior was changed, and all three coaching route tests passed. Remaining full checks and hosted verification are pending.

## Rollback

Retain prior FAQ model setting and knowledge snapshot. If the candidate fails its gates, keep the current FAQ model and release only independently passing knowledge/UI work. Do not roll the shared dashboard back across other teams' subsequent changes. Prefer a scoped revert of this release and FAQ-only model setting.
