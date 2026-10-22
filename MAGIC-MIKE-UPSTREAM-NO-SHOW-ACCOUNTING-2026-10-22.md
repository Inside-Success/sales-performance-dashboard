# Upstream no-show accounting — October 22, 2026

## Confirmed defect and scope

Seven finished official executions had successful rep no-show alerts, but their source claims remained running and lacked outcome receipts. These were upstream-classified rep no-shows, not missing eligible coaching reports. The upstream true branch went directly to its alert path without the receipt/settlement path. AI-classified exclusions already had a receipt writer.

## Released change

- Official workflow `L8Nn7xncA9ZPDdWA` published version `167c394b-45ef-442a-82ca-cb7a574795b1` at approximately 13:25 UTC.
- Only `MM Account Early Outcome` code and the true branch connection from `If Upstream Rep No Show` changed. All 155 node configurations were compared before/after; no other node changed.
- Require explicit upstream `rep_no_show`, a nonblank upstream reason, and exact current-item source identity. Persist an excluded outcome with original reason/provenance before settling the matching execution owner.
- Preserve the existing Call 1/short-transcript helper, classifier exclusion writer, no-show alert path, duplicate guards and accounting-error containment. No new loop connection, provider call, classification rule, dashboard change, or source-sheet write.
- Regression gate now runs `verify-upstream-no-show-accounting.mjs`.

## Historical reconciliation

Re-read all seven original executions and confirmed successful completion, matching upstream no-show evidence, and successful existing alerts. Inserted missing excluded receipts, read them back, then changed only matching source/owner claims still running to done. No workflow replay, AI request or Slack resend.

| Source | Original execution | Receipt |
|---|---|---|
| recfi7BZrStgDeQ3p | 1230994 | 2851 |
| recQ6B27cDhvCJXD1 | 1231383 | 2852 |
| recCPEy9Wq8EFQitZ | 1234993 | 2853 |
| recSbj5cdnRJ1dwVv | 1236837 | 2854 |
| recgtKfW5AiUUVT7J | 1237853 | 2855 |
| recOPTXmvl2hMdDsI | 1239557 | 2856 |
| rec33AXuCfvyM6VVj | 1246354 | 2857 |

After reconciliation: 142 done claims, zero running claims. AI recovery cost: $0.

## Verification

- New test executes the exact deployed Code-node JavaScript, including paired-item return, mixed source identities, absent/mismatched provenance, unchanged Call 1/short-transcript outcomes, duplicate-writer avoidance, graph failure routing and patch drift guards.
- Existing accounting handoff, source accounting and handoff safety checks passed; 15 source-claim/coverage unit tests passed.
- Live workflow validation: zero errors/invalid connections; six unchanged legacy unreachable-node warnings.
- Direct authenticated n8n read confirmed active and draft versions match, and the published code and branch contain the fix.
- Receipt IDs and owner-specific settlement were verified independently; this is reconciliation, not evidence of a new organic no-show passing through the new branch. Natural post-release traffic verification is recorded below when available.
- Post-release coverage execution `1247356` checked seven sources: no missing IDs, no queued recoveries, page acknowledged. Authenticated Today no-show view and Colin Urquhart popup matched one detected no-show; recent normal report `/call/8389` loaded with its complete coaching content and source links.
- GitHub reliability run `39787208412` passed the full regression gate, TypeScript and production build. Vercel's PR preview failed with `Resource provisioning failed`; no dashboard runtime code changed in this release. Production deployment verification is a separate check and must not be inferred from that preview.

## Rollback

Use `tests/fixtures/upstream-no-show-before.json` to restore only the previous accounting code and remove the one added true-branch connection, then publish and verify. n8n MCP pre-change snapshot 714 also exists. Preserve the historical receipts/claims: they describe verified completed no-shows and must not be deleted or replayed. No application rollback is required.
