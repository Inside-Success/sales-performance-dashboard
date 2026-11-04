# FAQ recovery and admin clarity — November 4, 2026

## Scope and behavior

Implemented and production answer-verified; publication receipt follows this verification. This release adds manual recovery and admin explanations, with one targeted knowledge addition. It does not change the model, answer prompts, automatic retry limits, retrieval scoring, Coaching, authentication, environment, or schema.

- The chat preserves the exact request ID and original bounded conversation context after an uncertain network/JSON/HTTP outcome. **Check for answer** resends the same request to the existing viewer-scoped guard: a completed result is replayed without another model call, and an active request cannot be duplicated. There is no background polling or automatic retry loop.
- Only a confirmed safe-fallback response offers **Try this question again** with a fresh request ID. The failed answer is omitted from retry context; the visible question is not duplicated. A saved last-turn fallback with recorded revamp technical-failure metadata can also be retried after reopening history. Legacy fallback labels alone are insufficient. Attempts remain auditable in backend history; this is not deletion or rewriting of prior failures.
- Queued follow-ups pause after a technical, validation, rate-limit or active-duplicate response, rather than continuing against a failed answer. Retry clicks are guarded synchronously against concurrent work. Nontechnical clarifications, source gaps and human actions do not get a regenerate button.
- Loading remains immediate. A single local 20-second timer changes the message to “Taking longer than usual”; it adds no network or model work. Existing accessibility and mobile layout are preserved.
- Admin conversation filters now expose recorded source gaps, clarifications, human actions and conflicts. Conversation badges and detail explain these as response categories, not proven accuracy judgments. Historical unknowns stay unknown. Technical details display whether automatic recovery was unused, successful, or exhausted, using existing stored metadata. Queries remain authenticated and read-only; no extra AI calls or migrations.

## Source investigation

Mike explicitly expanded DFD as Double Fricken Day on October 24 and used it for an individual rep’s two-sale day on October 29. The new resource explains this directly while preserving the distinction from team-wide uses and dated bonus examples. It does not promise universal bonus eligibility.

Sources read in full:
- https://istvoffical.slack.com/archives/C09AF0NQJE7/p1792850697389389 (parent and 15 replies)
- https://istvoffical.slack.com/archives/C09AF0NQJE7/p1793300075926479 (no replies)

Targeted Slack searches and the November 3 saved Performance KPI Expectations document do not establish a definitive current RPC/RPCT formula. Historical April–July booked-call remarks, newer Call-2 dashboard summaries, and separate revenue-per-contract discussion must not be conflated. This remains an explicit source gap. Existing approved follow-up wording from the prior release remains; missing exact templates are not invented.

This is not a full weekly refresh. Keep `KNOWLEDGE-CHECKPOINT-2026-11-03.json` watermarks unchanged. Current runtime knowledge becomes `6839e960c76ed03d05c6b50a` with 2,593 records. Source systems were read-only; no Slack messages were sent.

## Validation and limitations

19 client/admin tests and four route tests verify retained context, exact-ID replay, no model/charge/write on replay, active-request containment, authentication and per-viewer guard scope, malformed responses, status distinctions and unknown historical metadata. The admin queries were exercised read-only against current production data for all six views; returned categories matched filters and summary totals remained consistent. Three isolated model checks (DFD definition, bonus boundary, unresolved KPI formula) completed and were reviewed; total estimated cost $0.020142.

The normal successful-answer path still makes one request and the same model calls. Admin filtering reads additional JSON metadata in existing queries; sampled whole read/detail times were roughly 0.5–2 seconds. These timings are observations, not a latency guarantee.

Manual recovery does not guarantee provider availability. An uncertain request that remains in progress is not force-restarted. Saved historical attempts remain counted as attempts, and automated status labels are not accuracy grades. No production failure is deliberately induced to test this UI.

## Release and rollback

Use GitHub/Vercel checks and authenticated work-profile chat/admin verification. Keep the prior production deployment available. Revert only this scoped change if needed; preserve concurrent Coaching changes and restore the matching knowledge receipt. Final release evidence is recorded below after verification.

## Verified production release

Dashboard PR373 merged as `46a2eae455494308b717495efa25c761e12a6086`; FAQ export PR123 merged as `07c2df3c9b6ed407afb8f2e578839bc4ce6d238e`. Deployment `dpl_6dJE9DFqPRq7PbozHBVSi493LnAh` is READY on the production rose alias. Final CI passed 492 FAQ tests, 107 static safety checks, TypeScript, scoped ESLint and the production build; the separate reliability suite passed 212 tests. Static checks were updated to recognize the new recovery wording and test the composer specifically instead of treating the retry button as the textarea.

Two authenticated work-Chrome production answers were verified in the UI and stored records: `faq_assistant_3773bac0-32a9-4377-9079-9180c270260a` and `faq_assistant_047db709-47e1-444e-a56a-a5039267d542`. Both answered from evidence, used knowledge `6839e960c76ed03d05c6b50a`, had no technical error, required zero retries, and preserved follow-up context. Recorded answer times were 6.959 and 8.653 seconds. This small sample is not a production-wide latency or reliability claim. The live admin source-gap filter returned matching conversations while keeping date/person summary counts unchanged.

Private live evidence and screenshots are in `.magic-mike-faq-recovery-2026-11-04/` outside Git. Isolated evaluation cost was $0.020142; the two live checks add at most approximately $0.012368 at uncached input rates (about $0.033 total). No broad rerun or intentional production failure was performed.

The authenticated live admin detail for the November 3 timeout correctly displayed “Automatic retry used; answer still failed”, the review stage, provider timeout reason and message ID. This diagnoses the historical event without relabelling it as repaired.
