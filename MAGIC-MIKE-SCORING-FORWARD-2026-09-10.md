# Call 2 scoring correction — September 10, 2026

Status: isolated candidate under evaluation. NOT released. No backfill authorized.

## Scope and boundary

User approved forward-only scoring improvements and showing only the numeric call score on the rep's coaching dashboard report. Detailed evidence stays behind the existing manager allowlist. Testing budget maximum $30, minimize spend. Historical scores/reports remain untouched. No Slack/source Google writes, no test notifications, no compliance or Ask Sales changes.

## Implementation

- Retains existing 20/25/25/30 dimension weights, 10/32/55/76/93 bands and deterministic caps/floors. No forced bell curve or blanket uplift.
- Coherent scorer-local prompt replaces conflicting old policy/coaching instructions. Retains ten legacy compatibility coaching fields; the separate official coaching writer still supplies the actual rep report.
- Strips upstream AI classification prose from transcript evidence supplied to the scorer. Explicit prospect/opportunity review and contextual cap checks handle technical truncation, financial disqualification and agreed contract review. Conservative single-speaker plus explicit practice-language guard withholds likely rehearsals; one speaker alone is insufficient.
- Every dimension has a reason and grounded counterevidence; manager persistence retains those details. Existing bounded validation retry remains.
- Same Sonnet 4.6 model, with bounded 2,000-token reasoning. Shorter coherent prompt removes obsolete duplicated context. Existing provider, credentials and graph retained.
- Persistence accepts old/new versions during in-flight drain, builds immutable versioned IDs, and rejects unknown versions.
- Rep-facing score lookup matches current version, source record, rep email and call time. Returns numeric score and opaque assessment ID only. Store failure withholds score without blocking the coaching report.
- Manager overview and drilldown keep current and historical cohorts separate. Earlier scores remain accessible through historical navigation; no mixed averages/trends.

## Deployment order and rollback

Private full baseline snapshots: `.magic-mike-scoring-2026-09-10/baseline/` at workspace root. Dashboard baseline `33a1b8f`. Scorer `35bFcPYdHSADpyTN` and persistence `iG6pvqUTn0askw9y` are existing Rudy-owned project dependencies with caller restricted to official `L8Nn7xncA9ZPDdWA`; preserve caller policy and credential IDs.

Publish backward-compatible persistence, then validated scorer revision on the existing workflow ID (no duplicate trigger), then dashboard. API updates to active workflows publish immediately. Restore baseline Code nodes to roll back scoring; old/new persistence remains compatible. Revert dashboard commit separately if needed. Do not delete rows or rewrite reports during rollback.

## Verification checkpoints

Frozen 40-call sample: 25 development and 15 heldout. Known edge cases must pass before release; repeat checks preserve eligibility and avoid unsupported cap flips. Existing scores are baseline; paid test outputs stay isolated and never pass through report/persistence/delivery workflows.

102 scoring/access tests and four new numeric-only lookup tests passed. Production build passed after replacing a local cross-worktree dependency symlink with an ordinary isolated installation. Full actual-runtime replay, model evaluation, release and natural delivery verification still pending at this checkpoint.
