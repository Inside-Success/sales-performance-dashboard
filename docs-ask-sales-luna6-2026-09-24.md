# Ask Sales source refresh and Luna comparison — September 24, 2026

Status: published and verified September 24. Production baseline is dashboard `fadaeade22cc96aa6e109893103d70ac8fd55f4c`, Ask Sales knowledge `a7b2510c5bf20052503b21d1` and GPT-5.6 Luna medium. Preserve all intervening coaching/UI releases.

## Authorized scope

Manual knowledge refresh from the September 21 full checkpoint plus targeted corrections; readable Slack channel mentions; matched GPT-6 Luna / GPT-5.6 Luna evaluation at medium reasoning. Combined paid ceiling $5. No source writes, Slack messages, scheduler activation or local server. FAQ-only model selection; other features keep their own models.

## Source review

355 Slack roots across four saved channels, all available pages; full relevant question threads and 28 newer replies in the long-running reality FAQ thread. Metadata checked for 43 registered accessible Google sources. Two changed Docs read, changed calendar-directory header verified, three additional/new Docs read. Original checkpoints/history remain intact. See accompanying machine-readable checkpoint for precise coverage and exclusions.

13 new source-reviewed records cover HubSpot SMS/Twilio vs Zoom voice; time-off notification to Olivia and calendar blocks; cancelled/no-show zero vs rescheduled assessment deferred; Island no-plus-one and show accommodation; tentative franchise tests; Millionaire Match House eligibility exception; earlier Island VIP studio documentary; Mansion merchandise/airing estimates; daily own-call review; the ten-part Call 2 value framework; Call 3 payment calendar; optional AI B-roll; overlapping outbound lead ownership. Older cancellation/time-off instructions are explicitly superseded. General reality guest benefits bring the Island exception with them. Training retains its verified schedule and now references the current SMS process.

Do not infer cancellation from a removed Love or Business Loom link. Do not promote unanswered questions, individual lead details, sponsorship jokes or rep speculation to company policy. The new linked Loom, SMS video and Slack voice message were not transcribed: no content claims are based on them. Two historically unavailable sources remain excluded. The calendar directory is linked as the living source, not copied into hard-coded rep calendars.

## UI change

A scoped Markdown AST plugin converts Slack channel mentions to safe HTTPS links while preserving paragraphs, lists, inline/fenced code and existing links. Verified names are readable; unknown or inaccessible IDs use “Open Slack channel” rather than an invented name. This works when displaying saved answers without mutating chat history. No model call is added.

## Evaluation and safety gates

35 frozen cases: 19 distinct recent production questions with preceding retained conversation context, plus 16 source-grounded regressions. Both models use the same frozen compiled knowledge, prompts, medium reasoning, token limits and pipeline. A shared locked spend ledger accounts for both models and unresolved attempts; evaluation ceiling $4.75 leaves $0.25 for bounded hosted verification. Manual blinded review will distinguish useful correct answers, necessary clarification, omissions and unsupported claims. Latency, actual token cost and repeat stability matter as well as quality; a newer model is not presumed better.

### Results and decision

Keep GPT-5.6 Luna at medium reasoning. GPT-6 is cheaper but did not establish a quality improvement and was slower in this sample. No production FAQ model change is required.

| Matched initial 35 cases | GPT-5.6 Luna | GPT-6 Luna |
| --- | ---: | ---: |
| Acceptable, including appropriate clarification | 34 | 33 |
| Material answer issue | 1 | 1 |
| Technical failure | 0 | 1 |
| Median latency | 14.990 s | 17.565 s |
| Nearest-rank p95 latency | 23.846 s | 32.916 s |
| Reported token cost | $0.240596 | $0.117219 |

Initial snapshot: `140a74166415d203697d04e2`. GPT-5.6 confused the live coordination channel with the separate HubSpot email-claim channel once. GPT-6 omitted the Island no-guest exception in a broad package summary once and had a provider HTTP 500. Clarified these two source records directly; did not rewrite prompts or loosen grounding safeguards. Final snapshot: `80e8e644aec62299ac2f94c9` (2,498 records).

Seven matched targeted attempts per model on the final snapshot: GPT-6 7/7 acceptable; GPT-5.6 6/7 acceptable. GPT-5.6's failure was evidence validation rejecting a generated channel URL that was not supplied in the retrieved evidence, rather than malformed JSON. The other channel repeat succeeded; both models handled the explicit Island exception. GPT-6 appropriately requested documentary scope on the B-roll case; GPT-5.6 answered directly. Across both rounds each model had two unsuccessful attempts out of 42. These are diagnostic samples with repeated cases, not an estimate that 95% of all future questions will be correct. All failures remain in the private receipts.

Total local comparison ledger, including early compatibility/partial runs and conservative failed-attempt accounting: **$0.47437231**, no outstanding reservations. Initial comparison cost above uses reported tokens only and cannot measure unreported provider-500 billing. Hosted checks are additional and have a reserved $0.25 allowance within the $5 cap. GPT-6's reported-token cost was about 51% lower for the initial sample, not enough to override this user's quality/latency priority. No further tuning loop is justified by this small evaluation.

## Verification notes

358 Ask Sales tests, three coaching route tests, TypeScript, scoped ESLint, static validation and a production build passed. The final knowledge clarifications passed 19 targeted tests. Both repository CI workflows passed on the initial candidate; final commit CI passed and publication verification is recorded below.

TypeScript exposed pre-existing possibly-undefined response assertions in the recently added coaching test; three explicit test assertions now fail clearly if no response exists. No coaching runtime behavior was changed. Hosted isolated preview verified authenticated FAQ, both admin pages and Coaching (HTTP 200); one GPT-6 Island answer was correct, persisted in the isolated database, and its own test fixture removed. The final candidate remains on GPT-5.6. Production release verification passed as recorded below.

## Rollback

Retain prior FAQ model setting and knowledge snapshot. If the candidate fails its gates, keep the current FAQ model and release only independently passing knowledge/UI work. Do not roll the shared dashboard back across other teams' subsequent changes. Prefer a scoped revert of this release and FAQ-only model setting.

## Verified publication

Dashboard PR238 merged to `16052b6db31f25f0a16f47d4975f629948d18e1a`; FAQ PR83 merged to `da7f216f626c772366343f2a598c16cc4ec8feff`. Production deployment `dpl_39sZj6AXTF2RsLvx1Pm54tMxQouc` is READY on the rose alias. Final isolated preview uses GPT-5.6 and returned the correct Island no-plus-one answer (14.530 s), with isolated persistence and own fixture cleanup verified.

Work Chrome profile verified an old saved answer now renders “Open Slack channel” without changing history. A new live question correctly distinguished HubSpot email assignment from live call coordination and displayed the readable #hubspot-passoff link. Production database read confirmed GPT-5.6, knowledge `80e8e644aec62299ac2f94c9`, no error, 12.137 s response, and the new governed evidence record. The verification chat is retained in admin history. A narrow deployment error-log query returned no errors; this is a smoke check, not a guarantee about all future traffic.

An initial final-preview check accidentally reused the earlier client request ID and received the existing cached response. It was excluded as fresh verification and rerun with a unique ID; the isolated database check caught this correctly. No retry-model or production behavior changed.

The publication receipt is updated only after the above live proof. No production model setting, coaching runtime, source document, Slack message, database branch or scheduler was changed. Preview-only model configuration was restored to GPT-5.6.
