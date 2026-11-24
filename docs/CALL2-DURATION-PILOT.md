# Call 2 Cast Tracker pilot

The admin directory links to `/manager/call2-duration`. The manager allowlist protects the layout and the data reader. Reps and FAQ-only admins receive no tracker navigation or results. The page reads saved results. Filtering and viewing source links make no model requests.

## Reading a call

Call length spans the Zoom meeting. Where Zoom supplies only the complete participant report, use the first recorded join through the last departure. Rep time with cast after objection counts the seconds when both the verified rep and cast were present from the effective saved mark onward. Overlapping devices count once, reconnect gaps and time alone do not count. The timestamp uses the meeting clock. Calls without an objection show total call length only.

## Reproducing a bounded review

1. Read processed Zoom Closer Calls labelled Call 2+. Verify actual attendance and an explicit second-call exchange or a matching prior attended Call 1. The history check requires a complete exact-identity result and a single distinct prior occurrence. Review uncertain identities manually. Exclude later follow-ups and no-shows.
2. Read the occurrence, its paginated participant report, the exact Airtable transcript file and a playable MP4 with matching bounds. Use the owning workspace's Zoom credential. The reference Code node in `scripts/call2-duration/zoom-read.js` performs only Zoom GETs after authentication. Its temporary launcher accepts a meeting UUID and transcript file ID. Keep participant data, recordings, transcripts and receipts private.
3. Assemble the reviewed input through `normalize.py`. Verify the cast speaker and participant identity separately. Partial recordings, split files and badly aligned clocks require source review before spending. Read the observed outcome from the existing official report matched by exact source record and transcript link. Include it as `officialOutcome`. The model only selects the cue. The worker copies the words and computes the time.
4. Run `python3 scripts/call2-duration/review.py PRIVATE_INPUT.json PRIVATE_STATE_DIR` with only `CALL2_DURATION_OPENAI_API_KEY` for this project. Keep the private ledger on persistent local storage. It claims each occurrence before dispatch, retains usage and reuses terminal receipts. Resolve uncertain requests before retrying. A confirmed output-token-limit finish allows one bounded continuation. Never reset the ledger to retry a timeout. This is a bounded pilot worker, not a scheduled production queue.
5. Apply `migrations/20261124_call2_duration.sql` in the intended dashboard database. Run `node scripts/call2-duration/publish.mjs PRIVATE_RESULT_FILES...` with that database connection. It validates and inserts the selected cohort in a transaction, then checks the saved fields. Duplicate imports preserve human corrections. The initial pilot adds one review table and does not write to coaching, Zoom, Airtable or sales records.
6. Run `python3 -m unittest discover -s scripts/call2-duration` and the tracker and admin access/navigation Vitest suites. Test the signed-in target, the anonymous redirect, the source links and the rep filter.

No automatic intake or backfill is enabled. User review of the earliest reasonable moment is the decision point before widening coverage. To withdraw the pilot, revert the tracker page and directory link; retain the isolated rows and private receipts for reconciliation.

## November 24 pilot evidence

Read 100 recent processed Call 2+ candidates and their same-identity call history. Selected 20 attended second calls with matched source audio transcripts, aligned video files, verified cast sessions and source-matched official outcomes. Both Zoom accounts are represented. This is a curated pilot, so its completion rate cannot establish company-wide coverage.

The final run marked 18 calls and returned no pullback on two. A development pass incorrectly marked buying logistics and ordinary questions. The final worker uses a constrained list of cast cues and a stronger model, GPT-5.4 mini. Three final requests reached the initial output limit; each resumed once after a terminal receipt. All 20 finished. Usage at published token rates was about $0.34 for the final pass and $0.47 including model comparison and retries. Review and replay use saved results. The earliest cue remains a judgment, particularly where a cast statement crosses several transcript lines. The pilot has no target signal rate.

The isolated Zoom readers and candidate lookup were switched off after collection. The dashboard does not require a provider key, Zoom token or workflow to render. The private pilot ledger holds the usage and request receipts. No transcripts or participant lists are checked into Git.


## Admin view and source links

The overview follows the rep filter and shows median rep time with the cast after an objection and the number of marked calls. Each call shows the saved cast quote, the rep’s next reply where attributable, and the official outcome. Existing marks and prior corrections remain available to the reader. The page has no feedback form or embedded media.

For reply context apply `migrations/20261124_call2_duration_replies.sql` and run `scripts/call2-duration/publish-replies.mjs` with the private pilot directory. The importer verifies the 20 results against the database and copies the immediately following rep turn for each eligible cue. Shared playback and other speakers are excluded.

Apply `migrations/20261124_call2_duration_sources.sql` for optional external links. Match the transcript to the official report and confirm its text against the saved call. Verify the occurrence’s Zoom recording actually plays before storing its URL. Publish verified fields keyed by occurrence and digest and check the rows after writing. Store document IDs and media links only in the private pilot database. Empty fields produce no link. Existing upstream sharing settings apply. The previous embedded playback endpoint and review action were retired. No audio deletion or new collection accompanies this change.

## Three-call selection check

The v4 worker labels shared-media cues and flags cast speech between shared-media cues. It asks the model to classify plausible decision points in context as engaged, unclear or pullback. The worker selects the earliest source-matched pullback, or none. The model receives role-labeled transcript text without the previous mark, reviewer judgment or official outcome. Use a separate receipt directory for a deliberately authorized new model run. Reusing that directory replays the saved decisions.

The first frozen v4 run was limited to three previously reviewed calls. It independently reproduced all three reference decisions, including a deferred evaluation, a later request to pause contract review, and a payment logistics exchange with no pullback. These are known cases. They establish regression coverage but do not estimate accuracy on unseen calls. The original pilot files are retained for comparison. To reconstruct the published cohort, overlay the three v4 result files on the original twenty by occurrence. The other seventeen use their original results. Automatic intake remains off.

## Remaining seventeen pilot calls

The same frozen v4 worker ran on the seventeen other existing occurrences. Seventeen final receipts completed without a continuation. Nine model marks matched v3. Eight changed. A transcript and recording-excerpt audit accepted five changed timestamps and identified an earlier supported cue on three. For those three, the database retains the raw v4 selection in `summary.signal` and the source-reviewed selection in `review.signal`. The dashboard uses the reviewed selection and its matching reply. The nine stable marks were not independently re-audited in this pass.

All twenty pilot rows now have v4 results. To reconstruct the raw result set, combine the three-call and seventeen-call v4 private receipt directories by occurrence. Apply the separate recorded review decisions to reproduce the displayed results. Automatic intake and the next cohort remain on hold.

## Pilot reply excerpts

The card displays short replies in full. Longer turns show a verbatim preview of up to 180 characters and expand inline. A verified playback handoff followed by the recorded welcome ends the live quote, including when Zoom gives both speakers the same name. The full transcript remains available through the existing link. This display change reads the existing replies without modifying stored cues, timestamps, review decisions or sources. All 20 effective pilot cards were checked against the saved transcripts.

## Rep attendance correction

The same 20 meeting occurrences were matched to complete Zoom participant reports. Match the assigned rep and cast to their Zoom sessions, using a source-verified exact email alias for a different rep display name. Apply `migrations/20261125_call2_shared_presence.sql` and run `node scripts/call2-duration/publish-presence.mjs INPUTS REPORTS_JSON REP_EMAIL_ALIASES_JSON` to validate. Add `--publish` to save the disjoint shared intervals in the pilot table. The timestamps are seconds from meeting start. A missing report is unverified. Do not substitute the meeting end. The active reviewed cue takes precedence over the raw model selection.

The 20-call check found 19 effective marks and one call without an objection. An independent second-by-second attendance check gave a median of 10:50 across the marked calls. Shared time includes video playback while both people are present. Use the cast’s words, the rep’s reply and outcome to judge the exchange. Elapsed time alone does not establish whether the rep gave up.

## Transcript review and frozen Luna comparison

Apply the rep filter above the overview. Each call can open a transcript drawer. The admin-only endpoint resolves the saved Google Doc for that occurrence, verifies the source meeting UUID and returns the transcript body on demand. Highlighting requires unique matching quote text and recording-relative time. The card continues to show meeting time.

The offline GPT-6 Luna comparison used the same 20 transcripts and v4 prompt, schema, reasoning effort and selection logic. Each payload reproduced the original request digest after restoring the baseline model name. Neither model saw marks or outcomes. Compare raw selections, before human overrides. Twelve cues matched. Of eight disagreements, transcript review favored 5.4 mini on five, Luna on two and neither on one. The 20 Luna receipts cost approximately $0.042 at standard token prices, versus $0.328 for the saved baseline receipts. This is one pass on a previously calibrated cohort. No model switch, mark publication or new intake accompanies this comparison.

## November 25 fresh comparison and pilot expansion

Twenty previously unscored, attended second calls from November 22–24 (UTC) were selected from recent processed Call 2+ records. Eligibility required second-call evidence, attributable speakers, complete aligned recording and transcript, rep and cast attendance, and an exact source-matched official outcome. This selects for usable evidence. The three models received identical role-labeled transcripts, cue identifiers, v4 prompt, output schema and medium reasoning effort. Per-call request hashes matched after removing model identity. Each model finished all 20 in one request per call.

A single reviewer checked the transcript context with model identities hidden. The primary score accepts the first objection exchange, including adjacent fragments of the same statement, or a correct finding of no objection. The stricter score uses one preferred cue per call. Costs use provider receipt tokens at standard prices.

| Model | First exchange | Preferred cue | Estimated cost for 20 |
| --- | ---: | ---: | ---: |
| GPT-6 Luna | 17 | 15 | $0.04534 |
| GPT-5.4 mini | 16 | 13 | $0.33988 |
| GPT-6.1 Terra | 14 | 10 | $0.40456 |

Luna's three misses were early. It selected exploration before a request to discuss a business expense, a signing-deadline question before a bank restriction, and confirmation of the deadline before a request to defer payment. Both calls without a supported objection were identified correctly by all three. The earlier calibration cohort favored 5.4 mini. The fresh result supports Luna for this pilot but the one-call margin is small.

The dashboard now contains 40 calls. The new 20 display Luna's raw selection, including its three misses. The original 20 retain their saved selections and reviews. All new rows include verified transcript documents, playable Zoom recordings, outcome and shared attendance intervals. The bounded worker now defaults to Luna. Use a separate private state directory for a new model comparison. Historical receipts remain under their original model. Automatic intake is off.

## Independent Luna check on the same fresh 20

A separate offline worker, `scripts/call2-duration/check_exchange.py`, read the same 20 transcripts with GPT-6 Luna at medium reasoning effort. It received speaker roles, cue IDs and transcript text. It had no access to the first marks, reviewed answers or outcomes. Its question asked for the earliest concrete obstacle to proceeding and an exact excerpt. The first pass was replayed from saved results. The comparison used the previous review as its fixed reference. These are known cases and a single run.

The rule accepted two no-objection decisions or two marks in one uninterrupted cast turn. A different turn, disagreement about whether an objection occurred, or an invalid quote required review. The simulation kept the first mark on accepted calls. It neither replaced marks nor submitted dashboard writes.

| First-pass result against reference | Accepted | Sent to review |
| --- | ---: | ---: |
| Correct exchange or correct no-objection decision | 8 | 9 |
| Early mark | 1 | 2 |

Of the three early marks, the two checks disagreed on Susan and Lawrence. The second selection was also too early on both. Both checks agreed on Amalia's early exploration remark, overstating rep time by 26 minutes. Both correct first-pass no-objection calls would have gone to review. Two replies failed verbatim quote validation. One selected a different, unsupported cue and the other selected the correct cue but stitched its excerpt together. Neither request was retried.

The 20 new receipts used 328,080 input tokens, zero cached tokens and 8,025 output tokens. At standard rates the second check cost $0.0368205. Including the saved first pass, the two passes cost $0.082162 for the 20 calls. The second check remains an offline experiment. The 55% review rate and the largest shared error do not support enabling this gate for automatic tracking.

## Proposed timestamp reviewer experiment

The offline worker `scripts/call2-duration/audit_mark.py` tests a different second-stage job. Given the first Luna result and its source transcript, it audits the proposed cast turn against the preceding 20 and following five source cues. It asks what obstacle the rep could recognize at that point, tests the ordinary-conversation interpretation, and returns keep or hold with a source cue ID. It cannot pick a replacement timestamp. Calls without a proposed clock bypass the reviewer, so the experiment cannot discover missing objections. Neither the official outcome nor the frozen reference enters the request.

On the same 20 calls, one frozen run kept all 15 supported marks. The two correct no-objection decisions bypassed it. It held Lawrence's deadline confirmation but kept Susan's signing-window question and Amalia's show preference. Those two retained errors overstated time by 1:54 and 26:00 respectively. This would route 1 of 20 to review and let 2 of 3 known early marks through. The previous independent scan routed 11 of 20 and let 1 of 3 through. Neither protected against the largest error. These are reused cases and cannot estimate accuracy on future calls.

The 18 new API receipts contain 30,326 input tokens, zero cached tokens and 5,524 output tokens. At standard Luna rates the reviewer cost $0.0057946. With the measured first pass the cohort cost $0.0511361. No dashboard marks or intake settings changed. Keep this reviewer experimental.
