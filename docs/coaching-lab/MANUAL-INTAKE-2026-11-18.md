# Manual coaching intake

The dashboard resolves current Zoom recording shares through the player metadata endpoint and keeps compatibility with legacy player captions. It preserves caption timestamps and speaker labels. If Zoom does not expose captions, an exact recording owner, title and start-time match can reuse a complete, hash-verified transcript already stored by Script Adherence. Archive access requires the authenticated rep’s existing email mapping. Ambiguous matches, recordings outside that mapping and unavailable transcripts still accept pasted text. The archive is read-only. The manual worker uses the accepted transcript and no longer tries a second Zoom resolver.

The manual coaching writer and independent reviewer now apply the Call 2+ scope to the whole conversation. An initial casting call that ends at discovery or booking a later offer review is excluded. A casting title, an unresolved objection or a call without a payment can still contain substantive selling. A reviewer reversal of a completed draft uses the existing independent adjudication path before publication can be refused. The manual rule is scoped to its own parent workflow.

`scripts/coaching-foundations/manual-intake.cjs` applies the scoped changes to the verified manual workflow. The Zoom resolver is deployed through the normal dashboard release. Publish the workflow change after the dashboard resolver is available. For rollback, restore the prior active manual workflow revision and deploy the prior dashboard release if needed. Do not resubmit earlier manual rows.

## Production verification

The dashboard release is merged in [#457](https://github.com/Inside-Success/sales-performance-dashboard/pull/457) and [#458](https://github.com/Inside-Success/sales-performance-dashboard/pull/458). The latter converts archive segment markers into addressable cues while preserving timestamp, speaker and wording. Vercel reported the production alias on the expected release. The published manual workflow revision is `7a6354d3-8a10-4ca8-8f01-a1f1b5c50da2`. The official and core workflows passed live connection validation alongside the manual workflow. The published official and manual policy templates both matched the verified Documentary rollout revision `2026-11-18-documentary-views-v1`.

All three affected Zoom shares resolved under the matching rep identities, corresponding to the two exact archived meetings. The same archive lookup returned no transcript for an unrelated identity. The normalized Connor replay excluded the discovery-only call after independent review. The manual refusal carries source evidence and does not enter report creation. The local coaching suite passed 403 tests across 60 files. The signed-in production intake page continued to expose both recording link and pasted transcript options.

## Historical report corrections

[Report 10018](https://sales-performance-dashboard-rose.vercel.app/call/10018) now treats the revised Standard presentation's one million combined promotional views as approved and keeps the exact content count and Cristian's separate six-month Lite guarantee subject to the applicable agreement. All four objections survived.

[Report 10038](https://sales-performance-dashboard-rose.vercel.app/call/10038) now credits the revised Lite language Celia read and coaches answering the buyer's analytics question promptly with the applicable scope and dashboard. All 18 objections survived.

Each revision used the original exact source blocks. The original Google Docs received scoped, revision-guarded changes and matched full-text readback. The existing dashboard records and generated Airtable scorecards were verified in place. Airtable scoring and other unrelated fields were unchanged. The signed-in dashboard showed the revised passages. No replacement report or notification was generated.
