# Magic Mike Rep Scoring V7.1 — Atomic 250 and Manager Release

Date: 2026-08-13
Status: one-time checkpoint complete; remaining historical backfill not authorized

## Scope

This release adds the database-backed atomic run lock required after the earlier launcher race, admits exactly 250 additional V7.1 calls from the approved August 3 boundary, and simplifies the hidden manager dashboard. It does not replace V6.3 production scoring, alter Magic Mike Coaching, or authorize the remaining historical backfill.

## One-time checkpoint architecture

- Coordinator: `aVvWQpt1vuN9ljf4`
- Worker: `QPUh149BvYlqhKOq`
- Run key: `v7.1-checkpoint-250-2026-08-13`
- Boundary: `2026-08-03T04:00:00.000Z`
- Exact selection: 250 unique, previously unfinalized calls
- Call-type balance: 125 Call 1 and 125 Call 2+
- Dispatch: 25 top-level workers of at most 10 calls, split into guarded waves of 20 and 5

The database lock is acquired before the source scan. A dispatched run key cannot reopen after a timeout, so simultaneous or repeated requests cannot admit another cohort. Per-call V7.1 idempotency and leases remain a second independent safeguard. Provider balance, active leases, selection cardinality, source uniqueness, idempotency uniqueness, and batch size all fail closed before dispatch.

The coordinator is webhook-only and has no schedule. After the checkpoint is finalized, both this coordinator and the isolated V7.1 worker are deactivated. The existing V6.3 production coordinator and Coaching workflow remain at their normal live pace.

## Manager dashboard changes

- Removed validation-version and backfill mechanics from the manager-facing page.
- Replaced technical counters with a manager priority queue and plain-language performance summary.
- Kept sufficiently evidenced reps available without mixing them into the immediate action list.
- Collapsed early-evidence reps and call history so the first screen stays focused.
- Added immediate navigation feedback and deterministic scroll-to-top behavior.
- Reworked rep detail into a concise manager summary, recommended next action, supporting patterns, and lowest-call-first evidence.
- Reworked call detail into a plain-language takeaway and a maximum of six priority checkpoints.
- Hidden transcript, behavior, critical-event, and raw-data sections when no useful evidence exists.

## Verification completed before final analysis

- V7-focused deterministic tests: 24 passed.
- ESLint: passed with zero warnings.
- Production Next.js build: passed without running a local development server.
- Production Vercel deployment: `dpl_32D17Hv6X6z65hXRZgR2iByzWcDv`.
- Production alias: `https://sales-performance-dashboard-rose.vercel.app`.

## Final checkpoint result

- Exactly 250 newly admitted calls reached a final state: 228 scored and 22 fair exclusions.
- New scored mix: 108 Call 1 and 120 Call 2+.
- New fair exclusions: 17 Call 1 and 5 Call 2+.
- Exclusion reasons: 13 unresolved speaker mappings, 7 multiple-rep speaker ambiguities, and 2 insufficient-dimension results.
- New selective reviews: 51 of 228 scored calls, or 22.4%. Ordinary calls still used one assessment.
- All 25 top-level workers completed successfully; no worker failed or timed out.
- The database run record finished as `completed` with 250 selected, 25 workers, and 250 finalized.

Combined with the 161-call calibration baseline:

- Final evidence set: 383 scores and 28 fair exclusions, or 411 calls.
- Scored mix: 183 Call 1 and 200 Call 2+.
- Range: 17.0–85.4; median 81.5; mean 75.2.
- Score bands: 12 Unacceptable, 41 Needs Improvement, 62 Developing, and 268 Meets Expectations.
- Below 75: 115; below 60: 53; at least 90 or exactly 100: 0.
- Opportunity classifications: 248 viable, 105 limited, and 30 not currently closable.
- Manager aggregation with enough evidence: 13 Needs attention, 2 Coaching focus, and 11 No priority concern.
- Selective review: 90 of 383 scored calls, or 23.5%, and all 90 were applied.

The manager priorities are not a bottom-percentile rule. The read-only evidence audit tied them to repeated, controllable behaviors. The most common supported Call 1 pattern was accepting surface answers without clarifying commercial need, desired change, or consequence. A distinct Call 2+ priority involved best-reasonable-outcome execution and specific follow-through. Low-call evidence included exact quotes and timestamps; high results remained restrained below 90.

Honest assessment: the combined cohort now has meaningful separation, genuine low calls, a large competent middle, fair transcript exclusions, and both positive and negative manager outcomes. It is suitable for manager shadow review and is strong enough to request a separate decision on the remaining backfill. It is still a coaching and investigation signal, not an autonomous personnel verdict.

## Pace restoration and production checks

- The one-time coordinator, V7.1 worker, audit, and temporary finalizer are inactive.
- The existing V6.3 coordinator `EghbY2jr86yjJl4d`, V6.3 worker `w8JaLibcm8zqVGP1`, and Coaching workflow `L8Nn7xncA9ZPDdWA` remain active at their prior versions.
- Production deployment `dpl_32D17Hv6X6z65hXRZgR2iByzWcDv` is `READY` and owns the canonical alias.
- The hidden routes redirect signed-out requests to sign-in, and Vercel reported no runtime error clusters or error/fatal logs in the release observation window.

## Remaining authorization boundary

The remaining historical backfill is not approved. It must not start until the user reviews the combined checkpoint analysis and explicitly authorizes it.
