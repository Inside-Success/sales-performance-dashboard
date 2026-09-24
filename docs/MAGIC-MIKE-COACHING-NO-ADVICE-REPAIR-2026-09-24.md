# Magic Mike coaching: empty improvement repair — September 24, 2026

## Scope and decision

This release addresses scored Call 2 reports whose visible improvement section said either “No additional coaching recommendation met the evidence threshold for this report” or “Not applicable to this call.” The sample was 20 recent scored official reports: four had a concrete published recommendation; 16 had one of those empty messages. The factual audit had kept an optional suggestion in 12 of those 16; it had rejected all suggestions in the other four. This is a bounded sample, not a prevalence estimate for all historical calls.

The reader now sees an audited material recommendation when one survives. Otherwise, one audited optional suggestion may appear with an **Optional polish** label. If nothing survives, the report says: “No specific sales-execution improvement was supported by this call.” That sentence is scoped to sales execution; it does not clear separate compliance findings or imply a perfect call.

## Production change

- Existing reliability subworkflow `FShnTde2OGhIUZE4`: updated the live `Render Reviewed Report` and `Render Repaired Audit` Code nodes.
- Existing official workflow `L8Nn7xncA9ZPDdWA`: updated the live `Performance Agent` completeness fallback.
- Existing self-submitted workflow `BMRrGxHyXMcgO6j3`: updated `MM Manual Render Audited Coaching` and `MM Manual Finalize Coaching`.
- The renderer still excludes unsafe payment holds, smaller commitments and written delivery guarantees. Factual audit rejections remain authoritative. The existing safety screen remains in place. There is no new AI node or additional model call, no scoring change, and no compliance prompt or context-pack change.
- The finalizers replace a literal “Not applicable to this call.” only in the two improvement fields when a safety repair has emptied them. Other fields retain their existing completeness behavior.

Private exact prechange node and topology backups are under `../.magic-mike-coaching-no-fallback-2026-09-24/` on the operator machine. That folder also contains the reviewed 16-report correction plan; it is intentionally outside Git because it contains client report content. Restore a node only from its matching backup after reviewing intervening production changes.

## Historical correction

The 16 affected official reports were replayed from their saved writer output, factual audit and actual cleaned transcript, without another model call. Their “What to improve” content was corrected in the dashboard database, Airtable scorecards and source Google Docs. Twelve show one labeled optional suggestion; four show the scoped no-specific-improvement sentence. No Slack message, email or duplicate rep notification was sent. The Google Doc replacement used revision guards and changed one intended occurrence per report. The dashboard database update required the exact old fields and all 16 identities. Airtable used an exact old-value check for all 16 before its update and was independently read back. The temporary Airtable correction workflow was deactivated and deleted.

## Verification and limits

- `structured-coaching.test.cjs`: 17 passing cases, including material preference, audited optional fallback, policy exclusions, and empty advice.
- All five edited n8n Code nodes passed JavaScript syntax checks and matched readback. Node names and connections for all three workflows matched the saved baseline after the edit. The reliability workflow validated with 0 errors and 0 warnings; the manual workflow retained 0 errors and 4 pre-existing unreachable-node warnings. The official workflow retained its pre-existing 8 Code-node analyzer errors and 7 warnings, with 0 invalid connections and no increase from baseline.
- All 16 source Docs read back the exact intended improvement section. All 16 database records and all 16 Airtable scorecards read back the intended fields. Recent official scored execution `834917` succeeded after publication with a material improvement; reliability executions after publication also succeeded.
- No new natural call without a material recommendation, and no new self-submitted call, had completed during this verification window. Their no-material path was tested by offline replay of the 16 real reports and local unit tests. The user’s authenticated Chrome report tab could not be automated because an unrelated extension UI blocked control, so this run did not visually inspect the live page. Database, Airtable, Docs and workflow readbacks establish the data and runtime state; the browser rendering remains an explicit verification gap.

## Follow-up

Observe the next naturally occurring scored report with no material advice and the next self-submitted scored report. Confirm their published improvement field and safety behavior without sending duplicate notifications or rerunning paid models just for inspection. Review the ratio over a wider sample before claiming a system-wide rate or promising that an AI reviewer can never miss a useful improvement.
