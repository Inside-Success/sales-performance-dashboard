# Training Clips pilot

The manager directory opens `/manager/training-clips`. The page reads one saved report. Its rep filter and media requests never invoke a model. The Google Sheet shows the same selection and links each Topic directly to the same open Magic Mike player. The timing cell retains the timestamped Zoom source. The inline video is a bounded MP4 so managers can play the exchange through its endpoint on mobile and desktop.

## Manual pilot

Use the previous seven complete New York dates. Enumerate source rows for those dates and account for them individually. Reconcile duplicate occurrences and confirm an attended second call using source history or explicit transcript evidence. Bind the exact VTT to an MP4 from the same Zoom occurrence with the same recording bounds. Hold ambiguous recordings or missing transcripts before model spend. The neighboring tracker’s result, coaching judgment and sales outcome are unnecessary.

The prompt in `scripts/training-clips/review-prompt.txt` reproduces the review block from the [product prompt](https://github.com/Inside-Success/magic-mike-sales-ai-coach/blob/main/rudy-call-2-training-picks/prompts/review-call.md). Run `review.py` against private normalized input with the dedicated project key. Pass an existing private receipt directory. Preserve exclusive claims and provider receipts across retries. Each response must bind to labeled source cues. Compare models on the same transcript and response schema. Store no keys, transcripts, recordings, individual picks or receipts in Git.

Render selected exchanges from the opening cue start through the closing cue end. Check the source media identity, the presence of both video and audio, and the output duration. Use the recording file start plus the cue offset for the Sheet’s Zoom startTime in epoch milliseconds. Present whole-second boundaries that include the full exchange. Keep stable identifiers for each occurrence and boundary pair. Write media chunks of 262144 bytes and publish the dated selection in a single transaction. Populate the companion Sheet from that selection, retaining all reviewed decisions in its master tab. Verify both views against that same selection and rerun publication without paid requests.

The database schema is in `migrations/20261125_training_clips.sql`. Both the page and media route check the management policy. Private media supports HTTP byte ranges and uses private, no-store responses. There is no scheduled intake or publishing workflow. Rudy's signed-in playback and usefulness check precedes any scheduling decision.

The manual command is `python3 scripts/training-clips/run-review.py INPUTS PRIVATE_STATE --model gpt-6-luna`. Repeat with `gpt-6.1-terra` for a paired comparison. Configure `TRAINING_CLIPS_OPENAI_API_KEY` in the runner environment. Inputs contain the verified call, title and matched video manifest. Publication is a separate operation, so reloading the UI or repairing Sheet formatting cannot trigger another model pass.

## November 25 report and comparison

The report covers November 18–24 inclusive in New York. The bounded source inventory had 520 Call 2+ rows. Confirmation used call history, direct second-call evidence or a unique match to Tyler’s independently reviewed sample. The model input contained the call, without reference decisions or other model outputs. Both models completed the same 193 verified transcripts at medium reasoning effort. The remaining source rows include later calls, unconfirmed call stage/attendance, and ambiguous recording or participant evidence. Treat coverage as verified sources only.

| Paired result | GPT-6 Luna | GPT-6.1 Terra |
| --- | ---: | ---: |
| Suggested candidates | 183 | 185 |
| Candidate/No clip match against 20 reference calls | 15 | 15 |
| Matched the 7 reference No clip decisions | 2 | 2 |
| Overlapped any part of the 13 reference clips | 9 | 9 |
| Intersection at least half of the union of the two time ranges | 6 | 6 |
| Median absolute opening-time difference on the 13 reference positives | 76 s | 49 s |
| Estimated inference cost, 193 calls | $0.523 | $4.810 |

Estimates use provider-reported tokens and the project’s standard per-million uncached/cached/output rates: Luna $0.10/$0.01/$0.50 and Terra $1.00/$0.05/$5.00. An earlier 38 requests per model exposed an ambiguous numeric cue schema and added approximately $1.014. The release schema uses labeled source cue IDs. The published report uses a human-curated shortlist of Luna candidates; the master Sheet retains the decisions for every verified call. Several endpoints were adjusted against the source. Use manager feedback to assess value; a valid cue and a plausible summary alone do not establish meeting usefulness.

For manual playback materialization use `render_clip.py SOURCE FIRST_CUE LAST_CUE PRIVATE_MEDIA`. For publication, run `publish.py MANIFEST PRIVATE_MEDIA` with the target dashboard database; it checks byte hashes and rejects conflicting dated selections. The manifest contains date, sheet URL, and the list of picks with stable media IDs and display fields. Production access must be verified with an actual approved login. No tasks are scheduled by these scripts.
