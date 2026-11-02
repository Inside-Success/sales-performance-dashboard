# Unattended script-adherence implementation and verification record

Authorization: Moonis requested a fair Haiku/Terra/Luna comparison, independent factual review experiments, and an implementation suitable for unattended company-wide processing. The existing $40 total ceiling applies. Full-week backfill remains off. No Slack messages are authorized.

## Initial checkpoint — superseded by release evidence below

- Existing coaching, intake, recovery and accepted 42-call sample are preserved.
- PR359 adds Luna to the isolated cost-reserved dispatch allowlist. It does not enable scheduled analysis.
- Additive processing tables are installed with `script_adherence_control.enabled=false` and an empty canary allowlist. No unattended call has been published.
- New queue/read-model code in this branch is not yet accepted for release. End-to-end verification and comparison remain required.

## Comparison design

- Thirty previously reviewed calls are a development/reference set, not an untouched holdout. Freeze is saved privately before new model calls.
- Each model receives the same full transcript, rubric, medium reasoning setting and token ceiling. No previous per-call correction instructions are supplied.
- Test all three writers and all nine writer/reviewer pairs. Reviewers receive original full source and untrusted raw draft, and can change classification and the checklist.
- Track classification, action-status agreement, video decisions, invalid outputs, corrections/regressions and receipt-based cost separately. Agreement with the reference is not guaranteed real-world accuracy.
- Twenty unused calls from nineteen reps are saved separately for holdout testing. Source metadata is only sampling context, not truth.
- Early fixed multi-script grammar experiments were rejected before generation; preserve zero-cost rejection receipts and do not count them as model accuracy failures. Variable checklist output remains validated by the application.

## Reliability architecture being verified

- Twice-daily batch invocation; no execution per call.
- Two Zoom closer-group sources with complete pagination, durable coverage pages, overlapping readiness scans, and retained pending recordings.
- Meeting-level identity is account plus meeting UUID; preserve every transcript recording segment in chronological order.
- Source-download leases may safely expire; uncertain paid requests may not be blindly replayed.
- Independent draft/review stages use atomic budget reservations. Exact provider receipts survive interruption and settle once.
- Accepted results are published only after full source-bound validation. Existing saved calls are not overwritten by comparison outputs.
- Dashboard aggregates all matching metrics in SQL; only one page of call evidence is returned. Filters, overall summary and rep detail use the same population.

## Resume evidence

Private artifacts live in `.private-adherence/` (ignored, not committed): `benchmark-reference.json`, `compare-*-manifest.json`, `compare-*-requests.json`, `compare-*-receipts.json`, `compare-*-parsed.json`, `comparison-summary.json`, `comparison-disagreements.json`, and `holdout-calls.json`. The database is the budget/dispatch source of truth. Never blindly rerun a submitted request after an interruption.

Owned test workflows: provider transport `2xX5gVtc1BKlhyG3`; read-only source retrieval `N4p6MUMGBcQyRwtH`. Activate only for a scoped run and deactivate afterwards. Production coaching workflows are out of scope.

No release acceptance or company-wide quality claim has been made at this checkpoint.

## Second checkpoint: bounded processing and comparison

- All three writers and nine writer/reviewer pairs completed on the same 30-call development set. Terra alone agreed on 325/339 reference actions; Terra/Terra agreed on 328/339 but introduced one false video omission. The refined review prompt restored that video decision, with 325/339 action agreement. These are reference-agreement measurements, not a claim of perfect ground truth.
- Same-source independent review is not automatically more accurate. Source audit also found ambiguity in several older reference labels; the frozen reference has not been silently changed.
- Twenty unused calls are being evaluated under the refined prompt. Terra draft/review returned complete valid checklists after deterministic removal of one extra known out-of-script action. Haiku returned 17/20 valid outputs; remaining failures include an unsupported inapplicable action, an unsupported omission and an invalid evidence reference. Luna is still running at this checkpoint.
- Provider outputs remain private benchmark artifacts; no new accepted dashboard calls are published.
- Worker `WqvZP7IX0YwlxfTZ` handles at most twelve six-item work batches or twenty minutes, with at most three provider requests concurrently. Coordinator `hb3M0O7fYx04oVEs` invokes workers sequentially on a twice-daily schedule. Both are inactive. This deliberately uses a small number of bounded worker executions, rather than one execution per call or one unbounded transcript-heavy execution.
- Successful execution payload retention and progress snapshots are disabled for the new workflows. Durable database receipts, reservations and job state are authoritative. Error executions retain debugging evidence.
- Exact roster plus explicit rep-role evidence can correct recording-host attribution; ambiguous identity does not guess another person's name. Source attribution is retained.
- Oversized complete transcripts are held without truncation or repeated paid processing. Coverage freshness requires both workspace checkpoints.
- Verification so far: 62 script-adherence tests passed, TypeScript passed, both new workflow graphs validated with no errors/warnings. Native end-to-end execution and authenticated dashboard verification remain outstanding; schedules and full backfill remain disabled.

## Native canary and release evidence

PR360 merged as `80a674c72a9813c8aa23afc037ec39dfd29e8f43`, deployed to production as `dpl_3FabBfssNVnG4vkMKtyuAsY9uLLL`. Company-wide processing remains disabled. The scoped coordinator ran with its schedule trigger disabled and four explicit canary identities only.

- Both Zoom workspace coverage windows completed through 2026-11-02 18:53:15 UTC. Thirty-five other recording identities were retained pending later processing; they were not sent to AI.
- Four canary calls completed through native Zoom transcripts, Terra draft, Terra full-source review, source validation, atomic publication and dashboard metrics. Exactly eight provider requests settled, costing $0.277555 total. Native VTT costs were approximately $0.0694/call for this small, longer-call sample; do not use the shorter benchmark average as a promised production price.
- All four final action-status sets matched the separate holdout review of their Google Doc transcript. This is a consistency check, not independent proof of perfect accuracy.
- One source-host attribution was corrected from Bryce to Alexis using exact roster/speaker-role evidence. Original attribution remains saved.
- Dashboard now contains 46 calls, 23 assessed, 313 completed and 96 not-completed assessable actions. The prior 42 calls were not overwritten. The live paginated SQL reconciliation test passes.
- Authenticated production UI verified: preserved starting totals, show filtering, loading state, rep drill-down and retained filters, and the four new saved calls. Preview Google sign-in is intentionally unavailable; it was not bypassed.
- Receipt replay exposed JSON key-order sensitivity after JSONB storage. Follow-up fix compares exact JSON content for stored receipts and reserved bodies, preserving conflicting-payload rejection and single-dispatch semantics. A receipt replay after the fix made no additional charge or publication.
- Cost ledger total at this checkpoint: $6.504344 against the $40 ceiling. No uncertain canary charges remain.
- The canary allowlist was cleared. Coordinator is inactive; no full backfill or company-wide schedule is enabled. Successful full execution payloads are not retained, so acceptance uses durable per-call receipts and coverage checkpoints; do not mistake an absent successful n8n execution record for a failed run.
