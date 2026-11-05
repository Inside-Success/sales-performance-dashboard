# Coaching repair contract — November 5, 2026

## Scope and cause

This release addresses two manual safety-finalization failures and two held automatic reports. It does not change Script Adherence, FAQ, scoring, classification policy, source intake or report delivery destinations.

The automatic holds exposed two contract defects: overlapping sentence repairs could invalidate a later target on the same field; and an extra `improvements.suggested_words` field could pass generation validation but fail the safety prose allowlist. Manual finalization only supported one local adjective substitution, so other L1 candidates failed even when the existing safety screen found their wording supported. The certification detector also matched `approved` inside `unapproved`.

## Changes

- Certification matching uses word boundaries. The existing safety screen explicitly adjudicates each L1 candidate by ID and reason. A generic pass cannot clear a candidate; incomplete or contradictory judgments remain held.
- Safety findings map to an explicit prose field and a matching quote. Ambiguous unpathed findings and metadata targets remain held.
- Multiple findings on one field become one atomic repair. The response must contain exactly the requested IDs and paths. A SHA-256-bound request ID covers the exact prompt and schema; the saved original field is checked locally, so models do not need to echo long quoted text. Missing, duplicate, unexpected, stale, unchanged directly flagged fields or citation-changing edits fail closed. Sibling prose is reviewed alongside a finding so a heading-only edit cannot leave the same endorsement in its body; context-only fields may be explicitly retained. The reviewed report contract is validated again before rendering.
- Model-generated improvement example wording is preserved in the canonical action **before** factual/safety review. It is not exposed retroactively by the renderer. Unknown fields are rejected by generation/audit validation rather than silently ignored.
- Repair responses use a scoped structured-output schema; exact target counts and semantic/protected-field checks remain local. The schema uses only supported provider constraints ([provider documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)). It is not treated as proof of factual accuracy.
- Manual substantive repairs use the existing durable provider conditionally. An unreachable confirmation provider node is repurposed; total node counts are unchanged. Normal reports do not acquire an extra repair pass. Both outputs reach finalization, where errors or mismatched request IDs are rejected.
- Exact-request checkpoints, source owner checks, uncertain-write holds and delivery deduplication remain intact. New prompt content produces a new request hash; old paid requests are not reset.

## Release boundary

`build-repair-contract.cjs` is an offline, fail-closed builder applied to verified live snapshots of official `L8Nn7xncA9ZPDdWA`, manual `BMRrGxHyXMcgO6j3`, shared reviewer `FShnTde2OGhIUZE4`, and durable provider `X9L4JtDbpkSCflxZ`. Only embedded report-contract copies and the specified safety/manual repair paths change. There is no deployment in the builder. Publish must compare live versions/nodes/connections against the saved baselines before each update and verify the active published version afterwards.

## Verification so far

- 218 coaching, source-claim, provider-checkpoint, recovery and presentation tests passed.
- Existing handoff, retry, durable-provider, crash-recovery, reliability, source-accounting, accounting-handoff and no-show verification scripts passed.
- TypeScript and production build passed. The first local build encountered an existing external `node_modules` symlink; installing this checkout's locked dependencies resolved it without changing the lockfile.
- Full candidate safety/repair/finalization code replayed against three retained failing execution traces. These use explicit synthetic screen/repair fixtures to test mechanics, **not** to claim model accuracy.
- Live screen evaluation cleared the manual summary and supported directives, while retaining two substantive automatic repair findings. Pre-release repair trials exposed quote/line-break echo fragility; the final contract avoids model echoes and binds exact input through request hashing. One schema trial was rejected before generation because numeric array bounds are unsupported; local target-count validation remains authoritative.
- A separate bounded provider evaluation is underway for the same three source records, with no report/Slack writes. Production workflows have not yet been changed.

## Remaining acceptance

Review real safety decisions and any repairs against the source evidence, complete CI and deployment verification, publish with baseline checks, then recover only sources proven undelivered. Verify actual report artifacts and authenticated UI. Preserve a hold if source evidence or delivery history cannot establish safe recovery. Record final costs, production versions and outcomes below.

## Rollback

Private baseline and candidate snapshots are retained under `.private-safety/repair-2026-11-05/`. Restore only the affected workflows after comparing their current published versions, and revert the scoped Git commit if the shared provider endpoint requires rollback. Do not reset checkpoints, erase failure receipts, delete reports or replay uncertain deliveries.
