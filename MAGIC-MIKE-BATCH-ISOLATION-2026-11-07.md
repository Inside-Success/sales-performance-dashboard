# Script Adherence batch preparation isolation — November 7

A call fit the full-source draft bound but its draft answer made the review exceed the 220 KB message bound. `claimModel` threw without holding that job. `runProviderBatch` had already reserved 70 reviews, but lost the in-memory batch manifest on the throw. Subsequent checks rediscovered the same reservations and hit the same call. There was no provider wait: all previous provider batches were complete.

## Scoped repair

- Review preparation omits only the optional prior answer when needed, keeping the complete source and independent review instructions. It never truncates the transcript or raises the bound.
- Typed, deterministic preparation failures hold only the matching unaccepted job. Up to 20 consecutive exceptions can be isolated per claim invocation; later ticks can continue. Infrastructure failures are not swallowed.
- Already reserved valid work is durably attached to a batch even if a later claim fails unexpectedly. That manifest is collected/submitted by the existing idempotent runner. No uncertain paid requests are reset or replayed.
- Oversized Zoom source text and its hash are persisted before the source is held. Source references alone were previously retained.
- Scheduler notifications preserve the specific processor error rather than replacing it with a generic message.
- v12 reiterates that a known family requires decisive live evidence; familiar generic playback is not sufficient. The evidence validator remains strict.

## Verification and recovery

Regression coverage includes oversized first calls, preservation of complete source text, independent review without oversized prior output, partial manifest persistence after an infrastructure fault, reservation reuse, and preservation of specific error details. Existing identity, uncertain-submission reconciliation and receipt deduplication tests remain required. Production acceptance requires the existing 70 reservations to progress without replacement, original accepted results to stay unchanged, and live dashboard/runner checks.

PR #393 is merged and deployed; verified results follow below. No changes to coaching, FAQ, archive documents, missing-transcript policy or daily schedules are included. Rollback is the scoped GitHub revert; retain all paid requests, receipts and manifests, and never reset submitted requests as a rollback mechanism.


## Verified release and initial recovery

- PR #393 merged as `b1eb061f75c406934526be128d3328a868a90eae`. Its exact-commit Vercel status passed; production deployment `dpl_CSnfQYJLHynqY99W2BpBAT3mnhdf` is Ready with the canonical production aliases.
- 126 adherence tests pass, one live database test is skipped. TypeScript and the production webpack build pass. GitHub adherence CI and Vercel checks pass.
- All 1,906 pre-release accepted results retain their original request identity and result digest. The 70 previously reserved reviews retain their exact request IDs/hashes and are now attached to one submitted 100-review batch, including the formerly blocking source. No reset or replacement was used.
- The separate classification hold was independently reviewed against its full source for $0.030351. It is now saved as an unscored Call 1 with unknown family: generic documentary playback does not supply the required live offer identification. The strict evidence validator was preserved.
- The other held recording's exact Zoom transcript was downloaded through an authenticated, temporary single-source workflow. All 221,790 normalized UTF-8 bytes and a hash are now preserved in its existing job. The complete request still exceeds the bound, so it remains individually held without truncation or a paid AI request. This is an explicit supported-size limitation, not a queue failure.
- Temporary source-download and verification workflows were deactivated and deleted after their single bounded uses. Existing production workflows and schedules were not edited.
- Authenticated production dashboard verified 1,907 saved results, 189 in analysis and one retained hold immediately after recovery submission. Owner status showed the new successful processor check and one active batch; it correctly retained attention for the oversized individual call.

The ongoing recovery uses the existing provider Batch transport and 15-minute checker. Submission alone is not completion: the audit currently confirms resumed processing, and final provider results remain pending. The saved private baseline and audit helper can verify subsequent scheduled progress without altering requests. No claim of universal AI accuracy or unlimited source-size support is made.


## Completed first recovery batch — 00:26 PKT, November 7

All 100 resumed reviews completed at the provider with zero failed requests, were collected through the same durable runner and published successfully. This includes the formerly blocking full-source call. All original 70 reservation IDs/hashes were reused and settled; no duplicate call rows or missing metrics were found. Calls and metrics both total 2,007, with every original 1,906 result unchanged. The ledger reconciles exactly at $55.154011 actual spend with zero outstanding reservation at this checkpoint. The 100 recovered batch reviews cost $1.194092, plus the separate classification review's $0.030351. Eighty-nine initial analyses remain queued for the normal 15-minute checker. One individually oversized call remains held with its full source preserved; missing-transcript records are unchanged and separate.

The authenticated dashboard and owner status were checked after deployment. The runtime fix is live, and completed provider receipts plus saved results establish recovery beyond submission alone. Remaining ordinary catch-up results depend on the existing batch schedule and provider completion; they are not represented as already finished.
