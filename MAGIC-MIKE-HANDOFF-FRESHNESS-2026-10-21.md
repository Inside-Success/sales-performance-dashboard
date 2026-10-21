# Coaching handoff and dashboard freshness — October 21, 2026

## Scope

Approved: recover source `recZns0vAeSnPpXsN`; safely catch future never-started eligible calls; prevent manager views remaining on old snapshots. Production report prompts, factual review, scoring, access policy, and source Sheets remain unchanged.

## Handoff contract

- Coverage discovers processed Call 2+ sources after the existing 20-minute grace period. Only sources with no recorded start and no outcome receipt can enter automatic catch-up (one per 15-minute sweep).
- Before reserving, read source readiness and existing Airtable scorecards by source/recording identity. Also check dashboard artifacts and source-attempt records. Source reads failing never authorize processing.
- Dashboard-owned `coaching_source_claims` has one unique recording identity. Normal trigger and recovery must acquire it before observation or AI. Reservation prevents normal-trigger/catch-up races; repeated requests by the same owner are idempotent.
- Persisted outcomes settle only the matching owner: delivered/excluded finish; retryable failures release to recovery; uncertain outcomes remain held. A running claim is never stolen merely because time passed. Recovery can transfer ownership only after n8n verifies the prior execution is error/crashed/canceled, with compare-and-set on its owner and existing artifact checks.
- Reuse the existing recovery worker, provider checkpoints and factual audit. No automatic replay of unknown deliveries. Native workflow versions plus the bounded before/patch files preserve rollback.

## Dashboard contract

- Postgres remains the single saved snapshot. Remove the redundant framework cache.
- Existing five-minute cron keeps compliance/scorecard/daily attendance warm; full attendance retains its fifteen-minute source cadence. Existing leases and sequential same-base reads remain.
- Authenticated metadata-only checks every 30 seconds while visible refresh an open page when a newer snapshot is available. No source polling from the browser, no yellow freshness banners, no change to URLs/filters. Miami day rollover is included.
- Failed source reads preserve successful payloads and timestamps. Views older than 24 hours become unavailable instead of indefinitely presenting old figures as current.

## Verification and release

Application released through PR #334, commit `a8f31f0fa3be75e2c62aaff4bb31a5d52993097b`; production deployment `dpl_DitqWABunRAW9aVmwLYoR9QjVmLs` is READY.

Published workflow versions:
- Official `L8Nn7xncA9ZPDdWA`: `d067800f-7c53-4c7d-bd78-684243747b3b`.
- Coverage `yL5XsZPtVP1rsW8X`: `ed62a120-6c06-4f9c-87b9-7b1d76ae9814`.

Verified:
- GitHub reliability gate: 178 tests passed; workflow policy checks, TypeScript and production build passed.
- Eight concurrent database claimants produced one owner. Wrong-owner release, duplicate recording identity, recovery and completed-claim guards passed; temporary verification rows were removed.
- Both workflow connection validations have zero errors. Existing detached legacy coaching-node warnings were not introduced by this patch.
- Live execution `1230467` acquired its source, saved a genuine Call 1 exclusion, and settled its claim. No AI/report was fabricated for verification.
- Authenticated metadata endpoint returns the source version; unauthenticated access returns 403.
- Today attendance: 16 no-shows / 165 tracked calls; Yesterday: 8 / 235 at verification. Rep drill-down opens with evidence.
- Scorecard automatically moved from the 10:35 AM source read to 3:10 PM EDT without reloading manually; the Bryce search stayed selected while his recorded call count updated from 109 to 110.
- Retired official/manual/weekly workflows remain inactive; current manual and weekly workflows remain active.

Preview deployments were blocked before build by the existing Neon database branch limit. No branches were deleted and no plan was upgraded. Production used its existing database integration and deployed successfully.

Danielle recovery completed automatically:
- Scheduled coverage execution `1230593` at 19:15 UTC verified/reserved the never-started source and persisted one queued receipt.
- Existing recovery worker invoked official execution `1230679`, 19:20:21–19:23:27 UTC. Classifier, coaching writer, factual audit, compliance and safety checks ran through the existing production path.
- Exactly one dashboard row for source `recZns0vAeSnPpXsN`: report [8338](https://sales-performance-dashboard-rose.vercel.app/call/8338), Airtable artifact `recicnbE6B916DaIA`. Report opened successfully with Danielle, the correct source meeting, two improvement cards and evidence controls.
- Google Doc `1jON9Y33m-bUciHn1KU1CRo5_TpwnUI8pLPsNQHx4xYk` created and linked. Normal Slack top-level/thread responses each returned `ok:true`. Receipt 2719 is `delivered`, attempts 1; source claim is `done`.
- No manual report-content corrections or independent Slack messages were made.
- Compliance and scorecard cron snapshots advanced to 19:15 UTC without new page requests; failed_at remained null. Seven-day attendance loaded 71 no-shows / 1,381 tracked calls at verification.
- Coaching home, admin directory, rep usage and FAQ usage loaded under the existing authenticated account. No new manual feedback submission was created; that workflow was checked for active state, with regression coverage rather than a fabricated production call.
- Latest error-list reads for intake, official, provider, coverage and recovery returned none. This is bounded release verification, not a guarantee against future external outages.

Removed 468 MB of disposable local build output after verification. Kept source, tests and the 84 KB rollback snapshot.

Regression coverage includes source/report conflicts, owner-specific settlement, failed source reads, latest snapshot visibility, failed refresh preservation, refresh leases, date boundaries, existing coaching/manual flow tests and access controls. A pre-existing directory test assumed nine links despite ten existing pages; its uniqueness check now compares against the actual link count.

## Rollback

Disable coverage catch-up first (restore the coverage graph from `scripts/n8n/handoff-before-2026-10-21.json`). Restore official changed nodes/connections using the same bounded snapshot/native pre-release version. Then revert the application commit. Keep owned claim records for audit; do not drop source data or replay deliveries. Existing older report artifacts remain authoritative.
