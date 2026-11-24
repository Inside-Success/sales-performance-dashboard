# Call 2 timing pilot

The admin directory links to `/manager/call2-duration`. The manager allowlist protects the layout and the data reader. Reps and FAQ-only admins receive no tracker navigation or results. The page reads saved results. Filtering and viewing source links make no model requests.

## Reading a call

Call length spans the Zoom meeting. Where Zoom supplies only the complete participant report, use the first recorded join through the last departure. Cast present is the union of the verified prospect’s sessions, including reconnects and overlapping devices. A bot or rep can stay behind. Time from pullback to call end runs from the marked prospect line to the meeting end. The displayed timestamp uses the meeting clock.

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

The overview follows the rep filter and shows median verified cast attendance, the number of marked calls and median time from pullback to meeting end. Each call shows the saved cast quote, the rep’s next reply where attributable, and the official outcome. Existing marks and prior corrections remain available to the reader. The page has no feedback form or embedded media.

For reply context apply `migrations/20261124_call2_duration_replies.sql` and run `scripts/call2-duration/publish-replies.mjs` with the private pilot directory. The importer verifies the 20 results against the database and copies the immediately following rep turn for each eligible cue. Shared playback and other speakers are excluded.

Apply `migrations/20261124_call2_duration_sources.sql` for optional external links. Match the transcript to the official report and confirm its text against the saved call. Verify the occurrence’s Zoom recording actually plays before storing its URL. Publish verified fields keyed by occurrence and digest and check the rows after writing. Store document IDs and media links only in the private pilot database. Empty fields produce no link. Existing upstream sharing settings apply. The previous embedded playback endpoint and review action were retired. No audio deletion or new collection accompanies this change.

## Three-call selection check

The v4 worker labels shared-media cues and flags cast speech between shared-media cues. It asks the model to classify plausible decision points in context as engaged, unclear or pullback. The worker selects the earliest source-matched pullback, or none. The model receives role-labeled transcript text without the previous mark, reviewer judgment or official outcome. Use a separate receipt directory for a deliberately authorized new model run. Reusing that directory replays the saved decisions.

The first frozen v4 run was limited to three previously reviewed calls. It independently reproduced all three reference decisions, including a deferred evaluation, a later request to pause contract review, and a payment logistics exchange with no pullback. These are known cases. They establish regression coverage but do not estimate accuracy on unseen calls. The original pilot files are retained for comparison. To reconstruct the published cohort, overlay the three v4 result files on the original twenty by occurrence. The other seventeen use their original results. Automatic intake remains off.

## Remaining seventeen pilot calls

The same frozen v4 worker ran on the seventeen other existing occurrences. Seventeen final receipts completed without a continuation. Nine model marks matched v3. Eight changed. A transcript and recording-excerpt audit accepted five changed timestamps and identified an earlier supported cue on three. For those three, the database retains the raw v4 selection in `summary.signal` and the source-reviewed selection in `review.signal`. The dashboard uses the reviewed selection and its matching reply. The nine stable marks were not independently re-audited in this pass.

All twenty pilot rows now have v4 results. To reconstruct the raw result set, combine the three-call and seventeen-call v4 private receipt directories by occurrence. Apply the separate recorded review decisions to reproduce the displayed results. Automatic intake and the next cohort remain on hold.

## Candidate worker evaluation on the frozen pilot

The candidate uses GPT-5.4 to propose transcript cues, then independently judges the proposed IDs using the transcript without the first reader's reasons. Only confirmed cues can start the clock. The worker checks the earliest confirmed quote against its source cue. Each paid stage has its own receipt and can be replayed locally. The confirmation adds a second request only for calls with a proposed signal. No previous marks, expected timestamps, outcomes, or reviewer notes enter either model request.

The bounded evaluation covered the three previously late calls, all seven separately reviewed positive controls, and the one reviewed no-pullback call. The final worker reproduced all three target timestamps, five of seven positive controls and the real no-pullback result. Two additional synthetic conversations about active evaluation and an agreed purchase also returned no pullback. Two previously correct marks slipped later: 1:20 to 6:17 on an early attempt to shorten the conversation and 66:29 to 73:23 on a request to defer payment. The first reader nominated the reviewed timestamps on both calls; the second reader rejected them. An earlier experiment using only the transcript preceding a provisional mark also regressed on known examples.

These are known pilot cases. Keep this candidate out of production. The live dashboard retains its reviewed v4 pilot, and automatic processing and the next cohort stay on hold.
