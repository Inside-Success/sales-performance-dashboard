# AI Closer Scorecard v3 — Raul's Call 2 procedure rubric

Started September 18, 2026. **Status: candidate under evaluation, not released.** The live scorer `35bFcPYdHSADpyTN` still runs v2 (active version `29b014fe-59bc-46f5-ac4b-96b72cd458ac`); persistence `iG6pvqUTn0askw9y` is unchanged (`bd084b23-1de1-44f7-8e98-1b950f04af73`). No Airtable row, Slack message, Google document or production deployment has changed. Results and the release decision are appended below when the evaluation completes.

## Why

Raul Rios (Sales Ops and Training) asked on September 11 for the Call 2 scorecard to check the trained procedure step by step: recording disclosure, a short greenlight review, the transition into Rudy's video, assuming the sale after the video, re-establishing value on objection, prospect-specific urgency, payment solutions one at a time, and the onboarding handoff. His document keeps the existing four dimensions, weights, band points and caps and adds those steps plus a fourteen-item checklist. In the September 17 call he confirmed the rubric is final, asked for forward-only scoring with no backfill, asked to keep the old scores for comparison, and asked for a highest-first sort. His underlying concern: top sellers (Tara at 48.6) sat low on the scorecard.

## What the diagnosis found before building (read-only, September 18)

- 739 current v2 scores (September 1 onward, passed review). Mean 57.5, standard deviation 11.2, range 25.4–82.8; 41% of calls sit in the 60s.
- 220 of 739 calls carry a cap: no close attempt 111, no concrete next step 115, abandoned primary objection 82, lost control 13. 116 calls have no verified direct commitment ask.
- Rank correlation between each rep's latest-five average and their September 1–16 new paid revenue from the company sales sheet (read-only): +0.22 (52 reps with three or more scored calls). Weakly positive, not inverted. The all-calls average correlates at +0.34.
- Top sellers who sit low: Cristian Turri (rank 55 of 113), Shari Weller (103), Mike Zanardelli (102). Shari has no verified direct ask on 13 of 23 calls and 13 capped calls while closing 4 on the call. Tara's low September 13 calls are ones where the model found no ask and a vague "touch base in six months" ending; her closes on September 5 and 7 scored 71.7 with exemplary close mechanics.
- Zoom transcripts label played media as `Audio shared by <rep>` with Rudy's recorded greeting, so the video step is detectable in about 60% of calls; screen sharing is never visible in a transcript.

## What v3 changes (see `n8n/call2-score-v3/README.md` for definitions)

Unchanged: dimensions, weights, band points, caps, exclusions, Sonnet 4.6, bounded factual review, immutable persistence, five-call average, rep-facing numeric-only display.

Added: the procedure section in the scorer prompt; a fourteen-item checklist stored in `Behaviour Checks JSON` and shown on the manager call page; a verified call outcome in `Call Context JSON`; assumptive close counted as a real close attempt (with a `no_close_attempt` cap suppressed when one is verified); deterministic ceilings for payment-option dumping (four or more), payment before value (two or more plans), a greenlight over 12 minutes without a prospect-driven reason, and a missing disclosure (frame cannot be exemplary); factual-checker claims for the procedure booleans; version `magic-mike-call2-evidence-score-v3`, review revision `raul-procedure-2026-09-18`.

Dashboard: current cohort is v3; `?history=1` shows the v2 cohort read-only labelled "previous rubric"; v2 and v3 never average together; rank numbers and a lowest/highest sort; the checklist on the call page; reps see the score of whichever version scored their call (v3, else v2, never v1).

## Evidence so far

- 198 dashboard tests pass (21 new v3 tests run against the built node code). TypeScript and scoped ESLint pass.
- Isolated n8n copy `vRhAIu3fTJ10QLO9` (inactive, no delivery, no persistence) validates with zero errors and has byte-identical node code to `dist/`.
- Smoke run on three fixtures: $0.56. Per-call cost $0.11–0.28 (primary, checker, and reassessment when needed). The v3 prompt is about 31k characters and is cached by the provider.

_Evaluation results, spend, native replay and the release recommendation are appended below when available._
