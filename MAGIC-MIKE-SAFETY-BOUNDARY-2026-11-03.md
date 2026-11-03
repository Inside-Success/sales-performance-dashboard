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

Production publication and two-call recovery completed; acceptance details follow.

## Recovery and rollback
Before recovering either exact held source, verify source owner, current receipt, provider leases and absence of existing report artifacts. Reuse exact-request checkpoints only; preserve normal factual/safety review. Inspect final report, document and delivery receipts. Never release unrelated held calls or replay an uncertain write.

Rollback restores only the two changed node code parameters in each workflow from the saved baseline after checking for subsequent edits; preserve source receipts and do not replay delivered calls.


## Live acceptance
- PR 367 merged as `9f321bd7b92ad419871d31db934c27d301a6df30`. GitHub reliability gate (tests, recovery checks, TypeScript and production build) passed; production deployment `dpl_2k1GrjtWwbihfDezogWGqcc93dwR` is Ready and serves the canonical alias.
- Official published version `6ecd7214-51f4-441c-a896-cccd494bb849`; manual `32bb9945-33c0-4860-b0a7-73635fc074cf`. Published node content matches the tested candidates. Structural validation has zero errors; existing disconnected-node warnings remain unchanged.
- Exactly two known held source claims were released using owner/status checks, after source and artifact reads. Existing recovery processed one per scheduled sweep; no provider checkpoints were reset.
- Recovery child `1516753` delivered dashboard report **9094**; child `1516889` delivered **9095**. Both have one matching dashboard row, successful top-level/thread Slack responses, created and populated Google Docs, delivered receipts, and settled `done` claims. Both authenticated report pages were read.
- Report 9095 preserves the original `Clean and Thriving` show identity and all protected category/handling/resolution/evidence fields. Saved failing bracket-path input passed both patched workflow runtimes locally, including path-only mapping and protected-field rejection.
- The first call's original factual-audit checkpoint was invalid and therefore rerun; its replacement was also rejected by the contract, after which the existing validated audit-repair checkpoint was reused. The final safety screen passed without a prose repair. Its historical logistics wording was accepted, not rewritten. Do not equate model agreement with guaranteed factual accuracy or claim the live recovery exercised the bracket-path repair branch.
- New usage-priced provider cost across these recoveries: **$0.350977186** (audit $0.32639; safety screens $0.012228343 and $0.012358843). Saved matching stages were reused. No new AI nodes or recurring-cost configuration changes.
- Final source-claim audit: no held/running/retryable/queued rows at the inspection point. Both reports have unique matching source/recording identities. This is a dated observation, not a guarantee of zero future failures.
- A temporary source/artifact read helper used one successful execution, was deactivated, then removed after preserving its evidence. No temporary workflow remains active. Compliance refresh behavior and the separate Script Adherence pilot were not changed.

## Honest assessment
The two deterministic false-hold causes are fixed, regression-covered and live. The existing safety guard still blocks actual protected-field changes. Both outstanding reports are recovered. No broad redesign or expanded retries were needed; future model/provider/source problems can still legitimately require a hold.
