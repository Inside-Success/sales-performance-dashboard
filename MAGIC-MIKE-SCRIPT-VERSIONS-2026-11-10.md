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
- 12 distinct real calls, 20 two-pass evaluations / 40 regular-API requests, zero HTTP/parse/validation failures. Usage-priced test cost $2.224248. Full private receipts retained; no accepted dashboard writes. Both previously oversized sources completed both passes without source truncation.
- Review found and corrected two general issues: production-onboarding conditions were too broad, and shared condition keys could be incorrectly considered unused. Five Reality Call 2 reruns included two fresh calls; the last two retests confirmed the explicit key mapping. No source-specific expected answers were supplied.
- This is a targeted regression sample, not a measured company-wide accuracy guarantee. Missing speech remains unknown. Existing historical holds were used only as private test sources, not replayed or published; no historical backfill is part of this release.
- Source-watch candidate validates: zero errors; one pre-existing loop-done warning is intentional (initialize processing only after coverage completes).
- Additive schema installed before code rollout, initially inactive. Activation verified below.

## Release and rollback
Keep batching enabled. Verify CI and current main before merge, deploy from GitHub, then compare-and-set activation fields from NULL to v2 and the activation timestamp. Install only the three source-monitor nodes and their connections onto the verified coordinator; preserve all original nodes, settings, schedule and active state. Never overwrite another chat's graph.
Rollback new draft selection by clearing only activation fields. Keep the deployed reader/parser version support while any v2 request is in flight or any v2 result exists. Do not roll code back to a reader that cannot interpret accepted v2 records. Source monitoring can be removed independently by its three named nodes without touching intake or paid batches.

## Verified release
- PR #409 merged as `34b9342a919f58185d93834c167c11fa79c40f5f`; adherence and reliability CI plus Vercel preview passed. Production deployment `dpl_B1DiLbjk3X8EThGZsGeqXDky2V6U` is READY and serves the production alias.
- Activated v2 with compare-and-set at `2026-11-10T14:07:38.959196Z` (19:07 Pakistan / 09:07 Miami). `enabled=true`, `transport=batch`, no canary keys. Calls starting before that instant remain legacy; no backfill or scored-call updates.
- Final post-activation audit: 2,768 baseline calls still present, zero changed call/metric hashes, zero rederived metric mismatches. All 200 durable requests associated with 100 in-flight jobs retain legacy version identifiers.
- Authenticated production UI verified: overall 18,073 / 23,129 actions, 1,297 / 2,768 assessed calls; Angel rep view 379 / 440 and saved call details match prior scores. Existing Reality Call 2 history intentionally remains unscored.
- Source-watch isolated execution `1667738` returned four successful unchanged-source receipts. The exact three tested nodes were installed on coordinator `hb3M0O7fYx04oVEs`; all original nodes, settings and connections were preserved, with only the new branch added. Published active version `9f1d32cd-44a4-4004-8e06-c0e99dbcf153` matches the verified candidate.
- Source check table: four checked, four matching. Owner status visibly shows zero changed/unavailable/overdue sources. Test workflow `uQj6woRairFzQk9J` is inactive, with its single completed execution preserved privately. No extra scheduled workflow was added.
- Retesting the long source exposed a real video false omission: a complete show pitch followed by a new CEO greeting and substantive orientation had been treated as an embedded tail solely because playback was consecutive. The prospective prompt now explicitly permits independently evidenced consecutive presentations; a brief generic footer still does not establish a second video. Independent retest correctly identified both. Three Call 1 cases were retested; no source-specific answer hints were used.
- All 40 provider requests completed with valid responses; total usage-priced test cost **$2.224248**, including **305,776 cached input tokens**. These isolated test costs are retained in private receipts, separate from the production budget ledger. No duplicate/replayed test intents.

## Honest limits and retained work
The targeted evaluations support prospective use, not a claim of perfect accuracy on every future call. Source-grounded uncertainty is preserved. The first genuinely post-activation daily cohort has not yet completed; production batch scheduling remains unchanged. Two prior large-source holds were successfully tested privately but intentionally not requeued or published, honoring no backfill. Truly excessive inputs still remain explicit holds rather than truncated scoring.

Source monitoring watches the four known reviewed script tabs and links; it does not discover entirely new Google Docs automatically. A detected change requires a human/source review and a newly versioned prospective release. The existing owner indicator may still say Needs attention because of the two retained historical holds; this is not a new source-monitor failure.

Private evidence: `.private-adherence/script-update-2026-11-10/` (source snapshots, baseline, model intents/receipts, historical comparisons, source-monitor execution, deployment and activation receipts). No transcripts or credentials are committed.
