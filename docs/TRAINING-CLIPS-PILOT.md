# Training Clips pilot

The manager directory opens `/manager/training-clips`. The page reads one saved report. Its rep filter and media requests never invoke a model. The Google Sheet shows the same selection and links each Topic to the matched source recording at the selected cue. The inline video is a bounded MP4 so managers can play the exchange through its endpoint on mobile and desktop.

## Manual pilot

Use the previous seven complete New York dates. Enumerate source rows for those dates and account for them individually. Reconcile duplicate occurrences and confirm an attended second call using source history or explicit transcript evidence. Bind the exact VTT to an MP4 from the same Zoom occurrence with the same recording bounds. Hold ambiguous recordings or missing transcripts before model spend. The neighboring tracker’s result, coaching judgment and sales outcome are unnecessary.

The prompt in `scripts/training-clips/review-prompt.txt` reproduces the review block from the [product prompt](https://github.com/Inside-Success/magic-mike-sales-ai-coach/blob/main/rudy-call-2-training-picks/prompts/review-call.md). Run `review.py` against private normalized input with the dedicated project key. Pass an existing private receipt directory. Preserve exclusive claims and provider receipts across retries. Each response must bind to labeled source cues. Compare models on the same transcript and response schema. Store no keys, transcripts, recordings, individual picks or receipts in Git.

Render selected exchanges from the opening cue start through the closing cue end. Check the source media identity, the presence of both video and audio, and the output duration. Use the recording file start plus the cue offset for the Sheet’s Zoom startTime in epoch milliseconds. Present whole-second boundaries that include the full exchange. Keep stable identifiers for each occurrence and boundary pair. Write media chunks of 262144 bytes and publish the dated selection in a single transaction. Populate the companion Sheet from that selection, retaining all reviewed decisions in its master tab. Verify both views against that same selection and rerun publication without paid requests.

The database schema is in `migrations/20261125_training_clips.sql`. Both the page and media route check the management policy. Private media supports HTTP byte ranges and uses private, no-store responses. There is no scheduled intake or publishing workflow. Rudy's signed-in playback and usefulness check precedes any scheduling decision.

The manual command is `python3 scripts/training-clips/run-review.py INPUTS PRIVATE_STATE --model gpt-6-luna`. Repeat with `gpt-6.1-terra` for a paired comparison. Configure `TRAINING_CLIPS_OPENAI_API_KEY` in the runner environment. Inputs contain the verified call, title and matched video manifest. Publication is a separate operation, so reloading the UI or repairing Sheet formatting cannot trigger another model pass.
