# Rep Scoring V6 Calibration Release — 2026-08-10

## Outcome

V6 is implemented as an isolated, rollback-safe calibration candidate. It is not the live manager scoring contract yet. The current V5 manager view, production Coaching workflow, intake, Ask Sales, source calls, Slack, and Google content were not changed.

After the organization balance was funded, the balance gate passed and the full calibration completed. The hidden review page now contains six Call 1 and six Call 2 calls, each scored twice: 12 unique calls and 24 immutable assessments. The score range is `45.0–85.0`, so the sample includes low, developing, meeting-expectations, and excellent results rather than clustering at 100.

The calibration also did its intended job of exposing remaining judgment variability before a backfill. Nine of twelve pairs meet the strict stability rule (same display band and no more than 10 points apart). Three require human review because they crossed a band boundary; the largest difference is 22.2 points. Therefore V6 is ready for the owner's 12-call calibration review, but it is not approved for backfill or Coaching display yet.

## Approved scoring contract

- Six representative Call 1 calls and six representative Call 2 calls.
- Every call is scored twice using independent immutable result versions.
- DeepSeek V4 Pro, temperature zero, one full primary assessment.
- A second model request is permitted only to repair malformed JSON syntax; it cannot revise the judgment.
- Deterministic per-dimension validation of exact quote, timestamp, speaker, controllability, and confidence.
- Unsupported dimensions are excluded individually. There is no independent model-wide veto.
- Ratings are assessed dimension by dimension at `100 / 85 / 70 / 50 / 25 / 0`, then combined deterministically using the call-specific weights.
- `partially_gradeable` is reserved for a materially missing or corrupted section. `not_gradeable` is reserved for genuinely unusable transcripts or unresolved speaker identity.
- Technical defects, lead quality, prospect difficulty, and other external factors do not become rep penalties.
- Call 1 success means making the correct progression decision; a fair rejection can be excellent.
- Call 2 records sale, deposit, concrete follow-up, intentional rejection, lost, or unknown separately from rep execution quality.
- Strengths, improvements, and critical findings may be empty; the model cannot manufacture a fixed number.

The Call 1 rubric follows the provided `Rudy's Master Script - CALL #1.docx`: consent and control, discovery of story/expertise, commercial need and consequence, fit/authority/readiness, progression decision, and next steps/stakeholders/pre-work.

The Call 2 rubric follows the provided `INSIDE SUCCESS TV - CALL SCRIPT #2 .docx`: consent/reconnection/agenda, personalized value, commitment and stakeholders, license/price/terms, objection diagnosis, best reasonable outcome, and contract/payment/onboarding.

## n8n release

### Worker

- ID: `lfyLHukUvx9887it`
- Name: `MM Rep Scoring V6 - Dimension-First Calibration Worker (NO BACKFILL)`
- Trigger: Execute Workflow Trigger only
- Storage: new immutable, versioned rows in isolated Airtable base `appEQQkTlJnc7tJgi`
- Source Google transcript access: read-only
- Slack: no access
- Current state: published and callable only by another n8n workflow

### One-time launcher

- ID: `KCh1MiSacbFMge5I`
- Name: `MM Rep Scoring V6 - One-Time 12-Call Double Calibration Launcher`
- Controlled webhook: disabled after the completed launch
- DeepSeek balance gate: must report available and at least the configured safe minimum before candidate selection or dispatch
- Dispatch: exactly four workers, each with six sequential calls
- Current state: inactive

### Versions

- Round 1: `rep-reviewer-v6-calibration-r1`
- Round 2: `rep-reviewer-v6-calibration-r2`
- Prompt: `rep-prompt-v6-script-grounded-dimension-first-1`
- Rubric: `rep-rubric-v6-call-specific-fairness-1`
- Config: `rep-scoring-config-v6-calibration-1`

### Safe launch evidence

- Earlier execution `468131` reached the balance check, received `is_available: false` with `total_balance: -0.11 USD`, and stopped before candidate selection. This confirmed the fail-closed spend guard.
- The first funded attempt, execution `468664`, passed the balance gate but stopped in candidate selection on a local variable-name defect before any model call or Airtable write. The selector was corrected from the undefined `row` reference to the selected candidate and revalidated with zero errors.
- Corrected launcher execution `468673` dispatched four bounded workers: `468680`, `468681`, `468682`, and `468683`. All four finished successfully.
- One selected Call 2 contained two recognized company reps with a 74%/26% speech split. Both rounds deterministically quarantined it as `speaker_resolution_ambiguous_multiple_reps`; V6 did not guess which employee to score.
- The launcher selector now excludes that exact ambiguous source call. Completion execution `468876` reused idempotency to skip the 22 existing assessments and processed one replacement Call 2 in workers `468880` and `468882`. The replacement scored `74.6` and `79.3`, remained in the same band, and completed the promised 12 paired calls.
- The controlled launcher was deactivated immediately after each dispatch and remains inactive. No schedule or backfill was enabled.

## Dashboard release

Hidden route: `/manager/rep-scoring/v6-calibration`

The page is protected by the existing exact-email rep-scoring administrator gate and reads only the two V6 calibration scorer versions. It displays:

- unique calls and completion of both rounds;
- round 1 and round 2 scores side by side;
- score delta and band agreement;
- an explicit stability rule: no more than 10 points apart and the same band;
- transcript reliability, prospect opportunity, Call 2 outcome, and sample reason;
- every scored dimension, rating, weight, exact evidence, and counterevidence;
- strengths, improvements, critical findings, excluded-dimension warnings, and technical provenance;
- truthful pending states when zero or one scoring round exists.

The current `/manager/rep-scoring` page remains unchanged. V6 cannot influence manager rankings or Coaching scores during calibration.

## Verification completed

- Both n8n workflows validated with zero runtime errors after the funded launch and replacement selection correction. The remaining validator warnings are advisory heuristics, not graph or expression failures.
- The worker remains published with an internal Execute Workflow Trigger only. The external launcher is inactive.
- All six worker executions used for the final calibration finished successfully. The store contains 24 V6 score rows for 12 unique calls and two audit-preserved quarantine rows for the excluded two-rep recording.
- All 24 visible assessments are gradeable, evidence-verified dimension by dimension, contain zero validation warnings, and required no JSON-repair request.
- Score distribution: minimum `45.0`, maximum `85.0`, mean `69.6`, median `76.1`; Call 1 mean `74.4`, Call 2 mean `64.8`.
- Stability: `9/12` strict passes, `9/12` band matches, eight exact score matches, and three review pairs. The review deltas are `7.3` with a band boundary, `11.7`, and `22.2`.
- Authenticated Chrome verification confirmed the production overview shows `12/12` unique calls, `12/12` double-scored, `9/12` stable, and `Backfill: Not started`.
- The production comparison page was inspected on a review-marked 22.2-point pair and correctly displayed both rounds, every dimension, exact evidence, counterevidence, prospect opportunity, outcome, and the explicit human-approval gate.
- No browser console warnings or errors were present during the final production verification.
- Three scoped V6 dashboard tests passed.
- TypeScript passed.
- Scoped ESLint passed.
- The Next.js production build compiled successfully without running a local development server.
- `git diff --check` passed.
- GitHub PR `#139` merged as `0ddbe7a721ec66609d6d78d0303ecafa8da8881d`.
- Production deployment `dpl_9rh9WTqasj4BonuigVwVa6qya7Ta` reached `READY` and owns the canonical `sales-performance-dashboard-rose.vercel.app` alias.
- The canonical V6 route returned HTTP 200 and correctly redirected an unauthenticated request to Google sign-in rather than returning 404.
- Vercel reported no runtime errors for `/manager/rep-scoring/v6-calibration` in the post-deployment verification window.

## Remaining approval gate

1. The owner reviews all 12 call pairs on the hidden V6 page, with particular attention to the three review-marked pairs.
2. The owner records whether each score, dimension rating, prospect classification, outcome, and main finding is fair.
3. Any rubric correction is made as a new immutable scorer version and recalibrated before backfill; existing V6 rows remain audit history.
4. A one-week V6 backfill is created or started only after the owner's explicit approval.
5. The separate Coaching score-display integration stays on hold until V6 itself is approved.

## Rollback

The current live V5 manager view is already the rollback path because no cutover occurred. To remove the calibration candidate, deactivate worker `lfyLHukUvx9887it` and deploy the previous dashboard commit. This does not modify or delete V5 rows, source calls, Coaching, intake, Slack, or Google content.
