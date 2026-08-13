# Magic Mike Rep Scoring V7.1 — Atomic 250 and Manager Release

Date: 2026-08-13
Status: one-time checkpoint in progress; remaining historical backfill not authorized

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

Pending completion and combined read-only audit.

## Remaining authorization boundary

The remaining historical backfill is not approved. It must not start until the user reviews the combined checkpoint analysis and explicitly authorizes it.
