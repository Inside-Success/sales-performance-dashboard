# Magic Mike final-name and outcome contract repair — October 12, 2026

## Authorized scope

Fix recurring blank prospect-name handoff and repeated outcome display. Preserve item identity, names manually verified against their source, speaker aliases, classification, coaching/model requests, scoring, compliance, recovery and existing source documents. No new AI node or provider request. Deferred reality/compliance policy and separate rep/prospect-role cases remain outside this change.

## Root causes and changes

The official reader retained the correct original label but returned an empty normalized field when the name was unchanged. Edit Fields then fell back to an empty Airtable name. Clean Response now emits the final selected name in both resolved_client_name and the compatibility normalized_client_name field. Edit Fields preserves a nonempty manual/verified source name; otherwise it consumes that final name, then safe original/source fallbacks. Resolver decisions and transcript text are unchanged.

Official and manual dashboard normalization accept producer-supplied resolved/original labels when the legacy client_name is blank. Official upserts preserve an existing name if an incoming value is null or whitespace. Reports without any usable input label remain deliverable; no invented person is inserted.

Flat report rendering previously compared an outcome-plus-heading paragraph with the short outcome before separating semantic headings. The shared parser now separates Observed concerns and Agreed next steps before numbered items and duplicate comparison, independent of blank-line spacing. Exact duplicate comparison still ignores evidence timestamps and whitespace; distinct closing explanations remain. Recent dashboard reports use the repaired parser; very old full-section layouts retain their previous parsing behavior. Structured reviewed reports retain their existing branch.

Generated official/manual documents retain their structured branches byte-for-byte in section output. Their flat outcome comparison uses the same semantic-boundary helper and retains outcome evidence. Official automatic Slack rendering uses the repaired shared section function; no synthetic Slack message was sent.

## Published n8n revision

- Official L8Nn7xncA9ZPDdWA: d6f3c9d6-cab1-465e-9d56-fd6fadaf6814; changes limited to Clean Response, Edit Fields, Code in JavaScript and Build PDF HTML.
- Manual BMRrGxHyXMcgO6j3: 8a220255-76df-4b24-a172-f47c5bf3af36; change limited to Build Google Doc.
- Both activeVersionId values match the saved revision. Every other node hash, all connections and all settings match the fresh rollback snapshot. Connection validators report zero errors and zero invalid connections, with the same six/four pre-existing warnings.

Builder: scripts/n8n/build-name-outcome-contract.py. The existing identity builder was updated so a later rebuild cannot restore the broken empty-field contract. Replay: scripts/n8n/verify-name-outcome-contract.mjs; reads private fixtures from stdin, makes no network/model/writes, and saves no transcript archive.

## Existing report repair

Exactly reports 7614, 7620 and 7715 had blank names. Read-only Drive inspection of each original transcript confirmed the retained label was Zoom user. A guarded atomic update restored that label and matching name fields in source_payload/search indexing. All non-name report fields, links, scores and coaching payload content were independently compared before/after and remained identical. Source Google Docs, Airtable records and prior Slack messages were not rewritten. This restores recorded labels, not newly inferred human identities; meeting titles remain available.

## Verification before dashboard release

- 110 coaching tests passed, including persistence normalization, manual-delivery regression and semantic paragraph variants.
- 24 existing identity tests passed.
- Three affected transcript fixtures passed 15 complete name-mapping assertions with missing/empty/whitespace source names and explicit verified names.
- 144 recent saved reports replayed through the candidate formatter without lost coaching sentences or changed source payloads; 472 official/manual document section renders passed, including structured-output equality.
- TypeScript, scoped ESLint and production webpack build passed. No dev server, new checkout or dependency installation.
- Paid AI testing spend: USD0.00. Ordinary hosting/database/n8n execution consumption is not included in that figure.

## Completed dashboard release and live readback

PR280 merged b4c3ebdcb2ee56fe01d9e6ef9135ea68954607e9. Production dpl_Ft7SuX2qMgdZZJrH4CjuQdpWFmLV is READY for that exact commit and the rose alias was explicitly assigned to it. Preview builds failed before compilation with the pre-existing Resource provisioning failed limitation; production and local builds succeeded. No environment/access settings were changed. The branch was rebased onto the independently completed October 12 FAQ knowledge release (PR278/279); its source changes were preserved. The combined build passed and 116 tests passed (110 coaching plus six current FAQ knowledge regressions).

Signed-in Chrome checked all seven identified outcome-repeat examples: 7634, 7640, 7661, 7667, 7680, 7705, 7714. Each shows Call outcome once, followed by the existing improvement/strength/concern/next-step sections. Reports 7614/7620/7715 show the restored original Zoom user label, their full meeting titles and all source links. No human name was fabricated. Existing very-old full-section report2240 retains Verdict, Biggest Strength, What I'd Polish, Coaching Tip, Rudy's Note, What Went Well, What To Improve, Why No Close and Objections Surfaced. Bryce self-report716dd1bd1e2944e6acf8660cf70c853e still loads its structured report. Manager scorecard and FAQ usage access load successfully; FAQ knowledge date remains October12. Explanation expansion, evidence-time selection and actual source transcript loading at3:23 were verified on7714.

Live workflow readback again matches the five intended nodes exactly; all remaining node hashes/connections/settings are preserved. Recovery worker and recent intake remain successful. Latest official execution1076303 started11:11UTC, before this repair, so no fresh natural call under the precise new revision is claimed. Saved real-data replay and published-code checks passed; the next natural call is an observation to capture in a later authorized health scan, not an extra test submission or regeneration.

Private rollback/metadata receipts total approximately42KB, plus a206KB visual proof image. No transcript archive or duplicate checkout/dependency tree was created. Local existing webpack cache grew approximately46MB during validation. AI testing spend remains USD0.00; no additional per-call model cost is introduced.

## Scoped rollback

Private directory .magic-mike-name-outcome-2026-10-12 holds compressed selected-node parameters, node hashes/settings/connections, and only the three repaired name/search metadata values. Do not restore entire workflows or overwrite intervening edits. Compare current versions, restore only the named node fields and publish. Revert the scoped dashboard commit or restore the previous rose alias deployment dpl_55D63Ky99noGYMnckyH7wTmCVjWN. For the three metadata rows, restore only the captured name/search fields after verifying source IDs/current expected values. Do not regenerate reports, scores, source documents or messages.
