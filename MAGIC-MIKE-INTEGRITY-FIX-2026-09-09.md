# Coaching text integrity and Zoom reconciliation — September 9, 2026 PKT

## Scope and causes

Preserve the approved new section names and layout pending leadership review. This release fixes text corruption inside coaching safety/repair processing and the separate Zoom reconciliation identity error. It adds no AI calls and changes no model, compliance rule, shared context, scoring policy, dashboard route, delivery destination or schedule.

Grouped timestamps with milliseconds were not protected by the old sentence regex. Sentence deduplication then joined numbered strengths into one paragraph, leaving fragments such as `550]`. The replacement scanner preserves text offsets, full citation groups and numbered item boundaries. Repair output retains original citations and cannot add its own. Exact duplicate prose is removed without discarding distinct citation coverage. These helpers are compiled into three official and three manual coaching nodes.

Intake execution 688766 failed when three source candidates produced a single empty Airtable search result with multiple paired inputs. Both reconciliation branches now join by the exact Automation Key and iterate every source candidate, rather than asking n8n to infer one source from ambiguous pairing. Missing/duplicate source keys, unexpected result keys and duplicate records fail closed. Existing processed-record completeness checks are preserved.

## Verification

- 10 focused Node tests pass: grouped citations, numbered paragraphs, lossless boundaries, repairs, duplicate evidence, collapsed/mixed/out-of-order search results and fail-closed ambiguity.
- 7 existing dashboard presentation tests pass.
- Actual n8n sandbox execution **689066** succeeds with **29 isolated cases**: saved official/manual coaching processing, 21 saved reports, the failed three-candidate intake identities, both intake branches, and generated Slack/Google Doc content. No provider purchase or business delivery is present in this fixture.
- The screenshot report renders three separate strengths; each appears once across Slack main/thread content, with clean evidence. Generated Google Doc content passes the same timestamp and duplicate checks. This verifies generated payloads, not a new Google Doc or Slack post.
- All three active workflow graphs read back byte-equal to candidate nodes. Connections and settings are unchanged. Connection validation reports zero invalid connections in all three graphs; generic warnings on existing IF branches/disconnected historical nodes are not treated as new defects.
- Natural intake execution **689059**, after publication, completed its ordinary transcript/document/Airtable path. Execution **689055** reused an existing transcript document and updated its row. These are webhook-path checks, not proof of the hourly reconciliation branch.
- At the 20:29 UTC checkpoint, no post-fix natural eligible Call 2 delivery or hourly reconciliation run has yet been observed. The next hourly reconciliation remains scheduled normally; it was not forced. Manual natural delivery also remains unobserved. Do not present saved-call replay or active-version readback as natural end-to-end proof.

## Publication and rollback

Active version readbacks:

- Official `L8Nn7xncA9ZPDdWA`: `9cbe9151-64fd-4878-ae88-a3f23ee19321`.
- Manual `BMRrGxHyXMcgO6j3`: `310279ec-08e8-41b3-a28d-cbe1351ac442`.
- Intake `qMQYNQtQbRZWjtG2`: `3f028598-cab7-4593-9fcf-f2be09af6238`.

Private baselines, candidate graphs, inverse operations and saved execution proof are in `.magic-mike-integrity-fix-2026-09-09/` beside the repository. The public builder accepts that private directory and has no network behavior. Before rollback, compare current versions and restore only the eight changed Code nodes using the inverse operations; do not overwrite concurrent edits or workflow static state.

The isolated verification workflow `zAkxAPEzRTyp9Dck` is inactive. The Codex 15-minute monitor stays paused. No historical report was regenerated, no existing Slack message or Google Doc was edited, and no test notification was sent. Existing delivered messages retain their original content.

GitHub Actions path filters were checked: these changes do not trigger the Ask Sales release suite. GitHub/Vercel deployment is checked separately from the n8n publication; application runtime code is unchanged.
