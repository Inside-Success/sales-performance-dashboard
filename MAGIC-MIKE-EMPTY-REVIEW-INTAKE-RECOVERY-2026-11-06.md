# Coaching empty-review and Airtable update recovery — November 6, 2026

## Scope and verified causes

This is a scoped follow-up to the November 5 repair contract. Script Adherence, FAQ, scoring, classification policy, models and report destinations are unchanged.

Six official reports were held with `missing L1 adjudication`. The previous validator required `l1_decisions: []` even when the deterministic screen found zero candidates. Four retained execution traces demonstrate that exact condition; the older two have durable failed-source receipts and completed provider responses but their full executions have expired. The prompt compounded the issue by presenting the old JSON template without this field, then appending instructions requiring it after the report/transcript.

A separate intake execution created and populated an existing transcript document, then exhausted its three Airtable update attempts during a service error. The source record remained `Needs Review`, with no transcript link and an obsolete waiting-for-transcript note. Existing recovery covered rejected document creation only, not the final Airtable update. The generic failure receipt also lacked the source key needed for automatic recovery.

## Coaching correction

- Omitted L1 decisions normalize to an empty list **only when there are zero candidates and the property is absent**. Null, malformed, unexpected or incomplete lists still fail closed. Real candidates still require exact ID, decision and reason. The screen must contain a boolean verdict and all three finding arrays; caught provider/parse failures in the manual caller cannot turn into an implicit zero-hit pass.
- Enhanced prompts now have one complete JSON example, with adjudication instructions before source data. Legacy prompts remain unchanged.
- The other safety finding arrays, contradictory verdict checks, prose-only repairs, exact request identity, factual review, metadata protection and delivery duplicate guards remain intact.
- Both official and manual embedded copies are patched. Connections and node counts are unchanged. No model or normal AI stage is added.
- Replaying the four retained original responses through the candidate preparation code correctly releases the three zero-finding cases to finalization and sends the substantive fourth case to its existing six-field repair. This is a mechanics check, not independent proof of model accuracy.

Apply `scripts/coaching-upgrade/build-empty-adjudication.cjs` after the November 5 repair builder when regenerating compatible historical workflows. It accepts only the expected embedded function counts. Never regenerate or publish over an unverified live baseline.

## Intake correction

- The existing update step retains its original retry policy. Its exhausted error output now captures the exact paired record, recording identity, existing transcript document, desired fields and previously read fields into the existing durable failure ledger. No transcript, credential or OAuth token is stored in this recovery payload.
- The existing five-minute recovery worker gains a separate update-only branch. It claims one eligible receipt atomically, reads the current exact record, verifies meeting/recording/document identity, and patches only the saved update. It never creates a record or document and never invokes classification/coaching AI.
- Newer manual metadata is preserved. Conflicting identities, documents, call classification and intentionally ignored records remain held. Only the known machine-generated waiting notes are removed.
- Already-applied writes are reconciled against the read-back. PATCH has no blind transport retry: an ambiguous network failure returns to a fresh read before any subsequent attempt. Transient recovery errors have due-time backoff and a maximum of three scheduled attempts; semantic/authentication failures remain held with the existing notification route.
- Completion is recorded only after reading the source back and matching its key, UUID, recording, document, status and call stage. Only the claimed event is closed, not all events sharing a call key.
- The normal successful update path adds one pass-through checkpoint and no provider calls or additional workflow executions. Durable payload storage happens on the exhausted failure branch. Existing document-creation recovery is preserved. Non-recoverable capture outcomes still use the existing intake alert, with a concise reason rather than the private saved payload.

## Verification and rollout

- 170 coaching/review/presentation tests passed, including the empty-list and intake recovery regressions. TypeScript and production build passed.
- Existing durable-provider, retry-policy, crash-recovery and reliability-contract verification scripts passed.
- Candidate connection validation passed for all four workflows. New non-Code recovery nodes passed runtime configuration validation; embedded Code nodes compile. Pre-existing unreachable legacy-node warnings are unchanged.
- Live snapshots were compared before every publication; nodes, connections and active published version were checked afterwards. Baseline snapshots and recovery evidence are private under `.private-safety/reliability-2026-11-06/` and are not committed.

| Workflow | Published version |
| --- | --- |
| Official coaching `L8Nn7xncA9ZPDdWA` | `6855e4b5-3df9-44a5-9df4-4f9c9f48ce6f` |
| Manual coaching `BMRrGxHyXMcgO6j3` | `760ad3d6-a581-4711-8879-d571d072be66` |
| Zoom intake `qMQYNQtQbRZWjtG2` | `5d430b2d-6a71-4cb7-a9a5-611851c6675e` |
| Existing intake recovery `4WXlEbkTrja4AjRa` | `8d180b88-ad66-4509-a22e-55e2aaf9c50b` |

## Recovery acceptance

Coaching artifact verification is in progress. Intake recovery completed in scheduled execution `1586514`: the original record now has its existing document link, `Processed`, `Call 1`, and no stale waiting note. The exact source read-back and authenticated Airtable UI agree; original failure event 580 is recovered. No document creation or model node ran in this update-only recovery. A separate native two-item fixture verified failure capture and item pairing without business writes and was deactivated. A new real manual submission also completed under the updated workflow (`1586473`), with a valid safety response, document creation and a completed dashboard callback; it was observed, not submitted as a paid test. Six exact undelivered coaching sources were checked in both dashboard and Airtable report stores before owner-specific claim release and receipt queueing. No running provider request was present for those sources. The intake document was read and matched before the single original failure event was enriched with its saved payload and queued. Do not treat these queue operations or workflow publication as completed delivery.

## Limits and rollback

This fixes the demonstrated false hold and final-update recovery gap; it does not promise that provider outages, missing sources, genuine unsafe advice or ambiguous writes cannot happen. The error-branch payload depends on the workflow reaching its failure handler; a process crash before capture remains covered by existing diagnostics rather than an invented completed outcome. Stale claimed recovery attempts remain review holds rather than being blindly stolen.

Restore only the affected workflow changes from the private pre-release snapshots after checking current versions. Preserve completed reports, source keys, pending payloads, receipts and provider checkpoints. Do not reset paid requests or replay uncertain deliveries. Revert only these scoped repository changes if required.
