# Recovery execution lookup repair — October 29, 2026

## Problem and safety boundary

The bounded recovery worker (`Zx3S5B1gYHRrbv2F`) repeatedly selected the oldest processing receipt. That receipt referenced a recovery execution no longer available from n8n (HTTP 404). An unhandled lookup failure stopped inspection on every sweep. Six affected parent execution IDs were unavailable; their separate official child executions were still readable and terminal (five canceled, one crashed). A legitimate long-running oldest worker could also starve later stale records.

A missing execution is not proof of failure, non-delivery, or permission to replay. Preserve source recording identity, provider checkpoints, existing-artifact checks, owner-specific claims, and the normal factual/safety review.

## Scoped correction

- Read explicit HTTP status and body. A 404 becomes a durable `needs_review` receipt through the existing compare-and-set update and existing operations notification, with an honest explanation of the missing evidence. It does not automatically retry the call or mark it delivered.
- Preserve errors for authentication, rate limits, server errors and malformed/mismatched execution responses. Never silently interpret these as a missing execution.
- Rotate one stale-claim inspection per five-minute sweep, so an active oldest worker cannot indefinitely block later claims. Do not increase recovery dispatch concurrency or add AI stages.
- Close an unfinished attempt only when its recovery execution ID still owns that processing receipt. An older worker cannot close a newer worker's attempt.
- Keep all existing graph connections and credentials unchanged. The builder is `scripts/n8n/build-recovery-lookup-safety.mjs` and the shared deterministic guards are in `scripts/n8n/crash-recovery.mjs`.

## FAQ review

The observed FAQ failure was a provider timeout. The existing request has an 18-second abort bound, records a sanitized failure, and does not fabricate an answer. Later replies succeeded. Increasing timeouts or adding automatic retries would trade latency/cost and potentially introduce duplicate provider work without evidence of a local defect. No FAQ runtime, model, timeout, retry, or knowledge change is included in this repair. Preserve the October 29 FAQ knowledge publication from PRs 344–345.

## Verification and rollout

- Regression cases cover 404 versus other failures, exact execution/workflow identity, active owners, all terminal statuses, fair selection and owner-specific closure.
- Candidate workflow validation: 14 nodes, 15 valid connections, zero errors/warnings.
- Production acceptance is recorded below from actual scheduled executions and delivered artifacts; local tests alone are not delivery proof.

## Rollback

Private pre-change workflow snapshot is retained under `.private-upgrade/recovery-2026-10-29/`. Restore only the five changed node parameters from that snapshot, validate, inspect connections, then publish. Do not restore historical receipt statuses or replay delivered calls. No source transcripts, workflow credentials or private execution payloads belong in GitHub.

## Live recovery and follow-up defect

PR 346 merged as `2e5d1208b19b78621b4e91c3e49d26279e6682b5`; production deployment `dpl_BRytVyFXfRqwqaxbRPV1kXLJiGV2` is Ready. Published recovery version `5aba4d89-c427-42c4-a5a4-881ba41ce9b4` preserves the graph and credentials. Scheduled execution `1407616` delivered report 8831 and then handled a real missing-parent 404 as a durable review hold, with the existing operations alert, and finished successfully.

Five verified terminal sources recovered as reports 8831–8835. The sixth exposed a separate safety-targeting defect: substring matching of a prose finding also selected the required `show` metadata field. The repair deleted that field; the final contract correctly stopped delivery. The correction restricts Enhanced sentence targets to explicit prose paths in both official and manual workflows, carries the safety rationale/current offer knowledge into the existing repair prompt, and preserves audited show identity in the finalizer. Explicit metadata findings or unmatched findings remain held rather than ignored. Legacy behavior, models, caching, taxonomy, source identity and node count remain unchanged.

Exact saved failing input passed patched preparation and finalization locally with no model requests: the show remained intact and objection judgments/evidence were preserved. The sixth call subsequently delivered as report 8839 through execution 1408558; see final acceptance below.


## Final acceptance

- Official published version: `8956df32-a0af-4df5-af9a-36348659d8ec`; manual: `5e981383-61b5-456e-bebf-12d7b15fe610`. Every node was compared to the baseline plus the three intended code changes per workflow. Published and saved graphs match; connections, credentials, models and node counts are unchanged.
- 176 focused tests passed. Full CI includes the broader reliability suite, TypeScript and production build. A separate offline replay of the saved successful manual submission also passed the published prepare/finalizer code without a provider request.
- The generic static Code-node checker reported the same nested-helper array-return errors on unchanged baseline code and candidate code. These are not runtime failures: actual compiled input replays pass. Full connection/expression validation has zero errors and only the existing legacy-node/expression warnings.

| Source | Successful official execution | Dashboard report |
|---|---|---|
| recWIOSN84CrsoXMd | 1407618 | 8831 |
| recTRQqYyjF32smih | 1407719 | 8832 |
| rec3djhRSZCAwrpcx | 1407876 | 8833 |
| recWUAmu6eVfoQ08x | 1407977 | 8834 |
| rec3hN1il8GrBo7k9 | 1408061 | 8835 |
| recfKF3cIgiBrYGe5 | 1408558 | 8839 |

All six have exactly one matching dashboard report, valid source-bound Enhanced content and safety provenance, a linked Google Doc, successful top-level/thread Slack delivery, persisted delivery receipts and `done` source claims. Authenticated dashboard pages 8831 and 8839 were visually read. The final recovery parent 1408556 succeeded. Its child reused writer, factual review, compliance and safety-screen checkpoints at zero new cost; only the changed targeted repair cost $0.080328. No paid benchmark or extra AI stage was added.

The earlier October 22 claim with unavailable execution history was not replayed or treated as failed merely because its history is missing. These six reconciled sources are the recent incident cohort; this release does not claim to have reconciled every historical orphan.

FAQ remained unchanged. Eight later assistant replies after the observed timeout had no recorded provider error at the final focused check. Provider timeouts remain possible; masking them or adding unbounded retries would not improve reliability.
