# Ask Sales V4.3 Runtime Freeze — 2026-07-23

## Purpose

This record freezes the isolated V4.3 implementation before the new source-backed evaluation set is selected or opened. It prevents the unseen comparison from becoming another question-specific tuning loop.

V3 production is not changed by this freeze. No V4.3 branch is approved for production by this document.

## Frozen implementation

- Branch: `agent/ask-sales-v4-3-knowledge-routing-2026-07-23`
- Runtime commit: `d8a8332b5b593cc7cfdb8ebfcb4bd4ef32ecbbe6`
- Base V4.2 commit: `283ce474bda95df84356c13c0c6c05f50a88c098`
- Preregister commit: `691bc1575614e25c24d23dda4e2b9a9cdbe7cefc`
- Curated authority schema: `ask-sales-v4-systemic-curated-authority-v3`
- Curated authority records: 26 evidence records and 29 governed policies
- Curated authority source hash: `b401dee2eb61f8d05ef458385c0bb12397f68abb7449f89807f4b962f3cf8693`
- Curated authority file hash: `5014d0428f15bb450c96c71d0ed69715d38b673fc0a4fa0fe34ddb92f0e340eb`
- Claim-authority schema: `ask-sales-v4.3-claim-authority-resolutions-v19`
- Claim-authority resolutions: 41
- Claim-authority file hash: `4601c086b693c0037f084c131b1d1bfeb37ac09a9d43c45cf2005c3d62a91409`

The runtime and knowledge files at the frozen commit must not be changed after the unseen set is selected. Any later change starts a new candidate version and requires a new freeze plus a new unseen set.

## Systemic changes included

- Rich Allen, Head of Sales, controls a same-decision conflict over Madeline or Raul; the normal main ISTV reapplication minimum is three months.
- Relationship matching requires the exact decision, product, actor, action, polarity, and material conditions instead of broad topic overlap.
- A model cannot reopen a conflict already resolved by a claim-scoped authority record.
- Incomplete model paraphrases are replaced by the complete governed decision when the source is completeness-locked.
- Current-status and live-action requests route to their operational owner; stable reusable procedures remain answerable.
- Finance, Greenlight, Fulfillment, and Sales Tech routes are separated by the action requested.
- Internal evaluation labels such as `Unresolved` are not exposed as the rep-facing answer.
- Artifact permission, artifact identity, and artifact discovery are treated as different decisions.
- Existing generated operational Q&A remains byte-for-byte unchanged from V4.2; V4.3 adds a governed authority layer instead of regenerating the historical corpus.

## Development evidence, not promotion evidence

The user's reviewed 50 questions were used only to identify failure families and confirm the systemic fixes. They cannot prove promotion readiness.

- Last full development replay: 28 direct answers, 3 partial answers, 19 safe routes, and 0 generic fallbacks.
- Focused final check: the wire sequence, phone/Zoom workaround, upgrade-form discovery, and Sales Tech leaderboard route all behaved as intended.
- Reviewed-50 V20 artifact hash: `56b3e4b2ad849318c3d1283d5a52f1d2a672b514f297f16d62b8c5a7ac96feba`
- Focused final artifact hash: `4b2673fa04b9d72141b50e04f9a1f098efdc14a0cc5d28da965ee6aa83f756e3`

## Verification completed before freeze

- `npm run test:ask-sales-faq`: 37 files and 748 tests passed.
- `npm run validate:ask-sales-faq:v4:isolation`: 15 of 15 checks passed.
- `npm run validate:ask-sales-faq:v4:fresh-evaluation`: passed traceability, privacy, and prior-question separation checks.
- Targeted ESLint over every changed implementation and test file: passed.
- `npx next build --webpack`: passed, including TypeScript, page generation, and route compilation.
- `npm run build` with Turbopack could not follow the intentionally shared `node_modules` symlink across Git worktrees; the webpack production build is the valid build proof for this isolated checkout.

The legacy model verifier for the unchanged generated operational Q&A requires the 1.4 MB raw Slack corpus artifact, which is not stored in this clean worktree. The source and generated-Q&A hashes match the prior V4.2 copy. V4.3's new authority evidence is covered by direct source review plus retrieval, authority, relation, runtime, and source-compiler tests.

## Unseen evaluation rule

Only after this freeze may the evaluator select the source-backed unseen set from the pre-freeze candidate pool. The selected set must exclude prior replay questions and any source record already inspected during implementation. V3, frozen V4.1, and this frozen V4.3 must receive the same prompts and provider conditions. Model judging is advisory; final conclusions require a blind answer review and a manual check against each authoritative source.
