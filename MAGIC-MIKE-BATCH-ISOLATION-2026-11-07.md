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

Deployment and recovery results will be appended after live verification. No changes to coaching, FAQ, archive documents, missing-transcript policy or daily schedules are included. Rollback is the scoped GitHub revert; retain all paid requests, receipts and manifests, and never reset submitted requests as a rollback mechanism.
