# Magic Mike coaching reliability — September 15, 2026

## Scope and cause

Authorized fix for recurring automatic coaching failures, plus recovery of missing reports. The September 8–14 alert sample contained 37 source calls: two reports had already been recovered and 35 were absent from both the live coaching Airtable table and dashboard before this work.

The failure families were conflicting completion/eligibility status (15), invalid transcript evidence references (14), and other malformed response/provider failures (6). Existing catch branches sent an alert but ended the overall n8n execution successfully, so a green execution alone did not prove delivery. The existing uncaught-error ledger did not cover these caught coaching failures.

## Released behavior

- Official workflow `L8Nn7xncA9ZPDdWA` calls `FShnTde2OGhIUZE4` after the existing coaching writer. The shared subworkflow validates output, resolves genuine eligibility disagreements against the transcript, and performs the existing factual audit.
- Valid drafts incur the existing factual audit only. A malformed draft gets at most one targeted writer repair; a malformed audit gets at most one targeted audit repair. These use the existing provider configuration, not a new model tier. Invalid evidence is never accepted merely to produce a report.
- Administrative/access/scheduling-only calls can finish as evidence-supported exclusions. Meaningful selling can still receive coaching when interrupted or unsuccessful. The classifier is not blindly overruled or obeyed.
- Caught failures enter project-owned completion table `VLIchjpKA0NJLknv`. Delivery records require the dashboard to acknowledge the matching Airtable report ID. Exclusions retain their reason. Failed recovery is visible and does not retry indefinitely.
- Recovery worker `Zx3S5B1gYHRrbv2F` atomically claims a queued source and executes the official recovery entry. It checks the source and existing Airtable reports first. An existing report prevents a replay; a partial-delivery case must be inspected rather than blindly regenerated.
- Recovery bypasses numeric rescoring. Fourteen independently repaired historical outputs were cached in project-owned table `EVJi4LKmZInVOvCr` to avoid paying for the same coaching generation and audit again. Cached outputs require both source and request-ID alignment.

## Boundaries

Compliance prompts, policies, categories, context pack, numeric scoring rubric, Ask Sales, manual self-submitted workflow, manager pages and Zoom intake were not changed. Recovery runs existing compliance and normal report delivery for missing eligible reports. No test messages or duplicate reports are intended; historical successful Slack messages are not edited. Source Google documents are not edited.

Manual self-submissions remain a separate workflow. This release addresses the automatic intake failures evidenced in the alert sample; it is not a new release of the manual pipeline.

## Verification and operations

- Retained failure fixtures: 14 tested in isolation, ultimately producing eight eligible coaching outputs and six supported exclusions. The administrative-only case initially produced a candidate report; that was caught and corrected before recovery release.
- A recent successful call fixture required no writer repair and passed the existing single factual audit.
- Local regression tests cover unknown citations, inconsistent statuses, refusal confirmation, request/source alignment, fenced JSON, bounded repair failure, audit failure, replay guard and dashboard acknowledgement.
- The first recovery canary excluded an administrative call without a report or numeric scoring. The full-delivery canary created the source report, document, normal Slack messages and dashboard report 6127.
- Run: `node --test scripts/coaching-reliability/reliability.test.cjs`. Tests are synthetic and have no network or delivery side effects.
- `scripts/coaching-reliability/released-code-nodes.json` captures the relevant released Code-node logic for review and regression tests. It is not an auto-deployment artifact. It contains no transcripts, credentials or customer fixtures.

## Final verified result

- All 35 previously missing historical calls are accounted for: **23 recovered reports and 12 valid exclusions**. The two reports already present were preserved.
- Final live Airtable and dashboard reads agree: **25 reports for 25 unique source calls** in the original 37-alert sample, with no missing document links. Twelve administrative/technical/no-substantive-sales calls remain excluded, not fabricated as coaching reports.
- No historical queue entries remain queued, processing or needing review at final reconciliation.
- Two natural automatic calls completed during the work: executions 738767 (dashboard 6133) and 739067. Slack top-level/thread receipts and dashboard records were verified. These natural calls preceded the final transport-only change; that final change was verified end-to-end by recovery execution 739145.
- Duplicate canary 738894 stopped at the existing-report guard: no writer, factual review, numeric scoring, Slack or document write ran.
- During recovery, Google Docs returned a 502 for execution 738957 after Slack succeeded. The already-created document was confirmed empty, restored using its current revision, and read back exactly. Delivery-only execution 739114 completed dashboard 6149; no AI or Slack was repeated. The old recovery event was marked recovered.
- A long factual review exceeded the public n8n webhook proxy timeout. Coaching writer/repair/review calls now use internal provider subworkflow `UGDHDrhhaqooSiEd`, preserving the original Anthropic request/credential configuration. Its writer and review completed successfully during 739145. The original provider webhook and all compliance callers remain unchanged.
- Recovery exclusions made by the initial classifier now also receive terminal receipts; they cannot advance the intake loop twice.
- Worker `Zx3S5B1gYHRrbv2F` is active, with its five-minute schedule enabled. It claims at most one queued source per execution, stops after one recovery attempt, and records a traceable execution ID. Empty polls make no AI calls.
- Temporary test/drain webhook nodes were removed; temporary source-read and final-delivery helper workflows are inactive.
- **12 synthetic regression tests pass.** The three new persistent helper workflows validate with zero configuration/connection errors. Official workflow topology validates with zero errors; six disconnected legacy audit nodes remain unreachable and generate no AI calls. All official Code-node bodies were syntax-checked separately.
- Isolated paid test usage estimate: **$1.651992**, excluding normal processing costs for historical recovery and natural calls. This is token/pricing-derived, not a reconciled provider invoice.

These fixes address the observed validation, eligibility, completion-tracking and internal proxy-timeout failures. They do not promise that external APIs can never fail. Exhausted or ambiguous partial writes remain visible instead of being silently discarded or blindly repeated.

Final workflow versions:
- Official: `2941e79c-eec1-4a29-a713-e18483154c0c`.
- Reliability: `e3bc5de4-668e-45cc-a7ad-c55245555b2e`.
- Internal provider: `21c038f3-f3e8-4e30-a8ee-44d35bc26835`.
- Recovery worker: `f7b8876c-a100-4b88-99ee-6701eccedf85`.


## Rollback and concurrent work

Full pre-change workflow snapshots and private execution evidence are retained locally under `.magic-mike-coaching-reliability-2026-09-15/` in the project root; do not commit private execution exports. To roll back, stop recovery dispatch first and restore the official workflow from its captured baseline after checking for concurrent edits. Preserve the completion ledger and already delivered reports. Do not replay successful deliveries. Deactivate new helper workflows only after no caller depends on them.

No dashboard application files change in this release. Repository updates are documentation and regression artifacts; they do not deploy n8n. Shared-dashboard production releases must remain coordinated with the separate Ask Sales task. The repository's Ask Sales PR workflow is path-filtered and these artifacts are outside its triggers. Do not merge an unrelated stale application branch merely to publish this operations record.
