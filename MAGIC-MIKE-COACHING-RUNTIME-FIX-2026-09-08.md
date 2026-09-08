# Coaching runtime compatibility repair — September 8, 2026

## September 8 coaching presentation successor — current

See `MAGIC-MIKE-COACHING-PRESENTATION-2026-09-08.md`. The coaching voice, shared presentation contract, private coaching knowledge consolidation and reviewer materiality filtering are live. Google Doc closing content and clickable source links are addressed. Both previously missing scores were recovered and independently read back without resending coaching. Compliance/shared context/scoring criteria remain unchanged. The 15-minute Codex monitor is **PAUSED**, superseding older active-monitor statements below. Natural delivery under the final presentation revision is still pending observation. Historical prose is not rewritten; Ask Sales is outside this release, not a prerequisite. Scoring enhancements and manager-page simplification follow separately.


The first natural Call 2 execution exposed a production sandbox mismatch: `structuredClone` is unavailable in n8n Code nodes. Earlier local tests ran with the host Node global available and did not catch it. Executions 685864 and 685975 failed in request preparation before writer/audit generation. Their overall n8n success status reflects completed error handling, not a delivered coaching report.

## Repair

Replaced unsupported clone calls with a JSON-compatible copy helper in eight official/manual coaching nodes, including retained disconnected confirmation nodes. Workflow items and provider payloads are JSON data. Updated the shared renderer and candidate builders to prevent reintroducing the unsupported global. No prompts, models, reasoning settings, coaching policy, scoring, compliance, shared context, delivery nodes or graph connections changed.

## Verification

- An isolated two-node workflow ran the actual candidate code in the production n8n sandbox. It confirmed `typeof structuredClone === "undefined"` and passed the failed call's preparation input plus all 18 saved official/manual evaluation cases. Final coaching outputs matched exactly. It used saved provider outputs: no new provider calls, reports, Google documents, callbacks or Slack messages.
- That isolated workflow is now inactive. The runtime test is distinct from natural full delivery.
- Fifteen unit tests pass, including a fresh JavaScript VM without structuredClone, deep-copy independence and JSON values. Candidate builder checks leave no unsupported clone calls.
- Active official/manual graphs read back equal to the repaired candidates. Shared provider, scoring generation and score persistence remain unchanged.
- Natural official delivery is now verified in execution 686041; final evidence is below. The user explicitly authorized recovery of both pre-fix calls with normal delivery. A temporary, allowlisted recovery workflow checks for an existing Airtable report before any normal report writes. Both coaching recoveries are verified below; separate manager scores were not regenerated.

## Published versions

- `L8Nn7xncA9ZPDdWA`: `e629b497-07d3-4fb0-8011-38adeb7bef5f`, updated `2026-09-08T15:33:12.291Z`.
- `BMRrGxHyXMcgO6j3`: `0a57d113-c6b6-4d28-bbcc-c025ff303f78`, updated `2026-09-08T15:33:20.351Z`.

Private baselines, candidate/rollback operations, exact runtime workflow and result, and natural failure evidence are in `.magic-mike-runtime-fix-2026-09-08/`. Do not commit those prompts or transcripts to the public repository. The immediate rollback snapshots contain the known clone defect; do not restore them casually or treat them as healthy. Refresh current affected state before any rollback.

Sonnet 5 cost estimates, coaching improvements and preserved boundaries from the efficiency release remain applicable. This repair changes runtime compatibility, not model quality or pricing. GitHub/deployment completion is recorded in the operator handoff and PR after merge.

## Verified live delivery and recovery

The runtime defect is repaired. A natural official execution and both explicitly authorized coaching recoveries completed:

| Kind | Original execution | Completed execution | Dashboard report |
| --- | --- | --- | --- |
| Natural incoming Call 2 | — | 686041 | 5803 |
| Authorized recovery | 685864 | 686066 | 5804 |
| Authorized recovery | 685975 | 686165 | 5805 |

All three persisted `claude-sonnet-5` and the Enhanced generation marker. Source identifiers match the corresponding provider requests, Airtable rows and dashboard payloads. Each recovery checked that no Airtable report already existed, created one report row, and received one successful top-level and one successful thread Slack response. Direct DB checks found exactly one report per checked source. Both temporary workflows are inactive: sandbox test `bBl9cU2I767jTQFG` and restricted recovery `rOfntFnoLrElXjWG`.

Writer plus factual-review costs for these three calls were $0.128008, $0.153210 and $0.147244 respectively. These exclude scoring, compliance, safety and other stages. Natural report 5803's outcome and cited strengths were spot-checked against transcript evidence; the generated Google Doc was read back. This is delivery and bounded content verification, not a guarantee of every future coaching judgment.

Two separate limitations are confirmed and remain outside this runtime repair:

- The temporary recovery workflow is not an allowed caller of the manager scorer. Existing coaching fallback delivered both reports, but the two recoveries did not regenerate separate manager scores. No scorer permission rules were changed or bypassed. The normal official execution reached the existing scoring/persistence path.
- The existing Google Doc template expects object-shaped closing sections, while current coaching supplies strings. Report 5803's Google Doc contains an empty Why No Close heading although its complete explanation is present in Slack and the dashboard. No existing Google documents were edited to hide or correct this separate formatting issue.

No natural manual submission has yet provided post-fix end-to-end evidence; manual code passed the actual n8n sandbox fixtures. Provider timeouts and the separate Vercel preview provisioning issue are not resolved by the runtime fix.

Code PR #173 merged at `26611171d91ddfdc8b8245ed44d7c634e43a7e40`. Deployment `dpl_A2hnNi7zFXTRn2aAffaKR2UdBKnq` was verified READY/PROMOTED on that commit; the live sign-in GET returned 200. Documentation-only follow-up records these final delivery results. The bounded read-only monitor remains active, with report 5803 already counted/notified; the two recoveries are recorded separately and must not be replayed again.
