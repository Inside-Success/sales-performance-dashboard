# September backfill recovery — 2026-09-10

The original dispatcher execution 703917 was canceled by a timeout after exactly 40 minutes, despite a longer saved timeout setting. Replace the long Wait loop with a short dispatcher that launches available workers and ends. Each successfully persisted worker calls the authenticated dispatcher webhook. Atomic database claims continue to enforce five paid workers, unique claims and the $81 run budget. No scheduled poller or primary-generation retry is introduced.

The same bounded reviewer corrections are published to the live scorer and the backfill worker:
- Canonicalize numeric transcript IDs (`T17` → `T0017`), preserving exact transcript content and rejecting nonexistent IDs.
- Treat an omitted optional counterevidence list as empty; reject malformed lists.
- Resolve unambiguous speaker display aliases; never credit a named prospect's speech to the scored rep.
- Preserve original evidence when a proposed correction is rejected.
- Allow an accepted signal with an unchanged truth value to retain its original value when omitted from reassessment output. Changed signals still require explicit output.
- Route contradictory positive-ask/implicit-ask reasoning through affected-field reassessment under the existing rubric.
- Add one conditional checker-contract repair for a malformed checker response. It reuses the primary assessment and transcript; no blanket retry or extra review for valid responses.

No weights, bands, caps, model tier, compliance, coaching delivery or source Google Documents change. Model remains Claude Sonnet 4.6. Review revision remains `bounded-claims-2026-09-10` because this fixes the review contract rather than changing the rubric.

Evidence before release: all 93 completed cases replayed without an API call; all passed and their numeric scores and coaching stayed identical. Five cases retained different evidence when a proposed correction was rejected; no completed records were rewritten. All 11 genuine held calls passed recovery, including native n8n cached-response verification; one internal practice recording is excluded based on the transcript's explicit simulation instructions. Incremental recovery API usage: $0.510486, included in the existing run ledger.

Temporary verification/storage workflows must be deactivated after recovery. Production changes are captured in the private rollback snapshots, never credential exports. If rollback is needed, pause the database run first, allow active workers to finish, and restore the saved graphs without resubmitting paid jobs.

Database migration (run before deploying progress changes):
```sql
alter table mm_september_runs add column if not exists updated_at timestamptz not null default now();
```
Progress now reports an interrupted idle run and distinguishes completion with unresolved reviews. Saved results still precede Airtable upsert, and storage retries do not re-run AI.
