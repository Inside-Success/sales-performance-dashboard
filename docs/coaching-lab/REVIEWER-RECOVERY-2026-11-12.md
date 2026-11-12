# Reviewer terminal output and eligibility recovery — November 12

## Observed failures
Shari Weller / Tropico Sands (`recVw1MQKEsHheeRG`) stopped after reviewer execution1718401 exhausted its 12,000-token limit entirely on reasoning, returning no JSON. The OpenAI decoder correctly marked the output invalid, but the durable handoff discarded its terminal receipt and never reached a recovery transition. Parent1718335 recorded a hold; it did not deliver a report.

Jason Tello / Eviashley Santiago (`recalnP25pzpuKWH0`, parent1719538) was held because the reviewer proposed excluding a casting/discovery conversation. The first response was a full excluded report instead of an audit envelope; the contract repair then attempted a forbidden `status` edit. The transcript explicitly schedules the detailed agreement/package discussion for a subsequent call despite its Followup title. Status editing remains prohibited in ordinary coaching reviews.

## Scoped implementation
- Known terminal malformed/truncated reviewer receipts are retained as failed evidence and returned to the core at zero new cost on resume. Unknown transport outcomes, missing usage, refusals and identity mismatches remain held.
- The first reviewer may receive one separately checkpointed output recovery with a 24,000-token allowance and a compact review-envelope instruction. The same full source, policy and candidate remain available. A repeated invalid recovery holds; there is no unbounded loop or routine extra model call.
- A source-valid excluded report or supported status-change proposal triggers a separate eligibility review. It cannot directly suppress a report. The independent review must confirm the exact proposal digest and provide exact source quotations; disagreement stays held. Ordinary review still cannot edit status or identity. The parent verifies both proposal and confirmation receipts plus the original writer before normal exclusion accounting.
- Existing request identities, original receipts, successful report data, scores and ordinary report presentation are preserved. Script Adherence and FAQ are untouched.

## Release safety
Private before/target snapshots and recovery evidence: `.private-coaching-lab/reviewer-recovery-2026-11-12/` (not committed). Install only against matching live versions and shapes. Change two core bundles, two provider receipt gates and one exclusion-binding bundle in each parent; preserve every connection, credential and unrelated setting. Deploy additive checkpoint support before publishing the workflow changes. Keep scoped rollback ready.

Recover only the two named held owners after confirming no artifact or active request. Shari's exact terminal receipt can be restored from native execution1718401 using source/request/hash/token matching and compare-and-set on the still-failed empty checkpoint; never rerun that original paid request. Preserve Jason's existing reviewer and repair receipts. Use the existing recovery worker and verify actual delivered artifacts or justified exclusion accounting.

## Verification status
Pre-release: shared and compiled native transitions agree on both saved real failures. Regression tests cover terminal output, unknown/refused outcomes, bounded repair, deterministic identity, exclusion confirmation, source quotes and missing receipts. Isolated PostgreSQL tests cover repeated receipt reuse, one attempt and stale ownership rejection. Production verification is recorded after deployment below.
