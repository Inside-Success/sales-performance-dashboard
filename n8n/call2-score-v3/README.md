# Call 2 scorer v3 — Raul's procedure rubric (September 2026)

Status: in development, not published. The live scorer `35bFcPYdHSADpyTN` still runs v2 (`magic-mike-call2-evidence-score-v2`, active version `29b014fe…`). Nothing in this folder is deployed until the user approves the test results.

## What changes and what does not

Unchanged from v2: the four dimensions and weights (Frame 20, Tailoring 25, Objection 25, Close 30), band points (10/32/55/76/93), critical-miss caps (49/54/59/49/64, lowest wins), objection rescaling when not applicable, eligibility exclusions, Sonnet 4.6 at temperature 0, the bounded factual checker and conditional reassessment, the single structural repair, the one completion repair, exact transcript-grounded evidence, immutable persistence and the five-call rep average.

New in v3 (from Raul Rios's September 11 rubric document, confirmed final in the September 17 call, forward only):

1. The scorer is told the required Call 2 flow: recording disclosure, short greenlight review, transition to Rudy's video, assume the sale after the video, re-establish value on objection, prospect-specific urgency, payment solutions one at a time, complete the handoff.
2. A procedural checklist is produced with every scored call and stored in the existing `Behaviour Checks JSON` field. Fourteen items, each `yes`, `no`, `not_applicable` or `unable_to_determine`, each `yes`/`no` backed by a transcript quote where a quote is possible.
3. An explicit call outcome (`closed_on_call`, `deposit_taken`, `agreement_pending_payment`, `follow_up_agreed`, `declined`, `no_decision`) derived from verified close signals, stored in `Call Context JSON.outcome`.
4. Assuming the sale counts as a close. The v2 validator only credited a close when it found a literal question or imperative request. In v3 a grounded assumptive move into enrollment or payment satisfies the same requirement, and a `no_close_attempt` cap cannot coexist with a verified assumptive close.
5. Deterministic ceilings that make Raul's guidance bite without touching weights or caps:
   - No assumptive close and no direct ask → Close at most `attempted` (existing v2 rule, now with the assumptive-close exception).
   - Four or more distinct payment options offered before a resolution check → Objection Handling at most `attempted`.
   - Payment options offered before any value re-establishment on a financial objection → Objection Handling at most `adequate`.
   - Greenlight review longer than 10 minutes without a prospect-driven reason → Frame and Control at most `adequate`.
   - No recording disclosure → Frame and Control at most `strong` (compliance flags the disclosure separately; the scorer only blocks an exemplary frame).
6. Version identity: `score_version` becomes `magic-mike-call2-evidence-score-v3`, review revision `raul-procedure-2026-09-18`. Old v2 rows stay in Airtable untouched and remain viewable as the previous-rubric cohort. v2 and v3 are never averaged together.

## Definitions the rubric left open (agreed with the user September 18)

- **Greenlight segment**: from the first mention of the greenlight, greenlight letter, casting result or "you were approved" to the moment the rep transitions to Rudy's video (or, if no video, to the first pricing or offer statement). Duration is computed in code from the two timestamps the model marks. If either boundary cannot be located, duration is `unable_to_determine` and no Frame ceiling applies. A prospect-driven extension (the prospect keeps asking questions or telling their story) removes the ceiling but is still shown.
- **Payment option**: one distinct plan structure (pay in full, 4×, 3×, 2×, a deposit-then-plan) named before the rep checks whether the objection is resolved. Restating the same structure is not a second option. Presenting only one option that the prospect accepts is never penalized.
- **Assumptive close**: a rep statement that moves to enrollment or payment as the next action without first waiting for the prospect's decision, for example "I'm going to send you the payment link now" or "So we'll get you set up on the Standard license, the first payment is…". Must be the rep's own speech after the offer. "What are your thoughts?" and price statements alone are neither an ask nor an assumptive close.
- **Prospect-specific urgency**: credited only when tied to something the prospect said (their goal, timeline, business stage) or to a real, stated deadline such as the cohort closing Sunday 11:59 PM. Generic pressure or invented scarcity is never credited and never rewarded.
- **Rudy's video**: detected from Zoom's shared-audio speaker label (`Audio shared by <rep>`), Rudy's opening line in shared audio, or the rep's explicit transition. If none is present the item is `unable_to_determine` and nothing is penalized.
- **Screen share**: not observable in a transcript. Always `unable_to_determine` unless the transcript itself states it; never penalized.

## Files

- `src/legacy-lib.v2.js`: the shared library extracted verbatim from the live v2 nodes (reference only; the build reads the live baseline export).
- `src/v2-system-prompt.txt`, `src/v2-checker-system.txt`, `src/v2-reassessment-system.txt`: the live prompts, for diffing.
- `src/v3-system-prompt.txt`: the v3 scorer prompt (prompt only).
- `src/v3-rules.js`: procedural checklist derivation, ceilings, outcome classification, checklist rendering.
- `build.mjs`: assembles `dist/*.js` node code and a candidate workflow JSON from the private baseline export plus these patches.
- `tests`: under `tests/rep-scoring/v3-*.test.ts`.
