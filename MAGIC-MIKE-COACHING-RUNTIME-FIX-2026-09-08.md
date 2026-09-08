# Coaching runtime compatibility repair — September 8, 2026

The first natural Call 2 execution exposed a production sandbox mismatch: `structuredClone` is unavailable in n8n Code nodes. Earlier local tests ran with the host Node global available and did not catch it. Executions 685864 and 685975 failed in request preparation before writer/audit generation. Their overall n8n success status reflects completed error handling, not a delivered coaching report.

## Repair

Replaced unsupported clone calls with a JSON-compatible copy helper in eight official/manual coaching nodes, including retained disconnected confirmation nodes. Workflow items and provider payloads are JSON data. Updated the shared renderer and candidate builders to prevent reintroducing the unsupported global. No prompts, models, reasoning settings, coaching policy, scoring, compliance, shared context, delivery nodes or graph connections changed.

## Verification

- An isolated two-node workflow ran the actual candidate code in the production n8n sandbox. It confirmed `typeof structuredClone === "undefined"` and passed the failed call's preparation input plus all 18 saved official/manual evaluation cases. Final coaching outputs matched exactly. It used saved provider outputs: no new provider calls, reports, Google documents, callbacks or Slack messages.
- That isolated workflow is now inactive. The runtime test is distinct from natural full delivery.
- Fifteen unit tests pass, including a fresh JavaScript VM without structuredClone, deep-copy independence and JSON values. Candidate builder checks leave no unsupported clone calls.
- Active official/manual graphs read back equal to the repaired candidates. Shared provider, scoring generation and score persistence remain unchanged.
- Natural post-fix end-to-end delivery remains a separate pending checkpoint. The user explicitly authorized recovery of both pre-fix calls with normal delivery. A temporary, allowlisted recovery workflow checks for an existing Airtable report before any normal report writes. Recovery results are pending.

## Published versions

- `L8Nn7xncA9ZPDdWA`: `e629b497-07d3-4fb0-8011-38adeb7bef5f`, updated `2026-09-08T15:33:12.291Z`.
- `BMRrGxHyXMcgO6j3`: `0a57d113-c6b6-4d28-bbcc-c025ff303f78`, updated `2026-09-08T15:33:20.351Z`.

Private baselines, candidate/rollback operations, exact runtime workflow and result, and natural failure evidence are in `.magic-mike-runtime-fix-2026-09-08/`. Do not commit those prompts or transcripts to the public repository. The immediate rollback snapshots contain the known clone defect; do not restore them casually or treat them as healthy. Refresh current affected state before any rollback.

Sonnet 5 cost estimates, coaching improvements and preserved boundaries from the efficiency release remain applicable. This repair changes runtime compatibility, not model quality or pricing. GitHub/deployment completion is recorded in the operator handoff and PR after merge.
