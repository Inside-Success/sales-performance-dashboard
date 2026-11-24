# Call 2 timing pilot

The admin directory links to `/manager/call2-duration`. The manager allowlist protects the layout, the data readers and the correction action. Reps and FAQ-only admins receive no tracker navigation or results. The page reads saved results. Filtering, opening a recording and reviewing a mark make no model requests.

## Reading a call

Call length spans the Zoom meeting. Where Zoom supplies only the complete participant report, use the first recorded join through the last departure. Cast present is the union of the verified prospect’s sessions, including reconnects and overlapping devices. A bot or rep can stay behind. After first signal runs from the marked prospect line to the meeting end. The displayed timestamp uses the meeting clock. Playback uses the paired video’s clock and starts three seconds before the line. Managers can keep or change the line, or record that they heard no pullback. The original selection survives corrections. Concurrent stale edits are rejected.

## Reproducing a bounded review

1. Read processed Zoom Closer Calls labelled Call 2+. Verify actual attendance and an explicit second-call exchange or a matching prior attended Call 1. The history check requires a complete exact-identity result and a single distinct prior occurrence. Review uncertain identities manually. Exclude later follow-ups and no-shows.
2. Read the occurrence, its paginated participant report, the exact Airtable transcript file and a playable MP4 with matching bounds. Use the owning workspace's Zoom credential. The reference Code node in `scripts/call2-duration/zoom-read.js` performs only Zoom GETs after authentication. Its temporary launcher accepts a meeting UUID and transcript file ID. Keep participant data, recordings, transcripts and receipts private.
3. Assemble the reviewed input through `normalize.py`. Verify the cast speaker and participant identity separately. Partial recordings, split files and badly aligned clocks require source review before spending. Read the observed outcome from the existing official report matched by exact source record and transcript link. Include it as `officialOutcome`. The model only selects the cue. The worker copies the words and computes the time.
4. Run `python3 scripts/call2-duration/review.py PRIVATE_INPUT.json PRIVATE_STATE_DIR` with only `CALL2_DURATION_OPENAI_API_KEY` for this project. Keep the private ledger on persistent local storage. It claims each occurrence before dispatch, retains usage and reuses terminal receipts. Resolve uncertain requests before retrying. A confirmed output-token-limit finish allows one bounded continuation. Never reset the ledger to retry a timeout. This is a bounded pilot worker, not a scheduled production queue.
5. Apply `migrations/20261124_call2_duration.sql` in the intended dashboard database. Run `node scripts/call2-duration/publish.mjs PRIVATE_RESULT_FILES...` with that database connection. It validates and inserts the selected cohort in a transaction, then checks the saved fields. Duplicate imports preserve human corrections. The pilot adds one table and does not write to coaching, Zoom, Airtable or sales records.
6. Run `python3 -m unittest discover -s scripts/call2-duration` and the tracker and admin access/navigation Vitest suites. Test the signed-in target, the anonymous redirect, a Zoom cue and review saving on the appropriate pilot environment.

No automatic intake or backfill is enabled. User review of the earliest reasonable moment is the decision point before widening coverage. To withdraw the pilot, revert the tracker page and directory link; retain the isolated rows and private receipts for reconciliation.

## November 24 pilot evidence

Read 100 recent processed Call 2+ candidates and their same-identity call history. Selected 20 attended second calls with matched source audio transcripts, aligned video files, verified cast sessions and source-matched official outcomes. Both Zoom accounts are represented. This is a curated pilot, so its completion rate cannot establish company-wide coverage.

The final run marked 18 calls and returned no pullback on two. A development pass incorrectly marked buying logistics and ordinary questions. The final worker uses a constrained list of cast cues and a stronger model, GPT-5.4 mini. Three final requests reached the initial output limit; each resumed once after a terminal receipt. All 20 finished. Usage at published token rates was about $0.34 for the final pass and $0.47 including model comparison and retries. Review and replay use saved results. The earliest cue remains a judgment, particularly where a cast statement crosses several transcript lines. The pilot has no target signal rate.

The isolated Zoom readers and candidate lookup were switched off after collection. The dashboard does not require a provider key, Zoom token or workflow to render. The private pilot ledger holds the usage and request receipts. No transcripts or participant lists are checked into Git.
