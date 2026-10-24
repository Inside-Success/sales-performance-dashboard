# Magic Mike failure recovery — 17 September 2026

## Scope and authority
User authorized fixing missing failure alerts, missing Call 2 coaching deliveries, and Zoom reconciliation item matching. No fake notifications, unrelated-owner workflow edits, dashboard application changes, training-document edits or rubric/model changes. Real recovery deliveries and failure alerts are authorized.

## Confirmed causes
- Official executions 752841 and 752890 failed during the September 16 n8n task-runner outage. The normal failure path also needed a runner; it failed before sending Slack. The catch-all started with another Code node and only stored events, without sending Slack. Later items in a failed batch could be skipped without completion receipts.
- Zoom reconciliation 742446/759291 encountered two Airtable searches with no exact match. Native search collapsed empty results, leaving ambiguous item links and a Multiple matches error. This was not proof that Zoom webhooks were disabled.

## Released changes
- `mgvnNUDfqNatEy3e`: replace first failure Code node with native Set; retain durable event storage and add real Slack failure delivery. No runner dependency in this catch-all path.
- `mIsdpJO71D8DMrxe`: new owner-scoped five-minute failed-execution scanner. Reads failed official executions, examines entire input batch, queues missing Call 2 sources once, skips completion receipts and Call 1s, conservatively holds ambiguous existing writes. One scan receipt and real backlog alert per failed batch. No AI in the scanner.
- `Zx3S5B1gYHRrbv2F`: retain one-attempt recovery and add native notification when final receipt needs attention. Does not silently label an unfinished attempt delivered.
- `qMQYNQtQbRZWjtG2`: four Airtable search nodes now return one HTTP records-array envelope per input. Four corresponding attachment nodes preserve explicit item links and existing identity/completed-record guards. Credentials, matching rules and connections retained.
- New n8n API header credential uses the existing Moonis connection and is restricted to the n8n host. No other owner's credentials or workflows changed.

## Evidence
- Isolated native test 762886: two empty Airtable searches retained both distinct input identities; no writes, AI or notifications.
- Local regression: all four attachment paths with empty/mixed results, completed pending exclusion, incorrect identity rejection, exact pre-create match; actual failed-batch fixtures, deduplication and partial-write guards passed.
- Scanner 762949 found and queued exactly three missing sources. Both real Slack alert nodes succeeded. Repeat scan 762954 and subsequent periodic scan 763017 queued nothing again.
- Cached Zoom tail recovery 762992 succeeded for both affected records (`recJwYlmOKjwhZ08W`, `recUUWXg2iWOgMRds`), created transcript documents and updated existing Airtable rows. Cached classification/transcript data avoided additional AI calls. Temporary intake helper deactivated.
- Error ledger, scanner and worker full validation: zero errors. Intake connection/expression validation: zero errors; existing unreachable legacy nodes remain unchanged. Changed Code bodies parse and targeted tests pass. Live saved/active versions match.

## Limits and operational safeguards
- No artificial production failure was generated. Catch-all execution 763184 stored the actual temporary-helper receipt error and successfully sent Slack (ok=true). The final-recovery needs-attention branch validates but was not forced to fail.
- Scanner handles up to five previously unscanned errors per pass from the latest 100 failed official executions, starting September 16. It is not an unlimited historical backfill.
- Recovery follows the existing coaching-only recovery path; numeric scoring/rubric and compliance rules were not redesigned in this repair.
- A complete n8n/platform or Slack outage can still prevent immediate notification; the independent scan repairs this documented missing-queue case after services resume. Do not claim all external failures are impossible.

## Rollback and continuity
Private baseline/live exports and execution evidence are in `.magic-mike-failure-safety-2026-09-17/`. Never commit transcripts, cached execution inputs or credentials. Roll back individual changed nodes from baseline, deactivate the new scanner first if required; do not blindly restore queues, replay deliveries or delete completed reports. Preserve concurrent Ask Sales and scorecard work.

## Final delivery verification
- Cindy / Troy Fidis: successful execution 762972, dashboard 6302, source report recB045Ia4P2svSqn.
- Elena / CK: successful execution 763022, dashboard 6304, source report recUqVB2i9eXV5pOj.
- Karla / Greg B: successful execution 763061, dashboard 6305, source report recUAltlj7mm9niRk.
- All three have delivered receipts, source reports, documents and successful Slack replies; independent database query found exactly one matching dashboard row per source.
- Temporary three-item helper 762971 failed ONLY at its final receipt lookup after all three child deliveries succeeded: the single-item worker receipt expression was ambiguous in the temporary multi-item wrapper. No calls were replayed. Final receipts were read independently. Helper is inactive; the permanent worker retains limit=1. This error also verified the new catch-all Slack delivery.
- Temporary test and intake/recovery helpers are inactive. Scanner temporary manual webhook removed; only its five-minute schedule remains.
- New intake executions 763057/763067/763076/763080/763083 succeeded after the fix. A subsequent complete scheduled Zoom inventory scan has not yet been observed; the actual failing two-item downstream path was recovered successfully.
