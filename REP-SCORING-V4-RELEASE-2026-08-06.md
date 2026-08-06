# Rep Scoring V4.2 Release Record

Date: August 6, 2026

## Why V4.2 exists

V3 could score the Airtable-assigned rep even when the transcript showed that a different rep handled the call. That made the result unfair to an absent assigned rep and could give the substitute's work to the wrong person. The first V4 candidate fixed attribution but failed the predeclared stability gate while DeepSeek thinking mode was enabled. V4.1 moved to non-thinking temperature-zero requests, but a single model review still failed the band-stability and repeat-completeness gates. V4.2 preserves the attribution fix and forms one result from three independent evidence-valid reviews. None of these versions edits or deletes V3 history.

## V4.2 scoring contract

- Scorer: `rep-reviewer-v4.2`
- Prompt: `rep-prompt-v4-deterministic-speaker-safe`
- Rubric: `rep-rubric-v2-attribution`
- Config: `rep-scoring-config-v8-consensus3-speaker-safe`
- Model: `deepseek-v4-pro`
- Fixed analysis start: July 18, 2026 at midnight America/New_York
- Source remains read-only; scores, quarantines, ledgers, and calibration rows remain in the isolated rep-scoring Airtable base.
- DeepSeek runs in non-thinking mode at temperature zero. Three independent reviews are evidence-validated, then code calculates dimension-by-dimension median consensus. At least two reviews must be valid; critical events require support from at least two reviews. The V4 and V4.1 calibration rows remain isolated audit history and are not eligible for manager calculations.

Before DeepSeek receives a transcript, code resolves the rep who actually speaks:

1. Speaker labels are matched against the approved rep roster derived from the source calls.
2. Unique role suffixes and unique shortened first names are supported; ambiguous nicknames are not guessed.
3. If the assigned rep is the primary speaker, the assigned identity is retained.
4. If a known substitute clearly handles the call, the substitute receives the score and both assigned and resolved identities are stored.
5. Ambiguous multi-rep calls, generic identities, unmapped speakers, and low-confidence substitutions are quarantined.
6. Scoring evidence and critical events must use an exact resolved-rep speaker label, timestamp, and transcript quote.
7. Invalid auxiliary behavior evidence is downgraded and recorded as a validation correction. It cannot affect the score. Invalid dimension or critical-event evidence still quarantines the call.

## Manager calculation changes

- The manager view can select its scorer through the server-only `REP_SCORING_SCORER_VERSION` variable. This allows V4.2 to backfill without exposing partial results or replacing V3 prematurely.
- Call 1 and Call 2+ trends are calculated separately. They are never pooled into one recent-direction number.
- Decline labels remain disabled until stability calibration supplies a measured threshold through `REP_SCORING_DECLINE_THRESHOLD`.
- A low-score review signal requires at least three valid calls for the affected call type. A one-off result from another call type cannot create a supported concern.
- Each rep page shows excluded-call coverage and a verified-substitution notice when applicable.
- The page is explicitly labeled **Sales call execution review** and states that it does not measure lead quality, territory, revenue attribution, or every part of a rep's job.

## n8n workflows and rollback

- V4.2 worker: `MZv9GY5l5HDikIql`
- V4.2 coordinator: `53txJ8KuCRGim8LB`
- Stability calibration: `MUXLy0pQJKY7YjRh` (controlled webhook deactivated immediately after dispatch)
- V3 coordinator: `JQgSOlzomtjBotYJ`
- V3 worker: `lXXiUGvoWk18dNFk`

V3 remains the independent rollback path. V4.2 uses distinct idempotency keys and immutable scorer versions, so V4.2 can be stopped without altering V3 history.

## Verification record

- Local speaker-attribution tests cover assigned rep, known substitute, ambiguous multi-rep, generic identity, and unique shortened-name cases.
- Aggregation tests cover equal call-type weighting, lowest-score-first ranking, evidence-backed concerns/strengths, and separate Call 1/Call 2+ trends.
- Controlled coordinator canary `444451` dispatched worker `444457`.
- Worker `444457` completed successfully in 116.5 seconds and wrote V4 score record `rec0bZ21OWBSoi00w` for the resolved assigned speaker, with exact evidence and attribution diagnostics.
- The first canary exposed an unmapped nickname and safely quarantined it. The resolver was corrected and regression-tested.
- The next canary exposed unsupported auxiliary behavior evidence and safely quarantined it. V4 now downgrades non-scoring behavior claims while preserving strict dimension and critical-event validation.
- Fifteen rep-scoring tests, TypeScript, scoped ESLint, and the full Next.js production build pass without starting a local development server.
- The V4 thinking-mode calibration was rejected before release: at 12 complete triples, Call 1 had an 11.2-point median spread, a 27.5-point 90th-percentile spread, a 33.7-point maximum spread, and a 60% display-band flip rate. This failed the fixed release criteria and triggered the V4.1 deterministic contract.
- The completed V4.1 single-review calibration was also rejected: only 17 of 40 repeat groups completed, display-band flips were 50.0% for Call 1 and 27.3% for Call 2+, and pairwise rank correlation fell to 0.712. This triggered the V4.2 three-review consensus contract.
- V4.2 controlled canary coordinator `444714` dispatched worker `444721`. The worker completed in 50.0 seconds and wrote score record `recjtwO1AqpCpnGIi`: all three evidence-valid reviews agreed on 75.0, the assigned and resolved speaker were both Aidan Whytock, and the stored record was internally consistent.
- The final automated stability report contained 41 complete repeat pairs: 22 Call 1 and 19 Call 2+. Call 1 median/p90 spread was 0.0/4.4 points; Call 2+ was 1.9/7.5. Manager review-signal flips were 0.0% and 10.5%, and rank correlation was 0.93. The release gate passed. Raw adjacent display-band changes were also retained in the audit (4.5% and 21.1%) because a label boundary is less stable than the underlying manager action signal.
- The first volume probe exposed two coordinator defects before cutover: its score snapshot still filtered the short-lived `rep-reviewer-v4` version, and leased calls were accumulated in workflow-global static memory. The selector now uses `rep-reviewer-v4.2`; execution-local aggregation replaces shared mutable state so overlapping trigger contexts cannot overwrite a batch.
- A later 200-call/20-worker probe deliberately exceeded the safe concurrency envelope and produced worker crashes. The live design was therefore reduced to a hard maximum of eight workers, and the worker now treats an unexpired processing lease as already in progress instead of refreshing it from a competing execution.
- Post-fix canary coordinator `445245` dispatched four five-call workers (`445271`–`445274`); all four succeeded. It produced two valid scores and one safe quarantine while seventeen already-completed or actively leased calls were skipped.
- Eight-worker load-acceptance coordinator `445330` selected 80 calls and dispatched exactly eight ten-call workers (`445366`–`445373`). All eight succeeded with zero crashes. Twenty-five previously unprocessed calls reached final ledger state: fifteen valid scores and ten safe quarantines; fifty-five overlapping/completed calls were skipped without duplicate scoring.
- The live coordinator remains capped at 160 calls/run in at most eight 20-call workers. During temporary catch-up it runs every 30 minutes, providing up to 7,680 calls/day of dispatch headroom. The scheduled coordinator is enabled; the controlled webhook is disabled.
- The Samantha Forcash regression audit selected 45 assigned calls. Ten calls that were not already protected by a completed/active V4.2 ledger reached a final audit outcome: five valid scores where Samantha was the verified speaker and five safe quarantines. Two of those quarantines correctly resolved the actual speaker as Ezekiel Campbell and Alonso de Obaldia instead of assigning their speech to Samantha. No substitute call was scored as Samantha, and no score used an unverified speaker.
- Coverage telemetry now treats a quarantine as unresolved only when the same idempotency key has no valid score. It separately records shadowed quarantine attempts, completed-ledger keys without an outcome, and outcomes missing a completed ledger, preventing retries from inflating the manager-facing exclusion count.

## Production cutover status

- GitHub PR `#118` merged as `5edbfa2b105aa2e8f91c3cda479b7c72d5351802`; final manager-copy PR `#119` merged as `5a27eefb16708a4db6d4246e233374a0211ca991`; truthful-progress PR `#120` merged as `c0884982c338b0ccabf53b2e7c874a2bbccaed5c`.
- Final production deployment `dpl_AHRZvrCFA4NU4tNaE8vFTJ5y8nbC` reached `READY` and owns the canonical `sales-performance-dashboard-rose.vercel.app` alias. Independent preview deployment `dpl_CpjzdxtQLr884zJhQ4KYGydtDLV8` also reached `READY`; GitHub-created previews failed during Vercel resource provisioning before an application build began.
- Production uses `REP_SCORING_SCORER_VERSION=rep-reviewer-v4.2` and `REP_SCORING_DECLINE_THRESHOLD=10` as server-only variables.
- Authenticated browser verification passed for the overview, a rep detail, and an exact call-evidence page. The account was `syed.haider@insidesuccess.com`; no browser console warning or error was present.
- Vercel reported no runtime error clusters for the reviewed rep-scoring routes. The only recent 404s were optional Apple touch-icon requests.
- The n8n auto-deactivation email received during release corresponded to the earlier intentionally over-capacity 20-worker probe. The worker was republished with the eight-worker cap and active-lease protection, then reactivated. The next 20 worker executions all succeeded with no later crash in that verification window.
- First unattended hourly coordinator execution `445666` succeeded in `scheduled_parallel` mode. It read 2,976 eligible calls, reconciled 193 valid scores plus 79 unresolved quarantines as 272 final outcomes, left 2,704 calls waiting, selected exactly 160 calls, and concurrently started eight 20-call workers (`445710`–`445717`). Four workers had succeeded and four remained actively processing at handoff; none had crashed. The backlog was deliberately left to continue without holding this release task open.
- Final authenticated production verification showed 248 valid scores, 41 review-ready reps, 95 scored reps in the all-evidence view, and six supported needs-attention signals as workers continued. The progress panel stated the factual 160-call active batch without a speculative ETA; browser console and Vercel runtime errors were empty.
- The unattended run exposed a stale coordinator-only ledger filter for `rep-reviewer-v4`. The coordinator was paused, the filter was changed to `rep-reviewer-v4.2`, zero-error workflow validation passed, and the published active graph was read back before the hourly schedule resumed. Immutable score/quarantine outcomes had already prevented duplicate final results; the correction adds visibility of active V4.2 leases and repairs ledger reconciliation telemetry for future snapshots.
- The controlled test webhook remains disabled. The scheduled coordinator is its only enabled trigger; V3 remains intact as rollback.

### 2026-08-06 adaptive catch-up and crash recovery

- The first unguarded twice-hourly version exposed a real overlap: successful coordinator `446148` dispatched workers whose final execution ended roughly 32 minutes after the parent began. Coordinators `446252`, `446311`, and `446433` subsequently crashed and n8n auto-deactivated the coordinator.
- Coordinator `53txJ8KuCRGim8LB` now keeps 30-minute opportunities but first reads only unexpired V4.2 worker leases. A busy slot exits successfully as `skipped_active_batch`; a clear slot continues into the existing heavy scan and dispatch. A failed preflight retries three times and then fails closed.
- The coordinator execution ceiling is 25 minutes, preventing a heavy parent from surviving into the next 30-minute boundary. The 160-call run cap, eight-worker ceiling, 20-call worker size, model, source window, credentials, leasing, and immutable idempotency behavior are unchanged.
- The active workflow is `MM Rep Performance Reviewer V4.2 - Speaker Safe (LIVE ADAPTIVE 30-MIN)`, active version `634f3f19-2142-4cbc-a53a-5edaf62477a3`. Runtime validation returned zero errors, and the controlled webhook remains disabled. Workflow-history version `483` is the verified hourly safe-mode rollback; version `478` remains the pre-acceleration hourly rollback.
