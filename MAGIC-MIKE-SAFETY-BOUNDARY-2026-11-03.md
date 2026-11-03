# Coaching safety boundary repair — November 3, 2026

## Scope and root causes
Two October 30 official reports remained explicitly held. One safety finding used numeric bracket notation (`strengths[2].observation`); the guard accepted only dot notation and rejected a legitimate prose target. Another report passed the AI safety screen, but deterministic wording cleanup changed the show title `Clean and Thriving`; the immutable-classification check correctly rejected that change.

## Correction
- Canonicalize numeric array indexes for Enhanced safety finding paths before mapping, retaining the prose allowlist and fail-closed behavior for protected, malformed or unmappable targets.
- Restrict final wording and placeholder cleanup to allowed prose paths. Preserve show identity, categorical labels and evidence metadata. Legacy cleanup is unchanged.
- Apply to official and manual coaching; two Code nodes per workflow. No models, prompts, graph, credentials, retries or AI stage counts change.
- Leave compliance refresh timeouts unchanged: later reads succeeded and last-successful snapshots were preserved.

`build-safety-boundary.cjs` creates candidates from private current baselines and refuses unexpected anchors. The older historical builders are not a standalone current-production deployment recipe; apply this boundary migration to their matching output before release.

## Validation and rollout
152 coaching-related tests passed before final runtime checks; targeted boundary tests passed after completing helper injection. Extracted candidate Code-node functions for both workflows passed runtime checks for bracket-path mapping, path-only findings, metadata rejection and show-name preservation. Graphs and all unmodified nodes match the baseline exactly.

Private baseline/candidate and verification receipts live in ignored `.private-safety/`. No transcripts, credentials or provider results belong in GitHub.

Production publication and two-call recovery are pending verification. Do not interpret a successful code test or deployment as delivery proof.

## Recovery and rollback
Before recovering either exact held source, verify source owner, current receipt, provider leases and absence of existing report artifacts. Reuse exact-request checkpoints only; preserve normal factual/safety review. Inspect final report, document and delivery receipts. Never release unrelated held calls or replay an uncertain write.

Rollback restores only the two changed node code parameters in each workflow from the saved baseline after checking for subsequent edits; preserve source receipts and do not replay delivered calls.
