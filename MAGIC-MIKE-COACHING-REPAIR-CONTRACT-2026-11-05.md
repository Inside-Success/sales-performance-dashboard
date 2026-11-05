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
- Manual substantive repairs use the existing durable provider conditionally. The unreachable confirmation provider is repurposed for repair, and its dormant builder becomes a native manual recovery entry that feeds the existing input validation and failure handler. Recovery therefore needs neither a same-instance webhook call nor a cloned delivery workflow. Total node counts are unchanged. Normal reports do not acquire an extra repair pass. Both outputs reach finalization, where errors or mismatched request IDs are rejected.
- Exact-request checkpoints, source owner checks, uncertain-write holds and delivery deduplication remain intact. New prompt content produces a new request hash; old paid requests are not reset.

## Release boundary

`build-repair-contract.cjs` is an offline, fail-closed builder applied to verified live snapshots of official `L8Nn7xncA9ZPDdWA`, manual `BMRrGxHyXMcgO6j3`, shared reviewer `FShnTde2OGhIUZE4`, and durable provider `X9L4JtDbpkSCflxZ`. Only embedded report-contract copies and the specified safety/manual repair paths change. There is no deployment in the builder. Publish must compare live versions/nodes/connections against the saved baselines before each update and verify the active published version afterwards.

## Verification

- 221 coaching, source-claim, provider-checkpoint, recovery and presentation tests passed.
- Existing handoff, retry, durable-provider, crash-recovery, reliability, source-accounting, accounting-handoff and no-show verification scripts passed.
- TypeScript and production build passed. The first local build encountered an existing external `node_modules` symlink; installing this checkout's locked dependencies resolved it without changing the lockfile.
- Full candidate safety/repair/finalization code replayed against three retained failing execution traces. These use explicit synthetic screen/repair fixtures to test mechanics, **not** to claim model accuracy.
- Live screen evaluation cleared the manual summary and supported directives, while retaining two substantive automatic repair findings. Pre-release repair trials exposed quote/line-break echo fragility; the final contract avoids model echoes and binds exact input through request hashing. One schema trial was rejected before generation because numeric array bounds are unsupported; local target-count validation remains authoritative.
- The final bounded provider evaluation passed actual safety/finalization for the retained manual source and two automatic sources. The first automatic repair removed credit-card endorsement across heading/body/reason; the second generalized an asset recommendation without claiming that the disputed benefit is categorically unavailable. An empty optional example label is removed deterministically, without inventing wording. Both original manual Zoom transcripts are accessible. Same-credential Drive and Airtable reads found no artifacts for the failed submissions or held automatic sources. Production rollout and recovery acceptance are recorded below.

## Production release and recovery acceptance

PR [383](https://github.com/Inside-Success/sales-performance-dashboard/pull/383) merged as `65d0d6e4db2d0b5a8361eab31ffc2e48353c759f`. GitHub deployment status and Vercel inspection confirm production deployment `dpl_CiVwp5pWttF7uZQDTeq4fRHqxrus` is Ready on the canonical dashboard domain.

Published workflow versions were re-read and matched the candidates:

| Workflow | Published version | Nodes |
| --- | --- | --- |
| Durable provider | `2d1648ea-1fc0-4485-8319-8c391ec4496f` | 18 |
| Shared reviewer | `72966413-dda8-49ee-b236-609e87c2012b` | 15 |
| Manual coaching | `88520ee7-b50f-4f95-bebf-5c4d73eee7d7` | 55 |
| Official coaching | `26ff02dc-c408-405f-9342-e19e58dc659f` | 159 |

Native n8n replay `1554492` verified hashing, repair preparation and finalization in the actual runtime. Live connection validation passed for manual and official workflows; pre-existing unreachable legacy-node warnings were preserved. Normal model/node counts and one-at-a-time recovery throughput are unchanged.

Recovery was limited to four exact sources after checking their original transcripts, existing reports, claims and document artifacts. Original failures and complete receipts remain private. Both manual reports completed through the actual manual workflow: Sarah `1554518`, Alejandra `1554532`. Their existing self-report URLs now show the completed Enhanced reports, Google Doc and transcript links, verified in the authenticated dashboard. The automatic recoveries use the existing scheduled worker and exact source-owner guards.

Both automatic recoveries completed: `1554581` produced dashboard report [9224](https://sales-performance-dashboard-rose.vercel.app/call/9224), and `1554646` produced [9225](https://sales-performance-dashboard-rose.vercel.app/call/9225). Each exact source has one dashboard row, a completed owner claim and a Google Doc. Saved executions confirm document content insertion, Slack delivery responses and dashboard acknowledgment. Both complete Enhanced reports and source links were inspected in the authenticated UI. The final report preserves observed history while giving supported promotional guidance; the former extra-field content passes the shared canonical review contract.

Final scoped audit: **4/4 recovered**, two manual completed rows, two automatic report rows, both automatic claims `done`, no running provider checkpoints for these sources. Usage-priced incremental API cost is **$1.629516189** across 18 unique new provider responses, including paid unsuccessful evaluation trials, deduplicated by provider response ID and excluding prior paid checkpoints. This is usage-based accounting, not an invoice or a reservation. Normal reports gain no extra AI stage; conditional substantive repair can still incur its existing model cost.

Temporary evaluation/recovery workflows are deactivated, with no running executions in those checked workflows. No unrelated executions were cancelled. External provider outages, genuinely unsupported content and uncertain writes can still be held; this release fixes the demonstrated repair-contract failures without weakening those controls. It is not a claim that future failures are impossible.

## Rollback

Private baseline and candidate snapshots are retained under `.private-safety/repair-2026-11-05/`. Restore only the affected workflows after comparing their current published versions, and revert the scoped Git commit if the shared provider endpoint requires rollback. Do not reset checkpoints, erase failure receipts, delete reports or replay uncertain deliveries.
