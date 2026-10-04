# Manual/self-submitted report delivery — 2026-10-04

## Scope

Repair two Bryce Sheldon submissions saved on October 4 and prevent unsafe callback destinations and lost saved results. Official coaching, scoring, compliance, Ask Sales, and existing report content are outside this change.

## Cause and repair

Executions 952998 and 953098 completed coaching and Google Doc creation, then attempted an HTTP callback to localhost:3000. n8n correctly blocked the restricted IP. The database stayed in processing; the dashboard's elapsed-time rule displayed a misleading generation failure.

Production submissions now require a signed-in session and the exact live production dashboard origin. Preview/local requests are rejected before creating a report or spending on AI. Dispatch authenticates to the manual webhook. n8n validates IDs and exact callback/report destinations before acknowledging acceptance or starting coaching.

Every terminal callback is saved in the isolated `Magic Mike Manual Result Delivery` data table before delivery. A separate worker replays only saved JSON, verifies the callback receipt's report ID and status, and records delivery. It has no AI or document-creation nodes. Failed deliveries retry with a ten-minute lease, at most eight worker attempts; exhausted deliveries stay saved as needs_review and use the existing operations error handler. Conditional reservations and terminal database guards prevent concurrent/late updates from replacing completed results.

A dedicated manual failure handler recovers a saved terminal result from a failed execution or queues an explicit failure status when generation failed. It never regenerates AI. The dashboard keeps checking after fifteen minutes and displays a delay, rather than claiming generation failed from elapsed time alone.

## Verification / release

Dashboard PR256 merged `0cb5a14f04b584d6db3f5ba56cddf94f5faf2fca`. Production `dpl_9LPVbSyPV3JoY9hF3RDL9FrA9Sbv` READY and aliased to the live dashboard. The preview deployment failed during resource provisioning before the application build; production deployment succeeded. Non-server checks: 96 coaching tests; scoped lint and TypeScript; webpack production build. Turbopack's local build cannot follow shared node_modules outside this worktree; webpack succeeds. Full repository lint has 12 pre-existing CommonJS-script violations outside this scope.

Workflow checks cover private/local destinations, callback receipt mismatch, delivery retries/exhaustion, saved-result identity, generation failures, connections and error-output wiring. Live verification:

- Original saved Bryce results restored at their existing public IDs: `83d0414c96df4569839c3b300d7f284c` (execution952998) and `716dd1bd1e2944e6acf8660cf70c853e` (execution953098). Both show Enhanced coaching, call outcome, four improvements, strengths, buyer concerns and agreed next steps in the signed-in dashboard. Original report/transcript document links retained; report document opens in Google Docs.
- Delivery receipts: executions954302 and954307 acknowledged the correct public_id and completed status. Execution954309 acknowledged the first disposable submission's needs_transcript_paste status.
- Live callback404 fixture954194 followed the wired retry branch and retained its payload. A late failed callback in954277 returned completed and could not replace the existing report. The isolated fixture was archived as test_complete.
- Fresh browser submissions954221 and954315 returned needs_transcript_paste for an intentionally nonexistent recording, with no AI/provider/doc-generation node run. The final submission's cached delivery was marked delivered immediately. Both disposable database records and the temporary authenticated test workflow were removed after verification; genuine reports were preserved.
- Native JSON request bodies are required for callbacks. Testing exposed n8n's raw-body/unresolved-stream behavior despite explicit JSON response format. Native JSON fixes receipt parsing and avoids storing raw request/response internals. See n8n's source `packages/nodes-base/nodes/HttpRequest/V3/HttpRequestV3.node.ts` (raw body sets useStream). No stream-decoding workaround or credential extraction is used.
- Scheduled delivery workflow `GwHnVhKGh0wsmQMt`, failure recovery `46jVCdeYmlQb1380`, data table `eBb8D6bZdCTJ91xc`. Manual workflow `BMRrGxHyXMcgO6j3` remains active and published. Final isolation checks confirm only its original Webhook, Normalize Input and Post Callback nodes changed; all coaching/provider/document nodes match the private baseline exactly.
- Queue has zero undelivered rows at acceptance. Recent official coaching, intake and weekly-summary runs were successful. These adjacent observations are bounded smoke checks, not a claim that every external service can never fail.

AI testing/generation spend: $0. Saved reports were delivered without regenerating AI or documents. A naturally arriving new completed AI-generated manual submission after this release has not yet been observed; its unchanged generation nodes are preserved, and the changed delivery path has live saved-result and fresh-submission acceptance evidence.

## Rollback

Dashboard: revert the scoped Git commit/PR through GitHub and let Vercel redeploy. Coordinate restoring the manual webhook's original unauthenticated configuration if reverting dispatch authentication; otherwise the older dashboard will be rejected safely.

Workflow: private baseline `../.magic-mike-manual-delivery-2026-10-04/BMRrGxHyXMcgO6j3.before.json`. Preserve the delivery table and restored reports. Deactivate the new delivery worker/failure handler only after checking pending queue rows. Restore original manual nodes/connections/settings and publish. Do not regenerate reports or delete source documents.

Private evidence contains execution results and database backups and must not be committed. The repository builder and verifier contain configuration logic only.
