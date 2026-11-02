# Unattended script-adherence implementation — in progress

Authorization: Moonis requested a fair Haiku/Terra/Luna comparison, independent factual review experiments, and an implementation suitable for unattended company-wide processing. The existing $40 total ceiling applies. Full-week backfill remains off. No Slack messages are authorized.

## Current boundaries

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
