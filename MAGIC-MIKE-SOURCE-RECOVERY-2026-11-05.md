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

Verification and outcome are pending; local passing tests alone do not establish production success.

## Conservative negative-state handling

Source-backed review found residual output contradictions. The structured parser now changes an unsupported `not_done` on an incomplete/unobservable source, or an unconditional `not_applicable` without a supported exemption, to `unknown`. For a downgraded video it clears the claimed fraction. It never changes either state to `done`, never removes the uncertain component from the denominator and records the affected components in internal normalization metadata. Direct raw-contract validation remains strict. Settled receipts can be revalidated by exact job/request identity without another provider call; the prior validation error and parser version are preserved in the request result. No accepted historical record is rewritten.

The published daily intake trigger was found disabled despite its workflow being active. Its intended `0 6 * * *` America/New_York schedule was restored and the published nodes/connections re-read. The worker archive branch was validated with zero errors; its first live pass successfully read and verified Google Docs, retaining unmatched records. Final counts are recorded after completion below.
