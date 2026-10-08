# Magic Mike shared-drive folder repair — 7 October 2026

## Authorized scope and result

Repair the official coaching workflow's shared-drive folder verification and recover the already-generated Michael report that stopped during document delivery. Preserve historical folders, report content, existing workflows and all specialist/deferred work.

The repair is live in official workflow `L8Nn7xncA9ZPDdWA`. Its published version is `ad801f19-ba0c-4f1d-9311-0282b97afa61`, published at 11:24:27 UTC on 7 October. The earlier version was `8ed5096b-4edd-46f9-8e25-3a37cc46435d`.

Exactly two node parameter fields changed:

1. **Verify Drive Folder — URL:** add `supportsAllDrives=true` to Google Drive `files.get`, preserving the credential, HTTP method, metadata fields and existing error output.
2. **MM Verified Folder Missing — conditions:** require explicit `__mmFailure.confirmedMissing === true` as well as HTTP 404 before taking the replacement-folder branch. Current errors do not supply that confirmation, so an unresolved 404 follows the existing bounded error/review path. A 404 alone cannot distinguish deleted from inaccessible files.

All other official nodes, connections and settings were compared and remained identical. Folder creation for a rep with no mapping remains available through the existing separate branch. No historical folder was moved, consolidated, renamed or deleted; no folder mapping was rewritten by this repair.

## Cause and direct tests

The report parent and rep folders live in a company shared drive. Google returned a false 404 for existing folders when the verification omitted shared-drive support. The former 404 branch then created a replacement folder unnecessarily.

Isolated QA used the **same Google Drive credential stored in the official workflow**, with GET-only calls and no business notifications or AI:

- Parent folder and folders for Abigail, Elena and Christina returned the correct IDs, folder MIME type, `trashed: false` and `canAddChildren: true` with the corrected request.
- The original request still returned 404 for Abigail's accessible folder, confirming the cause independently of the connector account.
- A deliberately invalid file ID returned 404 and exercised the actual retry-policy/IF configuration. It reached the held-for-review branch and never the replacement branch.
- QA executions `1000397` and `1000530` succeeded. The isolated QA workflows validated with zero errors/warnings. Temporary helpers were deactivated after their single-purpose runs.

The full official validator reported the same eight pre-existing Code-node return-shape diagnostics and seven warnings before and after the repair; no new diagnostics, broken connections or references appeared. Those unrelated source fields were not changed. The modified configuration was validated and exercised separately in the clean QA workflow.

## Recovered delivery

- Original failed execution: `990913`.
- Source: `recokLK1hoh4f1ii0`; existing coaching record: `rec2nNGWg6VgnvWQR`.
- Delivery-only recovery execution: `1000451`, successful.
- Restored dashboard report: [7403](https://sales-performance-dashboard-rose.vercel.app/call/7403).
- One Google Doc was created in the existing mapped Abigail folder and populated from the saved coaching. The existing Airtable record received its document link; the dashboard returned a matching successful ingest receipt.
- Independent readback confirmed one dashboard row for the source/report, matching rep/client, original call metadata, transcript link and document ID. Company Drive readback confirmed document contents and the intended shared-drive parent.
- Signed-in Chrome verified report content, explanation expansion, transcript evidence controls and successful timestamp-to-transcript loading. Existing reports 7340 (Abigail) and 7402 (Elena) also opened normally; no browser errors were captured in the checked existing-report tab.
- No new coaching, classifier, scoring, safety or compliance model request was made. No Slack post/reply was repeated and no new Airtable coaching record or rep folder was created.
- The original recovery event, row 88, was marked resolved only after delivery verification. Its original error remains in the audit message along with the recovery execution/report IDs.

**Additional AI/API model cost: USD 0.00.** Existing n8n/hosting subscriptions are excluded; this is not a claim that infrastructure usage has no cost.

## Production boundaries and remaining observation

Manual coaching workflow `BMRrGxHyXMcgO6j3` and outage-recovery worker `Zx3S5B1gYHRrbv2F` remained active with identical nodes, connections, settings and published versions. Prompts, models, scoring, compliance policy, FAQ, authentication and dashboard application code were unchanged.

No naturally arriving official run after the repair publication had been observed at the immediate verification cutoff. The real saved-output recovery and multi-rep credential tests passed; a future ordinary call remains the final observational check. Do not describe the completed tests as a guarantee against every future quota/permission failure.

The original folder-create 403 did not retain Google's detailed cause. The credential can currently read/write the existing folder, and recovery successfully created its document there. No permission expansion was required. Existing same-name historical folders retain valid reports and are deliberately preserved.

Deferred reality/compliance policy, Sales Impact source investigation, rare unavailable Zoom transcripts and other specialist tasks remain separate. The earlier 18 recovered outage reports must not be replayed.

## Backup and rollback

Private backups, candidates and execution/readback evidence are in `.magic-mike-drive-repair-2026-10-07` at the general project root. These include the official, manual and recovery workflow bodies before the repair and the original failed execution. Do not commit raw workflows, credentials, source transcripts or private evidence.

If rollback is needed, first fetch the current published workflow and compare it with the verified post-repair snapshot. Restore only the changed URL and missing-folder conditions after assessing the known false-404 behavior; preserve any later edits. Do not restore an entire old workflow or replay the already-delivered report. The earlier configuration's automatic 404 replacement behavior is the documented defect, so rollback is not an automatic response to an unrelated failure.

This repository change records the external n8n release only. It requires no application deployment.

## GitHub receipt

Sanitized release evidence is pushed in [documentation PR 264](https://github.com/Inside-Success/sales-performance-dashboard/pull/264). This is a documentation-only PR; the n8n fix and recovered delivery above are already live. Application deployment is not part of this repair.
