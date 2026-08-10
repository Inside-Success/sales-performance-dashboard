# Rep Scoring V6.3 Balanced Calibration Release — 2026-08-11

## Scope

V6.3 is an isolated calibration candidate. It does not replace the current manager page, alter V6.2, modify Magic Mike Coaching, publish scores to reps, start an hourly schedule, start a wider backfill, or write to source calls, Slack, or Google. Google transcripts remain read-only and all V6.3 outcomes are new immutable rows in the separate rep-scoring Airtable base.

## Changes from V6.2

- Deterministic criterion anchors are now `exceptional=100`, `met=85`, `partial=55`, `missed=15`, and `harmful=0`.
- A score of 100 requires rare, complete, context-specific execution beyond ordinary competent script compliance. A normal good execution is `met`, not automatically 100.
- Opportunity classification is context only. Limited or currently unclosable prospects do not directly add or remove points.
- Correct Call 1 progression remains the goal: a supported advance, follow-up, or intentional decline can all score strongly.
- Call 2 outcome remains factual and separate from execution quality. A sale does not guarantee a high score, and a non-sale does not guarantee a low score.
- Not-applicable and not-observable criteria remain excluded rather than converted into rep failures.
- Speaker resolution now normalizes full names, email local-parts, unique first/last-name aliases, role suffixes, and unambiguous prefixes. The assigned rep is preferred when the transcript supports that identity; multi-rep ambiguity still fails closed.
- The cost model remains one primary DeepSeek request per call, with a short verifier only for a material risk, contradiction, partial transcript, or uncertain progression. JSON repair runs only on malformed output.

## n8n

### Isolated worker

- ID: `w8JaLibcm8zqVGP1`
- Name: `MM Rep Scoring V6.3 - Realistic Anchors + Fair Attribution Worker (NO BACKFILL)`
- Trigger: Execute Workflow Trigger only
- Schedule/webhook: none
- Scorer: `rep-reviewer-v6.3-realistic-fair-1`
- Model: `deepseek-v4-pro`, temperature zero
- Runtime validation: 31 nodes, 38 valid connections, zero invalid connections, zero errors
- State: active only so the internal one-time launcher can call it; it cannot start by itself

### One-time balanced launcher

- ID: `gAyC0GAiGMdoV5Za`
- Name: `MM Rep Scoring V6.3 - One-Time Balanced 30-Call Multi-Day Calibration Launcher`
- Launcher execution: `470295`, successful
- Worker executions: `470296`, `470297`, `470298`
- Selected calls: exactly 30
- Call-type mix: exactly 15 Call 1 and 15 Call 2+
- Date coverage: Aug 3–10, 2026 for both call types
- Dispatch: three asynchronous workers of 10 calls each
- Safety gates: DeepSeek balance preflight, V6.3 active-lease rejection, completed-key exclusion, exact type-count invariant, at least three source dates per call type, duplicate rejection, and hard 30-call invariant
- State after dispatch: inactive; it cannot fire again without an explicit reactivation

## Dashboard

Hidden admin route: `/manager/rep-scoring/v6-3-calibration`

The page reports scored calls, Call 1/Call 2 mix, score median/range, exact-100 rate, selective-verifier rate, criterion-status distribution, and terminal quarantines. Each scored call links to a protected evidence page with the action/outcome, opportunity context, dimension scores, criterion statuses, reasons, exact quotes, timestamps, and source transcript link.

## Production release

- GitHub pull request: `#150`
- Merge commit: `3002fb761460f6a7a8082b3ce51eab74306b9d10`
- Production deployment: `dpl_6bKXKYz4FHyCDhnFVyitGRGWcQDm`
- Canonical URL: `https://sales-performance-dashboard-rose.vercel.app/manager/rep-scoring/v6-3-calibration`
- Deployment state: `READY`
- The unauthenticated route returned HTTP 200 and the protected Google sign-in page, confirming that the route exists and preserves the access boundary.
- Vercel reported no runtime errors for the route during the post-deployment verification window.
- The pull-request preview failed before the application build with `Resource provisioning failed`; its build log contained no application error. The same commit passed the local production build and the Git-triggered production deployment completed successfully.

## Verification

- The launcher returned `30 selected`, `15 Call 1`, `15 Call 2+`, `3 worker dispatches`, and eight distinct source dates for each type.
- The launcher was deactivated immediately after the single successful dispatch.
- All three worker executions reached the protected ledger, read-only Google transcript, speaker-resolution, and DeepSeek scoring path during the initial observation window.
- The worker and launcher both validate with zero errors and zero invalid connections. Advisory warnings are inherited Code-node and branch-shape heuristics; their live connection graphs were inspected.
- Thirty-eight rep-scoring tests passed.
- ESLint passed with zero warnings.
- The Next.js production build passed and included both V6.3 hidden routes. No local development server was started.
- The scoped build helper contains workflow construction rules but no credentials or secret values.
- GitHub PR `#150` was merged and its Git-triggered production deployment reached `READY` on the canonical domain.

## Decision boundary

The 30-call output is calibration evidence. It is not authorization for a complete backfill, promotion into the current manager view, or publication inside Magic Mike Coaching. Those actions require a separate review and explicit approval after the completed distribution and evidence quality are audited.

## Rollback

Deactivate worker `w8JaLibcm8zqVGP1` and revert the V6.3 dashboard commit. V6.2 workflow `SGxQ1oqXP4Lg1HbR`, its data, and its dashboard routes remain unchanged.
