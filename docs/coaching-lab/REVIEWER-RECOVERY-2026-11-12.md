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

## Deployed verification
PR437 merged as `72aaea33a842d0c0355f99942854037fe55f4e7d`; Vercel production deployment `dpl_ApHJnWb12CVerfY8FJbLPzPLPz9M` was READY at that exact revision. CI passed 438 tests across 60 files, the production build, TypeScript and existing recovery/accounting checks. Published workflow versions were read back: official `642f89f0-3e73-4778-97db-8887d43f52f4`, manual `e45e965c-8c21-4785-b33b-87184af67cfd`, core `fbd80616-b8d5-406d-825a-306e125cf303`, provider `ef96617b-644f-44bd-b197-61d7b4cf5af1`. Connections, credentials and settings matched the guarded baseline.

At 19:02 UTC, the two exact held claims and recovery rows7572/7620 were released with owner/status guards and no existing artifacts or running provider requests. Shari's original terminal receipt was restored from execution1718401 with matching source, request, hash and owner; attempts remained one. Recovery uses the scheduled existing worker. Queueing is not delivery confirmation; final outcomes follow below.

### Connected recovery follow-up
Shari recovered as dashboard report9700 with Google Doc `1N0-Ij0Fbha0o3ylT46okgv5v79iCj2TZ4kPeEwJCoWY`, successful coaching Slack top/thread receipts, a done claim and delivered recovery row. Authenticated production rendering was checked, including Key takeaway, categories, next steps and no-payment outcome.

Jason's independent eligibility review confirmed the casting-only exclusion using five exact source excerpts, but parent1720522 held the result because `MM Reliable Coaching` still contained the previous boundary runtime. The initial patch updated the later safety builder but missed this earlier official consumer. The follow-up updates both explicit official consumers, adds regression coverage requiring both, and replays Jason's actual saved parent input through the compiled patched node successfully. No provider request identity or receipt changes; the completed independent review must be reused. Manual's actual consumer was already updated. This is a deployment-consumer coverage correction, not a relaxation of exclusion checks.
