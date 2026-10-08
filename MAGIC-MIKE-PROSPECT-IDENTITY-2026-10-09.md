# Magic Mike prospect identity — October 9, 2026

## Status and scope

Authorized production release for incorrect prospect names in Zoom intake and official coaching. Both workflows are active. This release resolves names from transcript evidence, retains actual speaker labels for attendance, and separates person names from show names. It adds no AI node or provider request.

The existing intake classifier remains Claude Sonnet 4.6. Coaching, compliance, scoring, manual submissions, FAQ, sales synchronization, access configuration and dashboard rendering were not edited. Existing historical reports were not regenerated or backfilled. Deferred reality/compliance policy questions remain pending.

## Name rules

- Prefer a real prospect name supported by their own introduction or the rep directly addressing them. A full name must also exist in the transcript, appointment title or participant labels.
- A borrowed Zoom account can be corrected when the appointment title and direct address agree and there is exactly one external speaker. Contradictory surnames and multiple-attendee ambiguity remain conservative.
- Keep manually verified names on the exact matched source record. Never use an unrelated search result as an override.
- If evidence is insufficient, retain the original external label, including device labels. Use `Prospect` only when no usable external label exists. Bots and known internal staff do not establish prospect attendance.
- Retain original speaker aliases alongside the canonical name, rather than rewriting the raw transcript. The attendance guard only accepts aliases actually present in that transcript and excludes reps/bots.
- Do not bind one participant's Zoom email to another participant. Clear or replace that Zoom-derived email only when changing the selected attendee.
- A person name is not a show name. New show names are accepted when explicitly supported by the conversation; no fixed reality-title list is required.

## Published workflows

| Workflow | Previous published version | Final published version | Changed nodes |
| --- | --- | --- | --- |
| Zoom intake `qMQYNQtQbRZWjtG2` | `24bb8677-7e85-48a9-8cef-bf28db5ddcd2` | `ca2a7fa5-c419-48b5-8559-4dcb98c460b1` | Fetch Zoom Context; Sales Call Structured Parser; Classify Sales Call; Apply AI Sales Call Classification; Build Transcript Document; Prepare Airtable Write |
| Official coaching `L8Nn7xncA9ZPDdWA` | `ad801f19-ba0c-4f1d-9311-0282b97afa61` | `8b69409e-7a8d-4a8c-9b9e-92140077586c` | Clean Response; Edit Fields; MM Parse Classifier |

Readback confirms the exact intended node parameters are published, both workflows remain active, every other node hash is unchanged, and all connection/settings hashes are unchanged. n8n partial updates publish edits to active workflows automatically. Downstream compatibility was released before intake.

The optional classifier fields are `name_confidence`, `client_speaker_label` and `name_evidence`. Existing required classification fields remain identical. New intake-created transcript documents carry `Client Identity JSON`; legacy documents remain readable without it. `Client Speaker Aliases` is an internal item field, not a new Airtable schema column. Automation keys, recording UUIDs, duplicate checks and routing identifiers are preserved.

## Verification

- 29 meaningful synthetic/integration assertions passed using the actual modified n8n Code node bodies and Edit Fields expression. Coverage includes ordinary names, device names, borrowed accounts, manual corrections, unrelated records/emails, multiple attendees, missing/bot-only transcripts, no-shows, absent reps, item pairing, optional parser fields and duplicate identifiers.
- 32 saved real Call 2 reports were replayed through intake resolution, document construction, official cleaning/attendance and Airtable write preparation without network side effects or model calls. All 32 still passed the attendance gate; raw transcripts and routing/control identifiers stayed identical. Fourteen names improved: thirteen device labels and one surname-only human label. Zero became `Prospect`. A reality-show control retained its correct identity and show.
- These replays validate deterministic name/attendance behavior; they do not regenerate coaching, rerun paid models, send Slack messages or alter historical reports.
- Intake full validation passed with zero errors and the same five pre-existing warnings. Official validation retained the same eight static return-shape findings and seven warnings on existing shared-template nodes, with zero invalid connections. Modified Code node bodies passed execution tests; unrelated validator findings were not edited.
- Naturally arriving intake executions 1029443/1029457/1029497/1029505/1029562 completed classification, transcript document creation and Airtable updates. Downstream executions 1029465/1029521/1029596 accepted the added identity metadata and kept Call 1/no-show routing. Training execution 1029510 remained excluded as training. These are live observations, not forced test submissions.
- Signed-in Chrome opened existing report 7403 and showed normal coaching sections, source links, transcript evidence controls and Ask Magic Mike. No dashboard application code changed.
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
