# Script Adherence submission recovery — November 12, 2026

## Scope and incident

Only Script Adherence batch submission/reconciliation changes. No coaching, FAQ, n8n schedule, prompt/rubric, historical score, metric, transcript or source changes. Work is isolated from the concurrent dislike/voice-feedback chat in a dedicated worktree and branch.

One 100-request draft manifest remained `submitting` after its input upload on November 11 at 12:30 UTC. No provider ID was retained. Full provider inventories on November 11 and November 12 found no batch matching its metadata or exact input file. The original HTTP outcome was overwritten by later reconciliation; Vercel's retained logs no longer cover it. A specific original rejection/timeout cause is therefore unproven. November 12's separate 348-call cohort completed normally (696 requests, eight successful batches).

## Behavior

- Preserve a durable, metadata-only submission event trail: intent, accepted provider ID, HTTP status, provider request ID/error code, uncertain outcomes and reconciliation. Never store credentials or transcript bodies in events.
- Only confirmed HTTP 429 rate-limit rejection gets an automatic retry (same manifest/file/reservation, 30-minute delay, three rejections maximum). Insufficient quota and permanent rejection require review.
- Network timeouts, HTTP 408/409/5xx, malformed success bodies and DB failures after acceptance never authorize another paid POST. The original intent is reconciled by metadata **or exact input file**.
- Check all pages within the bounded scan before attaching; multiple matches and incomplete inventory cannot authorize a replay.
- After an hour, an unconfirmed submission and its still-owned pending calls become held. The batch stops consuming one of four active slots. Read-only reconciliation continues hourly and can restore the exact matching held calls if the original provider receipt appears. Existing UI shows these calls as needing review.
- Completed rows, metrics and settled costs remain untouched. Lost-response/DB-failure retries reuse provider receipts instead of submitting again.

## Deployment and rollback

Apply `scripts/script-adherence/submission-recovery-schema.sql` before deploying; it creates only the additive event table/index. Production uses the existing scheduled checker and existing two-pass Terra batch processing. Rollback code may leave the additive table in place; never reset paid intents or release reservations to roll back. Held unknown submissions must remain held unless reconciled.

## Verification and recovery status

- 148 Script Adherence tests pass; one opt-in live-database test is skipped by default. Includes 13 additional regression cases for rejected/uncertain requests, bounded retries, cross-page duplicate matches, exact-file reconciliation, held-call recovery and receipt settlement.
- Production migration applied and historical baseline captured privately before recovery. Release/deployment and exact-manifest recovery results will be appended after verification.
- Private evidence: `.private-adherence/submission-recovery/` (ignored by Git).

## Operational limitation

No implementation can guarantee provider availability or turn a genuinely unknown paid outcome into a safe automatic retry. This change makes that condition explicit and isolates it from normal throughput. Absence from a bounded list is never automatic retry permission. Any exceptional operator recovery needs a complete current provider inventory, exact immutable membership/input checks, no accepted results or settled requests, a serialized lease, and a durable authorization/intent receipt.

### Exact-manifest queue recovery

At 16:11 UTC (21:11 Pakistan), a fresh complete provider inventory contained 100 batches and zero matches for the original manifest/input file. All 100 uploaded JSONL requests matched the saved request bodies, remained reserved/unsettled, and had no accepted result. The earlier independent full inventories also had no match. Under the user's explicit recovery authorization, one serialized compare-and-set returned that exact original manifest to `prepared`; the same input file, request IDs, membership and existing $50 reservation were retained. No model POST, new reservation or scored-row update was made by this operator action. A durable single-use `operator_requeue` event records authorization and original submission time. The scheduled checker is responsible for the normal draft/review/publish path. Provider acceptance is checked separately; queued does not mean completed.

### Release acceptance

- PR #433 merged as `28f241b8542fc5e669e89a3fb08fff712f4b4025`. GitHub adherence CI passed (169 tests plus TypeScript); preview and production builds passed. Local lint/TypeScript passed. The existing long-source test timed out once while the production build was running concurrently, then passed unchanged on a focused rerun; no test threshold or implementation was relaxed.
- Production deployment `dpl_4hKTxLUhFBRSAExJgn3Cd8jXm8JX` is READY and assigned to `sales-performance-dashboard-rose.vercel.app` (verified through Vercel).
- One additional opt-in **read-only live database integration test** passed: 3,517 total calls, 1,746 assessed, 24,237 complete actions, 6,556 incomplete actions; page, rep and team aggregates reconcile.
- Authenticated production UI verified through Chrome's company profile: summary/team overview and owner status load; 3,517 saved results, 100 calls in analysis, one active batch, two unchanged historical holds, all four script sources current. No new error/fatal runtime logs were returned for this deployment in the post-release scan.
- The existing scheduled checker submitted the exact original manifest at **16:15 UTC / 21:15 Pakistan**, without an extra workflow execution triggered by this task. Provider receipt: `batch_6af5e6058de48190974731abeb328def`, original input file retained. All 100 original request rows are `submitted`.
- At **16:17 UTC / 21:17 Pakistan**, a fresh full provider inventory contained 101 batches and **exactly one** metadata/input-file match. Direct provider retrieval confirmed `in_progress`, 100 total requests, 10 drafts completed, zero failed, no provider errors. This establishes acceptance and ongoing work, not completed two-pass results.
- Final baseline comparison: **all 3,517 pre-existing call rows and all 3,517 metric rows unchanged**, including their stored timestamps. The same original 100 draft reservations total $50; this is a maximum reservation, not an actual charge. No extra reservation or duplicate provider batch was created by recovery. Draft and subsequent review charges settle through the existing receipt path.
- Normal 15-minute checks will collect drafts, submit their independent reviews and publish validated results. No new cohort/backfill, prompt changes, coaching/FAQ changes, schedule changes or messages to the parallel chat were made.
- Original submission failure cause remains unproven because its exact HTTP receipt was not retained and hosting logs expired. The new event trail prevents that loss of diagnostic evidence for future submissions. Provider faults can still happen; genuinely unknown paid outcomes stay visible and isolated rather than blindly retried.

Private retained evidence includes full historical row hashes, fresh inventory and exact-input preflight receipts, single-use requeue authorization/receipt, and final provider verification. Keep these until all 100 calls have completed the normal reviewed publication path. Do not run the requeue helper again: its guard rejects replay, and the provider has now accepted the batch.
