# Magic Mike intake recovery — September 22, 2026

## Scope and result

Authorized repair of upstream transcript intake and failure visibility, plus removal of three explicitly discarded stale September manual submissions. The n8n changes are live. This PR records the release and offline regression checks; it contains no dashboard application change or deployable workflow export.

Three failed intake calls were restored from saved transcript/classification checkpoints. One was a Call 2+ that completed normal coaching delivery; the other two retained their existing Call 1 classifications. No fresh AI classification was needed for these recoveries. Ten other affected call keys already had processed source records and transcript documents; they were not regenerated. The durable ledger now reflects those verified recoveries.

Two distinct Zoom transcript files remain unavailable: fresh recording metadata lists them, but both authorized OAuth downloads and freshly issued download-token downloads return HTTP 404. Their source records remain pending. Do not label them recovered, fabricate transcript content, or blindly replay AI analysis.

## Why the previous handling missed this

The September 8 reliability release replaced blanket Google document retries with a policy that avoids replaying ambiguous writes. That protects against duplicate documents, but the native Google Docs node reduced these failures to a generic Forbidden message. The replacement policy therefore did not recognize those explicit Google rejections as safe bounded retry candidates.

Handled intake errors were saved in the durable ledger but did not emit a Slack notification. The existing coaching recovery worker begins downstream of a successfully ingested transcript, so it could not recover these upstream document failures. A workflow-level success status was therefore insufficient evidence that every input was delivered.

The old execution data does not establish whether each Google rejection was permission-related, quota-related, or another provider condition. The same Google credential and destination folder were verified usable during this repair. Do not invent a more specific historical provider cause.

## Released behavior

- Document creation uses the same Google credential, destination folder, title, and Google document MIME type through the Drive HTTP API. The full response preserves HTTP status and Google's error reason. The returned document ID is normalized to the existing downstream contract, and linked-item identity is retained.
- Explicit 403 rejections receive bounded delayed retries; quota rejections retain the existing quota backoff. Ambiguous timeout/5xx writes are still held rather than blindly repeated.
- Exhausted handled intake failures now notify the existing failure channel after ledger persistence, with stage, call identity, sanitized reason, and execution link.
- A small five-minute worker selects at most one rejected document-creation event, claims its ledger row, retrieves the exact cached call input, and resumes the existing intake tail. It does not call an AI model. Completed, in-progress, and already-failed recovery keys are excluded. A failed recovery stops and alerts rather than cycling indefinitely.
- The recovery entry reuses existing Airtable identity checks, existing-document reuse, and final pre-create safeguards. It is a subworkflow entry, not a public webhook.
- Trigger errors without an n8n execution ID explicitly say so and link to the workflow instead of producing a blank execution URL.

Normal coaching, compliance, scoring, Ask Sales, model settings, training documents, and dashboard rendering were not changed. No broad backfill ran. The three discarded manual submissions were backed up before deletion; completed submissions were preserved.

## Verification and limitations

- Offline behavioral checks cover mixed success/failure item alignment, preservation of Google error reasons, bounded rejection/quota retry, no ambiguous-write replay, one-attempt queue guards, and cached-input validation. Run `node scripts/magic-mike-intake-recovery/verify.cjs`.
- Published intake connections and expressions validated with zero errors. The recovery worker passed full workflow validation. Advisory warnings remain; they are not described as an entirely warning-free system.
- The isolated document-create candidate initially exposed an n8n expression syntax error. It was corrected before production publication and then created and populated real missing transcript documents successfully.
- A live worker verification reused an already recovered source without making another document or rerunning classification. A separate historical recovery demonstrated the stop-and-alert branch when n8n had pruned its original execution; the locally preserved checkpoint was then used for the authorized recovery.
- A fresh natural intake after release created a transcript document with HTTP 200, inserted its content, and updated the intended source record. It was Call 1 and correctly did not require a coaching report.
- The recovered Call 2+ completed Slack top-level/thread delivery, report-document delivery, and dashboard insertion. The scorer ran and returned an exclusion for insufficient scoring opportunity; no numeric score was fabricated.
- Temporary diagnostic/recovery webhooks were deactivated and the temporary worker verification entry removed. The scheduled bounded worker remains active.

External outages and unavailable source transcripts remain possible. This release addresses the observed rejection/recovery/visibility gaps; it is not a guarantee of future outage-free processing. The new rejection retry behavior is regression-tested, but no genuine post-release Google 403 has been forced in production.

## Operations and rollback

Private workflow baselines, execution receipts, call-level evidence, discarded-row backup, and final readbacks are retained outside Git in the workspace's `.magic-mike-intake-repair-2026-09-22/` directory. Do not commit that directory: it contains confidential data and temporary access tokens.

Before rollback, inspect active/waiting executions. Disable the new rejected-document worker first, then restore only the affected intake nodes/connections and failure-alert text from the pre-release snapshots. Preserve completed recovery records and documents. Do not reactivate older duplicate intake/coaching workflows.

The shared dashboard production branch is `main`; branch pushes can create Vercel previews. This documentation/test-only branch is left unmerged so it does not promote a dashboard release. No GitHub workflow is triggered by these paths under the current path-filtered release-check configuration.
