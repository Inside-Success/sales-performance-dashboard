# Coaching wording completion and cost comparison — September 30, 2026

## Authorized scope and root cause

User authorized the general placeholder fix and isolated model/cost comparisons within the existing total $40 hard ceiling. Quality takes precedence over savings. Compliance policy review remains deferred.

Actual execution 887294 (dashboard report7006) shows the writer was explicitly instructed to use `[confirmed initial amount]`, and the factual reviewer explicitly allowed that template. It was inherited prompt behavior, not a missing payment value to invent. The finalizer lacked a completion guard.

## Released behavior

- Official and manual writer, factual reviewer and conditional repair instructions now require complete generic advice when a value is unavailable. The shared official factual-review subworkflow receives the same correction.
- Both finalizers complete recognized template slots before the existing structured-content consistency guard. If flat content changes, stale structured enrichment remains invalidated as before; safety repair still takes precedence. No extra AI stage or provider request is introduced.
- Dashboard report content, report-chat context fields and manager evidence excerpts complete the same recognized slots on read. Actual amounts, timestamps, evidence IDs and ordinary bracketed transcript text are preserved. Chat's source transcript remains unchanged.
- Read-only rolling 30-day audit: 1,441 official scored reports and 14 completed manual reports; 20 official reports contain the actual template, zero manual reports in this selection. All 20 saved records replay through the shared completion. Original records and existing Google Docs are not regenerated or rewritten; old section layouts are unchanged.
- A generic phrase is not confirmation of an approved amount. The completion never supplies a price, date, name or contractual promise.

## Cost comparison and decision

Five isolated permutations were tested on real whole-call fixtures: Sonnet5.5 reviewer medium effort, Sonnet5.5 writer low effort with high-effort reviewer, Sonnet4.6 writer, Sonnet4.6 reviewer, and Sonnet5.5 high-effort reviewer with concise-output instructions. Existing Luna comparison remains relevant: its counterevidence failure on fixture884422 disqualified that replacement.

- Medium reviewer over-rejected supported practical coaching, including all three actions in report7006's fixture.
- Low-effort writer/high-effort reviewer retained a contradicted audience claim on fixture884422 despite explicit transcript counterevidence T0204. Not selected.
- Sonnet4.6 writer and reviewer first requests hit HTTP524 deadlines. These are operational failures, not evidence of inferior content quality. Further runs were stopped; outstanding request reservations remain counted conservatively.
- Concise high-effort review retained/corrected useful points, but was not consistently cheaper: four reviewer charges approximately $0.10019, $0.06210, $0.04688, $0.11071. It does not establish a reliable savings advantage over the current reviewer. No model or reasoning-effort downgrade released.

Current coaching models remain Sonnet5.5 writer and factual reviewer; DeepSeek safety screen; conditional Sonnet4.6 repair; GPT-6 Luna report chat. Classifier, compliance and numeric scoring are unchanged. A full call's cost includes those separate stages and conditional repair; this release does not claim a new lower average per-call cost.

Private cost receipts total approximately $10.6191 including started/uncertain-request reservations; with the existing $0.10 browser-chat reserve, the overall authorized test bound is below $10.72, under $40. This is a conservative usage estimate, not a reconciled provider invoice. Incremental comparisons in this pass reserve approximately $2.533 since the previous ledger.

## Verification and limitations

- 90 targeted tests pass, including official/manual chat source preservation, report rendering, manager semantics, transcript access, old report layouts and numeric-score matching. TypeScript and webpack production build pass; scoped lint checked separately.
- Actual report7006 finalizer replay passes; 11 other real official/manual fixtures pass with identity, compliance, existing gate outputs and unaffected fields preserved. Injected manual template completes without bypassing the structured-content guard.
- Published official finalizer → actual current Google Doc request renderer completes wording without a source write. Existing document renderer and delivery routing are unchanged.
- Exact readback confirms nine intended code fields changed across three active workflows; all node connections/settings and unrelated bodies match the fresh backups. Validation results match the baseline exactly: official eight existing static return-shape findings/seven warnings, manual zero errors/four warnings, shared reviewer zero errors/warnings. Do not report official static validation as wholly clean.
- Private backups, full execution evidence, transcripts, test receipts and candidate graphs remain outside Git in the parent `.magic-mike-coaching-insights-2026-09-30` directory. Never commit that evidence or credentials.
- Hosted deployment and authenticated UI acceptance are recorded below after release. Replay is not a naturally arriving delivery, and no claim of guaranteed future error-free AI output is made.

## Rollback

Revert this dashboard commit/PR. For n8n, restore only the nine changed `parameters.jsCode` fields from `placeholder-prepublish-<workflow-id>.json`, after refreshing current state to preserve intervening changes. Do not restore entire graphs or credentials. Backups and exact patches are private; reusable transforms are in `scripts/coaching-insights/placeholder-patches.cjs`.
