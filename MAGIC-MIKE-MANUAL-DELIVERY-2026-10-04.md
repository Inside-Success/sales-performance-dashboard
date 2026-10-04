# Manual/self-submitted report delivery — 2026-10-04

## Scope

Repair two Bryce Sheldon submissions saved on October 4 and prevent unsafe callback destinations and lost saved results. Official coaching, scoring, compliance, Ask Sales, and existing report content are outside this change.

## Cause and repair

Executions 952998 and 953098 completed coaching and Google Doc creation, then attempted an HTTP callback to localhost:3000. n8n correctly blocked the restricted IP. The database stayed in processing; the dashboard's elapsed-time rule displayed a misleading generation failure.

Production submissions now require a signed-in session and the exact live production dashboard origin. Preview/local requests are rejected before creating a report or spending on AI. Dispatch authenticates to the manual webhook. n8n validates IDs and exact callback/report destinations before acknowledging acceptance or starting coaching.

Every terminal callback is saved in the isolated `Magic Mike Manual Result Delivery` data table before delivery. A separate worker replays only saved JSON, verifies the callback receipt's report ID and status, and records delivery. It has no AI or document-creation nodes. Failed deliveries retry with a ten-minute lease, at most eight worker attempts; exhausted deliveries stay saved as needs_review and use the existing operations error handler. Conditional reservations and terminal database guards prevent concurrent/late updates from replacing completed results.

A dedicated manual failure handler recovers a saved terminal result from a failed execution or queues an explicit failure status when generation failed. It never regenerates AI. The dashboard keeps checking after fifteen minutes and displays a delay, rather than claiming generation failed from elapsed time alone.

## Verification / release

Pending live release and saved-result restoration. Non-server checks: 96 coaching tests; scoped lint and TypeScript; webpack production build. Turbopack's local build cannot follow shared node_modules outside this worktree; webpack succeeds. Full repository lint has 12 pre-existing CommonJS-script violations outside this scope.

Workflow checks cover private/local destinations, callback receipt mismatch, delivery retries/exhaustion, saved-result identity, generation failures, connections and error-output wiring. Live acceptance receipts will be appended after deployment.

## Rollback

Dashboard: revert the scoped Git commit/PR through GitHub and let Vercel redeploy. Coordinate restoring the manual webhook's original unauthenticated configuration if reverting dispatch authentication; otherwise the older dashboard will be rejected safely.

Workflow: private baseline `../.magic-mike-manual-delivery-2026-10-04/BMRrGxHyXMcgO6j3.before.json`. Preserve the delivery table and restored reports. Deactivate the new delivery worker/failure handler only after checking pending queue rows. Restore original manual nodes/connections/settings and publish. Do not regenerate reports or delete source documents.

Private evidence contains execution results and database backups and must not be committed. The repository builder and verifier contain configuration logic only.
