# Prospective script versions and full-source capacity — November 10, 2026

## Scope and authority
Moonis approved prospective script updates and large-transcript handling. Already scored calls must remain unchanged; no backfill or rescoring. Other chats own coaching and FAQ. This release changes only Script Adherence.

## Behavior
- Immutable legacy rubric remains `script-adherence-2026-11-02-v1`.
- New `script-adherence-2026-11-10-v2` adds Reality Call 2 and removes the implied numeric investment requirement from Call 1 affordability. Reality Call 1 orientation is conditional on advancement; order is not scored.
- Reality Call 2 uses one motivation branch, License Video 1 and optional Contract Video 2. Welcome-video homework is not playback. Asking for the sale and responding to concerns are retained; staying until payment is not a scored requirement. Production onboarding follows confirmed payment or actual onboarding arrangements; a possible later sale is not that trigger.
- Activation timestamp is a separate control write AFTER production verification. Calls starting before it remain legacy. Review and publication derive the version from the durable paid request, never the current global configuration. Historical detail and aggregate action groups read the stored version; legacy labels and component definitions are preserved.
- No UPDATE to accepted calls or metrics. Queue publication retains `on conflict(source_key) do nothing`.
- Complete source retained up to 600KB; Terra request size is bounded by a conservative maximum of two common tokenizer estimates, 30% headroom and framing allowance (160k input estimate plus 16k output reservation). This is NOT an exact-model tokenizer claim. Oversized draft text can be omitted, never original source. Truly excessive sources remain explicit holds. Other models retain their existing byte budget.
- Source monitoring reads four reviewed native Google Doc tabs on the existing daily coordinator, with existing Google credentials. Text and link hashes ignore formatting; source failures and changes are owner-visible. No source Doc writes, extra scheduled execution or automatic rule promotion. Future source review produces a new version and prospective activation, not edited history.

## Sources
Reviewed script tab `t.0` from each source in `src/lib/script-adherence/source-manifest.json`. Secondary persuasion/commentary tabs are not checklist authority. Reality Call 2 was announced November 4, but this release deliberately uses a new prospective activation, not that historical date.

## Validation before rollout
- 131 tests passed; read-only live aggregation matched 2,768 saved calls at the checkpoint.
- Type check, scoped lint and production build passed. Final condition-key manifest change passed the full adherence suite and type/lint checks; hosted preview built successfully.
- 12 distinct real calls, 17 two-pass evaluations / 34 regular-API requests, zero HTTP/parse/validation failures. Usage-priced test cost $1.858391. Full private receipts retained; no accepted dashboard writes. Both previously oversized sources completed both passes without source truncation.
- Review found and corrected two general issues: production-onboarding conditions were too broad, and shared condition keys could be incorrectly considered unused. Five Reality Call 2 reruns included two fresh calls; the last two retests confirmed the explicit key mapping. No source-specific expected answers were supplied.
- This is a targeted regression sample, not a measured company-wide accuracy guarantee. Missing speech remains unknown. Existing historical holds were used only as private test sources, not replayed or published; no historical backfill is part of this release.
- Source-watch candidate validates: zero errors; one pre-existing loop-done warning is intentional (initialize processing only after coverage completes).
- Additive schema installed with both activation fields NULL. Production scoring rules are still unchanged.

## Release and rollback
Keep batching enabled. Verify CI and current main before merge, deploy from GitHub, then compare-and-set activation fields from NULL to v2 and the activation timestamp. Install only the three source-monitor nodes and their connections onto the verified coordinator; preserve all original nodes, settings, schedule and active state. Never overwrite another chat's graph.
Rollback new draft selection by clearing only activation fields. Keep the deployed reader/parser version support while any v2 request is in flight or any v2 result exists. Do not roll code back to a reader that cannot interpret accepted v2 records. Source monitoring can be removed independently by its three named nodes without touching intake or paid batches.

## Completion
Pending evaluation, hosted UI verification, rollout receipts and final historical digest comparison. Do not describe this checkpoint as deployed or error-free.
