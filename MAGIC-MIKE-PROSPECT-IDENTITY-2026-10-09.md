# Magic Mike prospect identity — October 9, 2026

## Status and scope

Authorized production release for incorrect prospect names in Zoom intake and official coaching. Both workflows are active. This release resolves names from transcript evidence, retains actual speaker labels for attendance, and separates person names from show names. It adds no AI node or provider request.

The existing intake classifier remains Claude Sonnet 4.6. Coaching, compliance, scoring, manual submissions, FAQ, sales synchronization, access configuration and dashboard rendering were not edited. Existing historical reports were not regenerated or backfilled. Deferred reality/compliance policy questions remain pending.

## Name rules

- Prefer a real prospect name supported by their own introduction or the rep directly addressing them. A full name must also exist in the transcript, appointment title or participant labels.
- If the single external human transcript speaker exactly matches the appointment title and the selected Zoom account label never speaks, use that corroborated human name. This handles an assistant account being selected instead of the actual prospect. Optional earlier fallback metadata cannot suppress this stronger resolution.
- A borrowed Zoom account can be corrected when the appointment title and direct address agree and there is exactly one external speaker. Contradictory surnames and multiple-attendee ambiguity remain conservative.
- Keep manually verified names on the exact matched source record. Never use an unrelated search result as an override.
- If evidence is insufficient, retain the original external label, including device labels. Use `Prospect` only when no usable external label exists. Bots and known internal staff do not establish prospect attendance.
- Retain original speaker aliases alongside the canonical name, rather than rewriting the raw transcript. The attendance guard only accepts aliases actually present in that transcript and excludes reps/bots.
- Do not bind one participant's Zoom email to another participant. Clear or replace that Zoom-derived email only when changing the selected attendee.
- A person name is not a show name. New show names are accepted when explicitly supported by the conversation; no fixed reality-title list is required.

## Published workflows

| Workflow | Previous published version | Final published version | Changed nodes |
| --- | --- | --- | --- |
| Zoom intake `qMQYNQtQbRZWjtG2` | `24bb8677-7e85-48a9-8cef-bf28db5ddcd2` | `b467b896-31da-4ca8-86e0-cd60615e3498` | Fetch Zoom Context; Sales Call Structured Parser; Classify Sales Call; Apply AI Sales Call Classification; Build Transcript Document; Prepare Airtable Write |
| Official coaching `L8Nn7xncA9ZPDdWA` | `ad801f19-ba0c-4f1d-9311-0282b97afa61` | `915e9f0b-e519-4b98-808f-134e279e9f90` | Clean Response; Edit Fields; MM Parse Classifier |

Readback confirms the exact intended node parameters are published, both workflows remain active, every other node hash is unchanged, and all connection/settings hashes are unchanged. n8n partial updates publish edits to active workflows automatically. Downstream compatibility was released before intake.

The optional classifier fields are `name_confidence`, `client_speaker_label` and `name_evidence`. Existing required classification fields remain identical. New intake-created transcript documents carry `Client Identity JSON`; legacy documents remain readable without it. `Client Speaker Aliases` is an internal item field, not a new Airtable schema column. Automation keys, recording UUIDs, duplicate checks and routing identifiers are preserved.

## Verification

- 31 meaningful synthetic/integration assertions passed using the actual modified n8n Code node bodies and Edit Fields expression. Coverage includes ordinary names, device names, borrowed accounts, manual corrections, unrelated records/emails, multiple attendees, missing/bot-only transcripts, no-shows, absent reps, item pairing, optional parser fields and duplicate identifiers.
- 32 saved real Call 2 reports were replayed through intake resolution, document construction, official cleaning/attendance and Airtable write preparation without network side effects or model calls. All 32 still passed the attendance gate; raw transcripts and routing/control identifiers stayed identical. Fourteen names improved: thirteen device labels and one surname-only human label. Zero became `Prospect`. A reality-show control retained its correct identity and show.
- These replays validate deterministic name/attendance behavior; they do not regenerate coaching, rerun paid models, send Slack messages or alter historical reports.
- Intake full validation passed with zero errors and the same five pre-existing warnings. Official validation retained the same eight static return-shape findings and seven warnings on existing shared-template nodes, with zero invalid connections. Modified Code node bodies passed execution tests; unrelated validator findings were not edited.
- Naturally arriving intake executions 1029443/1029457/1029497/1029505/1029562 completed classification, transcript document creation and Airtable updates. Downstream executions 1029465/1029521/1029596 accepted the added identity metadata and kept Call 1/no-show routing. Training execution 1029510 remained excluded as training. These are live observations, not forced test submissions.
- Signed-in Chrome opened existing report 7403 and showed normal coaching sections, source links, transcript evidence controls and Ask Magic Mike. No dashboard application code changed.
- New natural Call 2 intake executions 1029658/1029688 created documents and updated their source records. Official executions 1029680/1029702/1029733 passed the attendance gate and reached coaching processing under the preceding release revision. Two newly arriving source documents also passed side-effect-free final-code replays; the assistant-account case now resolves to the actual named human speaker. No historical source document was edited.
- A newly arriving Call 2 completing end to end under the final release has not yet been observed at this checkpoint. Saved Call 2 replay success must not be described as that natural production observation.

New testing AI spend: **USD 0.00**. Normal incoming calls continue their existing paid processing. No new AI stage is added; optional identity evidence can add a small amount of tokens to the existing classifier request/response. No per-call cost reduction claim is made.

## Source and reproduction

- `scripts/n8n/prospect-identity.mjs`: pure resolver.
- `scripts/n8n/build-prospect-identity.py`: build scoped parameter replacements from a private baseline; no network or credentials.
- `scripts/n8n/verify-prospect-identity.mjs`: synthetic and actual-node tests.
- `scripts/n8n/replay-prospect-identity.mjs`: stdin fixture replay; no model calls or writes.

Run the dependency-free suite from the repository checkout:

```sh
node scripts/n8n/verify-prospect-identity.mjs PRIVATE_BASELINE.json.gz PRIVATE_PATCHES.json.gz
```

Private baselines, patches and real-data receipts remain outside Git in the workspace's `.magic-mike-prospect-identity-2026-10-09` folder. They contain no saved full-transcript archive. No new checkout, node_modules copy, build cache or large workflow archive was created.

## Rollback and future boundaries

Previous n8n versions remain available. The small compressed baseline preserves original parameters for the selected nodes plus invariant hashes. To roll back, first compare the current graph with the release receipt, then restore only these selected node parameters from the baseline; preserve any later independent production edits. Keep intake and official speaker-handling changes coordinated. Do not roll back an entire workflow over another person's intervening changes.

Git records the source implementation and release note. Retain private rollback evidence locally; never commit transcripts, workflow credential references, webhook headers or credentials. This release cannot recover a real name that the available conversation/title/labels never establish. Ambiguous cases intentionally retain the existing external display label.

## GitHub and deployment receipt

Source/docs PR271 merged `c3a8628e9b6ca766e376d6078848e4156fe175fb`. Its preview dpl_652N9QRAqqMA2Pn2Xv3kJdpEgwXb failed during resource provisioning before an application build. Production documentation deployment dpl_6GkksdDcyQhgrVUrCiPH3Sip785i reached READY. This release changes no application code; the original healthy rose deployment was confirmed during the preview failure. Vercel connector access returned403; the scoped CLI provided deployment receipts. No access, integration or environment settings were changed.

The final assistant-account refinement is published in n8n and recorded separately in Git so both revisions remain reviewable. Private rollback/receipts occupy roughly110KB; source/test/docs add roughly40KB before Git overhead.

## Final verification checkpoint

PR272 merged `257d7fc3fe456d11ad5aaba32df0dd8d53860df8`; production deployment dpl_4nc8oCp6kZzVqU23RXpQX9338GTs reached READY. Its preview again failed during resource provisioning before a build. No application source was changed or environment/access setting edited.

Natural official executions1029680/1029702/1029733 subsequently completed with four delivered receipts. Independent database reads found exactly one matching row per generated report at IDs7514–7517. Signed-in report7517 displayed the correct name, coaching, score and source links; explanation expansion and evidence at36:59 opened and loaded the actual cited transcript passage. These runs began under the earlier revision of this release, before the final assistant-account refinement. One in-flight report7515 retained that earlier fallback label; existing outputs remain unchanged. The final rule was independently verified against its real source document and the synthetic retained-metadata case. A final-revision natural Call 2 completion is still not claimed.

Private compressed baselines/patches and metadata-only receipts total108628bytes at this checkpoint (about106KiB). No full transcript archive, new checkout or dependency/build cache was created. New AI testing spend remains USD0.00.

## Follow-up: assistant labels, nickname corroboration and compound titles

Authorized targeted refinement published October 9 at approximately18:56UTC. Intake version50137ec7-3c29-46ac-9986-4f0645fc7477 and official versioncb8fdef4-e8f3-4ab5-8700-e11b927bffb5 are active. Only Apply AI Sales Call Classification, Build Transcript Document and Clean Response changed, replacing the shared deterministic resolver prefix. Every other node hash, all connections and all workflow settings match the fresh pre-release baseline. The earlier crash-recovery changes remain intact.

Assistant/role labels, Zoom meeting descriptions and compound meeting titles are not accepted as canonical person names. They remain usable raw fallbacks when evidence is insufficient. A title of the form prospect x known rep [Inside Success TV] is separated only when the other named party is a known rep; multiple unknown parties remain ambiguous. Existing titleClientName metadata passes the same validation. The actual sole human speaker can corroborate a nickname/full-name pair only when the surname and remaining name parts agree. Conflicting surnames remain protected. Manual verified names, original speaker aliases and email binding safeguards remain intact. No AI stage, prompt/model, schema, attendance rule, scoring rubric, compliance policy, trigger, delivery path or app configuration changed.

Verification:36 synthetic/actual-node assertions passed, including new regressions for assistant labels, full-name nickname disagreement, compound titles, conflicting surnames, multiple attendees and manual overrides.62 saved recent transcript fixtures passed intake, document, official reader, attendance and write-preparation replays with original transcripts and routing/deduplication identifiers retained. Zero fixtures fell back to Prospect. The two confirmed incidents7546/7547 resolve to the supported human identities; the official reader also corrects their unchanged source metadata during replay. These were side-effect-free replays, not regeneration or historical repairs. Two previously identified role-assignment cases7536/7538 were excluded from the scored-call replay set and remain separately unresolved; this release does not claim to correct rep/prospect roles.

Changed-node configuration validation and complete connection validation passed. Full live validation retains exactly the pre-release findings: intake zeroerrors/fivewarnings; official eight static return-shape findings in unchanged nodes/sevenwarnings, with no invalid connections. Modified node syntax and execution checks passed. No paid model calls or production test submissions were made. Testing AI spend USD0.00.

Private scoped rollback baseline, patches and metadata receipts occupy approximately90KB in .magic-mike-name-refinement-2026-10-09; no transcript archive, new checkout, dependencies or build cache. Builder scripts/n8n/build-prospect-name-refinement.py fails closed unless the existing resolver boundary matches exactly. Rollback requires comparing current nodes/versions and restoring only these selected node parameters, preserving intervening edits and crash recovery. Existing reports/source Docs were not rewritten. A fresh naturally arriving Call2 completion under this precise revision must be recorded separately before being claimed.

### Final source and live verification receipt

PR275 merged9e674e6c861a4b684388f1d1de3273a67884f0f1. The Git main deployment dpl_5uw8h3TiTsKPXvvmxEKDyGn8no6M reached READY for that exact commit. Preview dpl_FsQa3WbcyjkDx3ZAXr1WeBujZxLd failed resource provisioning, consistent with earlier previews; production release and the independently deployed rose dashboard remained available. No application/env/access edits or rose alias promotion occurred.

Natural intake1047030 succeeded under published version50137ec7-3c29-46ac-9986-4f0645fc7477. Official1047036 succeeded undercb8fdef4-e8f3-4ab5-8700-e11b927bffb5 and correctly routed that Call1 to call_1_skipped. Intake1047033/1047040/1047046/1047048 also succeeded. Signed-in Chrome report7573 remained usable with score, grouped coaching, source links and evidence controls visible. No fresh natural Call2 completion under this exact revision is claimed at this checkpoint.

Final full selected-node equality checks passed after replacing only jsCode in expected baseline nodes; all unaffected parameters and node properties match. Private rollback/patches/metadata receipts total90758bytes at this checkpoint, about89KiB. No new model requests, historical report rewrites or transcript archive.
