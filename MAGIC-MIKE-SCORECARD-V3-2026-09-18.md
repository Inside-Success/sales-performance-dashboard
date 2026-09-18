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



## Evaluation results (September 18–19, 2026)

Sample: 31 calls. 21 real September calls chosen to stress Raul's concern (top sellers' lowest-scored calls, their highest, low sellers with high scores, and six untouched mid-range calls from September 18) plus 10 regression fixtures (Dean, Tara September 8, Kyla, IMAD, Jackeline, Landria, Stephen, and three of the six "fresh" August calls). Every call ran through the full v3 graph locally with the same node code that ships to n8n; provider calls went through the shared provider webhook exactly as production does. 15 calls with a greenlight over ten minutes were re-run after the final prompt wording (prospect-driven or borderline length must not lower Frame); the final table uses the re-run results for those.

| Rep | Call date | Set | v2 | v3 | Caps (v3) | Assumed sale | Video | Greenlight min | Review |
|---|---|---|---:|---:|---|---|---|---|---|
| Candace Weaver | 2026-09-18 | Sept | 54.5 | 47.6 | no concrete next step; abandoned primary objection | yes | yes | 19.7 | passed |
| Cristian Turri | 2026-09-03 | Sept | 37.8 | 42.4 | no close attempt; no concrete next step | no | yes | 10.4 | passed |
| Cristian Turri | 2026-09-14 | Sept | 42.4 | 42.4 | abandoned primary objection; no concrete next step | no | yes | 11.9 | passed |
| Cristian Turri | 2026-09-16 | Sept | 37.8 | 37.8 | no close attempt | not_applicable | no | unable_to_determine | passed |
| Cristian Turri | 2026-09-16 | Sept | 82.8 | 82.8 | — | no | yes | 4.3 | passed |
| Dean Larken | 2026-08-26 | regr | excluded | excluded | — | — | — | — | not_applicable |
| Dean Larken | 2026-09-09 | regr | 48.1 | 37.8 | no close attempt; abandoned primary objection | not_applicable | no | unable_to_determine | passed |
| Fred Mitchell | 2026-09-18 | Sept | 60.3 | 60.3 | — | yes | yes | 11.2 | passed |
| IMAD HASSANEIN | 2026-09-08 | regr | 60.3 | 60.3 | — | not_applicable | no | 15.6 | passed |
| JACKELINE MEDINA | 2026-09-09 | regr | 76 | 66.6 | — | unable_to_determine | yes | 26.7 | passed |
| Kyla Gomez | 2026-09-06 | Sept+regr (same call in both sets, two result files) | 76 | 76 | — | yes | yes | 8.9 | passed |
| Kyla Gomez | 2026-09-11 | Sept | 75.9 | 75.9 | — | yes | yes | 16.6 | passed |
| Landria Onkka | 2026-09-09 | regr | 47.6 | 35.8 | no close attempt | not_applicable | no | 10 | passed |
| Marc Swanepoel | 2026-08-28 | regr | 71.7 | 65.9 | — | no | yes | unable_to_determine | passed |
| Marc Swanepoel | 2026-09-18 | Sept | 61.8 | 61.8 | — | not_applicable | no | 3.3 | failed |
| Mariano Miquelarena | 2026-09-10 | Sept | 66.6 | 49.3 | abandoned primary objection | no | yes | 1.4 | passed |
| Mark Jefferson | 2026-08-26 | regr | 81.1 | 71.7 | — | not_applicable | no | 10.9 | passed |
| Mike Zanardelli | 2026-09-14 | Sept | 37.8 | excluded | — | — | — | — | not_applicable |
| Mike Zanardelli | 2026-09-16 | Sept | 37.8 | 37.8 | abandoned primary objection | no | yes | 1.8 | passed |
| Samantha Forcash | 2026-09-18 | Sept | 64.5 | 60.3 | — | not_applicable | no | 25.3 | passed |
| Sarah Prater | 2026-09-18 | Sept | 60.3 | 60.3 | — | yes | yes | 12.5 | passed |
| Shari Weller | 2026-09-02 | Sept | 35.8 | 35.8 | no close attempt; no concrete next step | not_applicable | no | 5.3 | passed |
| Shari Weller | 2026-09-17 | Sept | 31.2 | excluded | — | — | — | — | not_applicable |
| Shari Weller | 2026-09-17 | Sept | 42.4 | 42.4 | no close attempt | no | yes | 3.4 | passed |
| Stephen Ighodaro | 2026-09-08 | regr | 31.2 | excluded | — | — | — | — | not_applicable |
| Tara Reszitnyk | 2026-09-07 | Sept | 71.7 | 71.7 | — | yes | yes | 4.6 | passed |
| Tara Reszitnyk | 2026-09-08 | regr | 42.4 | 49.3 | — | no | yes | 15.1 | passed |
| Tara Reszitnyk | 2026-09-13 | Sept | 37.8 | 31.2 | no close attempt; abandoned primary objection | no | yes | 20.5 | passed |
| Tara Reszitnyk | 2026-09-13 | Sept | 37.8 | 31.2 | no close attempt; no concrete next step | no | yes | 3 | passed |
| Tara Reszitnyk | 2026-09-13 | Sept | 42.4 | 42.4 | no close attempt; abandoned primary objection; no concrete next step | no | yes | 9.3 | passed |

Summary of the 27 scored results (31 result files; Kyla's September 6 call is in both sets, so 30 unique calls and 26 unique scored calls; the duplicate scored identically): v3 mean 53.8, standard deviation 15.6, range 31.2–82.8. On the 27 calls with a v2 score, v2 mean 56.7 and standard deviation 15.7; mean change −2.8; 15 identical, 10 lower, 2 higher. Rep-level on paired calls: Tara 46.4 → 45.2, Cristian 50.2 → 51.3, Shari 39.1 → 39.1, Kyla 76.0 → 76.0, Mark Jefferson 81.1 → 71.7, Jackeline 76.0 → 66.6, Mariano 66.6 → 49.3.

Only one of the four new deterministic ceilings fired in this sample: Marc Swanepoel's August 28 call, Objection Handling capped at `attempted` for more than three payment options. Every other v2-to-v3 change comes from the model's band judgments under the procedure prompt and the existing caps, which the checker still verifies claim by claim. Call outcomes: closed on call 6, agreement pending payment 3, payment path offered 3, follow-up agreed 5, declined 3, no decision 7 (duplicate included).

Checklist coverage on the 27 scored results: disclosure yes 25 / no 2; greenlight over 10 minutes on 12, under on 12, undetermined 3; Rudy's video detected 19, judged skipped 8; assumed the sale yes 7 / no 11 / not applicable 8 / undetermined 1; objection occurred 23; value re-established yes 8 / no 15; prospect-specific urgency yes 15 / no 10; more than three payment options 1; concrete next step yes 16 / no 11; onboarding booked 5; welcome email explained 6. Screen share was undetermined on 17 and "yes" on 10 only where a speaker said it aloud.

Robustness across all 46 executions (31 plus 15 re-runs): zero provider failures, zero structural repairs, zero checker-contract repairs, one factual review that still failed after the single completion repair (Marc Swanepoel September 18; the validated baseline score was preserved and, as in v2, a failed review keeps the call off the scorecard). Reassessment ran on about half the calls. One call (Mike Zanardelli September 14) flipped from 37.8 to excluded between the first run and the re-run: the model judged it an initial qualification call with no closing stage; the first run had judged the closing stage observable. That boundary is model-dependent and was already so in v2.

Native n8n run: the isolated copy `vRhAIu3fTJ10QLO9` executed IMAD's September 8 call end to end through a temporary webhook (deleted afterwards, workflow restored and left inactive): score 60.3, identical to the local run, review passed, identical checklist, $0.20. No delivery, persistence, Slack or Google node exists in that copy.

Spend: $10.89 in total ($0.56 smoke, $1.95 regression, $4.72 September, $3.45 targeted re-run, $0.20 native). Per call: about $0.09 primary, $0.10 checker, $0.08 reassessment when needed, so $0.18–0.27 per scored call, the same order as the live v2 scorer with its bounded review.

## Honest assessment

1. **The rubric is implemented as Raul wrote it, and nothing in the math changed.** Weights, bands, caps and exclusions are the v2 ones; the additions are the procedure checklist, the assumptive-close credit, the outcome label, and four deterministic ceilings that only fire when a step is skipped.
2. **v3 does not lift the top sellers Raul is worried about.** On their low calls the transcripts show no ask and no assumptive move after the video (Tara's three September 13 calls, Shari's, Mike's, Cristian's low calls). The checklist now shows a manager exactly which steps were skipped, which is the useful new information, but the numbers stay low because the steps were not done. Tara's high call stays 71.7, Cristian's stays 82.8.
3. **v3 is slightly stricter overall** (−2.8 on average, with 10 of 27 calls lower and 2 higher). The drops are where Raul's rules apply: a long rep-driven greenlight, price concessions before re-establishing value, and jumping to payment plans. Spread is unchanged (standard deviation 15.6 versus 15.7), so Tyler's variance concern is neither helped nor hurt.
4. **Some movement is model variation, not rubric.** Re-running with a wording change moved a few unaffected calls by one band (Sarah 66.6 → 60.3, Kyla 71.7 → 75.9). Temperature zero does not make Sonnet deterministic on these transcripts. This was also true of v2.
5. **Three very weak calls that v2 scored 31–38 are now excluded** as no closing opportunity. That is arguably fairer to the rep and consistent with the existing exclusion rules, but it means a manager sees "not scored" instead of a very low number on those.
6. **Not verified:** the persistence workflow change ran only in unit tests, not natively (it is Rudy-project-owned and live; running it pinned would require a settings change on production). It is a two-line whitelist and field change; the first natural v3 call after release is the real check. Screen share cannot be detected. Raul has not blind-rated any of these calls; the comparison is v2 versus v3 plus my reading of the reasons, not human gold.

**Recommendation:** release v3. It gives managers the step-by-step checklist Raul asked for, treats assuming the sale as a close, and keeps scores comparable in scale to v2 while being a little stricter in exactly the places the rubric intended. Set the expectation with Raul that it will not move Tara, Shari or Cristian up on the calls where they did not ask for the sale. If the user prefers to wait, the candidate is complete and inactive.

## Release runbook (only after the user approves)

1. Refresh live versions: scorer `35bFcPYdHSADpyTN` must still be `29b014fe…`, persistence `iG6pvqUTn0askw9y` must still be `bd084b23…`; both already captured in `.magic-mike-scorecard-v3-2026-09-18/baseline/`.
2. Publish persistence first: replace the `Build Immutable Call 2 Score Record` node code with `dist/persist.build-immutable-call-2-score-record.js` (accepts v3, writes the checklist and outcome). Backward compatible with in-flight v2 results.
3. Publish the scorer in place on the same workflow ID: the nine changed nodes listed in `dist/publish-operations.json`; keep caller policy, credentials, connections and the Rudy-project ownership untouched; rename to "… V3 - Raul Procedure - LIVE".
4. Merge the dashboard branch to main and let Vercel deploy; verify the production alias; `/manager/rep-scoring` is empty until the first v3 call, `?history=1` shows the v2 cohort.
5. Watch the first natural Call 2: scorer execution → persistence creates the `magic-mike-call2-evidence-score-v3:<source>` row → manager call page shows the checklist → rep report shows the number.
6. Rollback: restore the two baseline node definitions from the private folder and publish; revert the dashboard merge. Do not delete rows.
7. Afterwards delete the isolated test copy `vRhAIu3fTJ10QLO9`.
