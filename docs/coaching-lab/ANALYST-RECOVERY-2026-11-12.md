# Analyst evidence recovery — November 12, 2026

## Failure and scoped change
Derek Stern / Tessa Tierney, source `recakenVZBhR0hBnl`, was held after source analysis quoted two separated fragments as one excerpt. The exact-quotation validator correctly rejected it. The missing recovery transition stopped the call before the writer.

The shared state machine now aggregates invalid offer-identity evidence paths and permits one separately checkpointed `analyst-evidence-repair` request after a confirmed complete analyst receipt. The same analyst model receives the full source and original analysis. Only the identity evidence may change; show, family, reasoning and observations are immutable. The complete existing validator runs again before writing, independent review and safety review. Repeated invalid evidence, unknown receipts, truncation and refusals stay held. Successful analyst requests incur no additional request.

No fuzzy quote matching, deletion of negations, altered numbers, guessed identity or bypass of review is allowed. Original paid receipts remain immutable and reusable; correction identity is deterministic and distinct. No added workflow nodes, parent/provider changes or Script Adherence changes.

## Verification before release
- All 361 coaching tests passed across 52 files, including 13 new bounded-recovery tests.
- Replayed the retained actual failed response through both the shared transition and compiled native Advance node; both produced the same correction request identity.
- New correction stage is supported by the existing durable provider's generic structured-result path.
- Production release and actual Derek delivery verification are pending; tests alone are not delivery proof.

## Deployment and rollback
Only Start and Advance bundles in core `8hyzTVNfQyneU5wL` are changed. Private pre-change snapshot and guarded install/publish/rollback control are in `.private-coaching-lab/analyst-recovery-2026-11-12/`. Installation rejects concurrent shape/version drift. Parents and durable provider are snapshotted and must remain unchanged. Reverting this core does not remove previously delivered artifacts.

Derek recovery must release only the exact held claim owner `1706370` and queue row `7491`, after verifying no existing artifact and no running checkpoint. Resume through the existing worker; do not reset or rerun the original paid analyst request. Older holds remain outside scope.
