# Script adherence source and validation recovery — November 5

Scope: the 78 settled validation holds and a recording-specific Airtable/Google Docs fallback. Existing accepted results, coaching, FAQ, Zoom recordings and archive documents remain unchanged.

## Findings

The original held cohort contains 51 conditional-component contract conflicts, 23 missing classification-evidence holds and four incomplete-source omission conflicts. A local parser recheck passes 58 after correcting the conditional exception and evidence requirements for evidenced, ineligible non-sales calls. This is not an accuracy finding: source inspection also found contradictory conditional explanations. Consequently the entire bounded cohort gets a new independent full-source review rather than automatic release based on parser success.

The v10 review prompt reinforces trigger-versus-completion, actual verbs versus promises, incomplete-source absence and unknown offer classification. It contains no call-specific expected answers. The validator still rejects unsupported quotes, invented references, incomplete-source omissions and unsupported required-component exemptions. Original paid requests and receipts remain immutable. Recovery requires an exact settled held request and no accepted result, reserves a distinct request atomically, and never replays uncertain submissions. New review costs use the same project ledger.

## Archive fallback

An additive, initially disabled `archive_enabled` flag controls the new branch in the existing bounded worker. After available Zoom sources, it checks up to 30 due pending records per iteration with a single exact-UUID Airtable query. It uses existing account credentials, not new secrets or AI nodes. Google Docs reads use the existing authorized credential.

Acceptance requires a unique Airtable record, exact meeting UUID, host membership in the same Zoom workspace, start time, automation key and recording file identity. Multiple archive records, conflicting document IDs, pagination, unavailable access and incomplete known segment coverage remain pending. The Doc must independently match the record metadata and contain its full timestamped speaker transcript. Only transcript content is analyzed; archive classification/AI metadata is excluded. Full text and source provenance/hash are retained. No audio transcription or title matching is used.

Archive lookup has its own 24-hour cooldown and shared five-minute source lease; it does not suppress Zoom retries or alter accepted calls. Failure remains visible and retained. Source-only recovery does not dispatch AI directly; recovered transcripts enter the normal two-pass batch queue.

## Release sequence and rollback

1. Add nullable archive columns and disabled control flag.
2. Deploy backend and validation changes after tests/CI.
3. Update the existing worker from a fresh exported definition; preserve its other nodes, credentials, settings and schedule topology. Validate and re-read connections.
4. Test authenticated archive reads and exact source receipts before enabling the branch.
5. Recover only the explicit 78-call manifest; save receipts before settlement and compare the accepted-result baseline afterwards.

Rollback: set only `archive_enabled=false` to stop new archive claims; retain recovered transcripts and paid requests. Restore the saved worker definition if necessary. Do not reset request states or replay provider calls. A request without a confirmed receipt remains held for reconciliation.

Production verification is complete for this bounded recovery; the additional recovered sources continue through normal background batch analysis. See the final results below.

## Conservative negative-state handling

Source-backed review found residual output contradictions. The structured parser now changes an unsupported `not_done` on an incomplete/unobservable source, or an unconditional `not_applicable` without a supported exemption, to `unknown`. For a downgraded video it clears the claimed fraction. It never changes either state to `done`, never removes the uncertain component from the denominator and records the affected components in internal normalization metadata. Direct raw-contract validation remains strict. Settled receipts can be revalidated by exact job/request identity without another provider call; the prior validation error and parser version are preserved in the request result. No accepted historical record is rewritten.

The published daily intake trigger was found disabled despite its workflow being active. Its intended `0 6 * * *` America/New_York schedule was restored and the published nodes/connections re-read. The worker archive branch was validated with zero errors; its first live pass successfully read and verified Google Docs, retaining unmatched records. Final counts are recorded after completion below.

## Video quality follow-up

Reviewing changed video judgements found a new recovery result that credited >=50% of a long reality orientation after playback stopped following the network/press/founder opening. The distinct playback is real; its >=50% extent is not established. The v11 review instruction separates video identity from playback extent and explicitly prevents applying the show-pitch lower-bound shortcut to the longer orientation. The affected newly recovered row is corrected with a preserved before/after audit; the original 1,549-result baseline remains unchanged. This finding is why parser acceptance and model agreement are not reported as perfect accuracy.

## Final verified outcome — 10:43 UTC, November 5

- PRs #381 and #382 are merged and deployed. Final production commit: `427f53c4cc6660cbbff15b5731e070a77b7042c3`; Vercel deployment `dpl_GM9Mb81qTCcpvyLGargFHqDZHADX` is Ready on the canonical alias.
- All 78 original holds are complete and accepted: 55 supported/scored calls and 23 appropriately unscored calls. All 78 independent review requests settled. Their actual incremental cost was $2.603163: 1,851,867 input tokens, 199,044 output tokens, including 589,050 cached input tokens. Review reservations began at 10:17:31 UTC and final settlement finished at 10:35:31 UTC.
- Accepted calls and metrics both total 1,627. All original 1,549 accepted results retain their original request/result digest. There are zero duplicate account/meeting pairs and zero complete jobs missing results. Recollecting an exact receipt returned duplicate=true without a second charge; revalidation likewise did not publish twice.
- Archive fallback is enabled and its published worker verified. Across 1,283 archive checks, 41 Google Docs transcripts were recovered. A separate 24 transcripts became available from Zoom, giving 65 additional sources now in draft_pending. These are pending analysis, not completed reports. Both legacy and account-scoped automation keys are accepted only with matching account/UUID/file identity.
- Another 1,242 jobs remain awaiting a usable, safely matched transcript. Missing sources and ambiguous archive records are retained; they are not silently scored or deleted. Some recovered source text is short and may correctly produce an unscored result.
- Actual project spending is $46.282979. The additional 65 draft requests reserve $32.50; that is a conservative reservation, not an incurred charge. The committed ledger reconciles exactly. The user removed the old spending ceiling; tracking remains active.
- 120 adherence tests passed (one database integration test skipped), TypeScript checking passed, and the production webpack build passed. Default local Turbopack cannot traverse this checkout's external node_modules symlink; the alternate production build and Vercel build passed. Live published n8n worker/coordinator validation passed with zero errors.
- Authenticated production UI verified summary counts, zero validation holds, clickable rep details, individual call/action information and owner status. The owner indicator still reports pending-source attention rather than falsely reporting everything resolved. Daily intake is published and enabled at 06:00 America/New_York; the existing checker continues background batches.
- Full-source quality checks found one unsupported video-extent upgrade in a newly recovered result. It was corrected to unknown with a durable before/after audit and a general v11 instruction. Original provider receipts remain preserved. This is evidence of improved safeguards, not a claim of perfect model accuracy or an independent accuracy certification of v11.

No coaching/FAQ changes, Slack messages, audio transcription, archive-document edits or historical accepted-result rewrites were performed. Remaining work is ordinary background processing of the 65 recovered transcripts and retention/retry of genuinely unavailable or ambiguous sources; no further manual replay is required.
