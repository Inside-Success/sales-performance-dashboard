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

Status: implementation prepared; release/live verification pending.

Regression coverage includes source/report conflicts, owner-specific settlement, failed source reads, latest snapshot visibility, failed refresh preservation, refresh leases, date boundaries, existing coaching/manual flow tests and access controls. A pre-existing directory test assumed nine links despite ten existing pages; its uniqueness check now compares against the actual link count.

## Rollback

Disable coverage catch-up first (restore the coverage graph from `scripts/n8n/handoff-before-2026-10-21.json`). Restore official changed nodes/connections using the same bounded snapshot/native pre-release version. Then revert the application commit. Keep owned claim records for audit; do not drop source data or replay deliveries. Existing older report artifacts remain authoritative.
