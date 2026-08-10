# Rep Scoring V6 Calibration Release — 2026-08-10

## Outcome

V6 is implemented as an isolated, rollback-safe calibration candidate. It is not the live manager scoring contract yet. The current V5 manager view, production Coaching workflow, intake, Ask Sales, source calls, Slack, and Google content were not changed.

The 12-call calibration has not been dispatched because the dedicated DeepSeek balance gate returned unavailable with a balance of `-0.11 USD`. This deliberate fail-closed result prevented partial scoring and further API spend. Recharge is the only external prerequisite for generating the calibration results.

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
- Controlled webhook: disabled after the attempted launch
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

Launcher execution `468131` reached the balance check, received `is_available: false` with `total_balance: -0.11 USD`, and stopped at `Require Safe Calibration Balance`. No worker was dispatched. The controlled launcher was immediately disabled again.

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

- Both n8n workflows validated with zero runtime errors before launch.
- The worker was successfully published; the launcher was published, called once, and immediately disabled.
- The balance failure was inspected at the exact failing node and confirmed to occur before candidate selection, worker dispatch, model calls, or Airtable writes.
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

After the dedicated DeepSeek balance is restored:

1. Enable the one-time launcher.
2. Trigger it exactly once.
3. Disable it immediately after dispatch.
4. Confirm 12 unique calls and 24 immutable assessments.
5. Review score stability, fairness, evidence accuracy, and outcome treatment on the hidden V6 page.
6. Obtain the owner's explicit approval before creating or starting a one-week V6 backfill.
7. Keep the separate Coaching score-display integration on hold until V6 itself is approved.

## Rollback

The current live V5 manager view is already the rollback path because no cutover occurred. To remove the calibration candidate, deactivate worker `lfyLHukUvx9887it` and deploy the previous dashboard commit. This does not modify or delete V5 rows, source calls, Coaching, intake, Slack, or Google content.
