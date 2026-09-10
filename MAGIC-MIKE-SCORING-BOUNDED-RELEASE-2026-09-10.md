# Bounded scoring factual review — production release, September 10, 2026

## Live status

Published the replacement in existing scorer `35bFcPYdHSADpyTN`, active version `a21d96c4-2d60-469b-9602-e1a8b5777fc0`. Display name is now `MM Call 2 Coaching + Evidence Score V2 - Bounded Review - LIVE`. Published nodes/connections/settings match the tested candidate. No historical backfill occurred. The last production execution observed so far predates publication; natural post-release delivery is still pending.

Official workflow `L8Nn7xncA9ZPDdWA`, shared provider `CiDBJxWJZCDRJChK`, and persistence `iG6pvqUTn0askw9y` active versions are unchanged. The scorer retains the existing allowed caller, input fields, scoring weights/caps, context loading and ten coaching compatibility fields. Compliance, Ask Sales, Google Documents, and dashboard code were not edited. Existing Rudy-owned shared scorer/persistence dependencies were preserved; additional model requests use the existing project provider, not another person's new credential.

## Execution and costs

Normal eligible path: Sonnet 4.6 primary assessment, Sonnet 4.6 factual check, then conditional Sonnet 4.6 affected-field reassessment. No Luna, Terra, Sonnet 5 or Opus was added. Reviewer requests use temperature 0, checker max_tokens 6500 and reassessment max_tokens 4500, with the exact frozen prompt serialization. Existing primary settings are unchanged.

The previous broad full-assessment validation retry graph was removed. One separately guarded structural recovery exists only when primary JSON/required structure is malformed; valid primary assessments are not regenerated. HTTP reviewer failures route to explicit handlers and cannot silently discard the result. A failed factual review preserves the original validated assessment and records `bounded_review_failed_baseline_preserved` plus its cause; it never labels that fallback as successfully reviewed or fabricates a score if the original is invalid. Combined provider costs and review status persist in the existing output contract. Revision is recorded within score review metadata while the compatible V2 score-version key stays unchanged.

Old V6.3/V7.1 workers and preview scorers remain inactive, and no active related workflow references them. Their saved definitions do not incur API cost. Shared benchmark/provider webhooks have no schedule and were not disabled because some remain dependencies. All scoring test workflows are inactive, including release test `hHTPm84pkDpC6rIH`.

This phase added approximately $0.40096 of paid testing. Cumulative estimated provider tests: $45.38485, plus separate $1 uncertainty reserve, below the $50 ceiling. Fresh complete isolated runs cost $0.09170 (primary/checker) and $0.19704 (primary/checker/reassessment); these are sample costs, not a guaranteed fleet average. Cached primary costs were not charged twice in the test ledger.

## Verification and correction during release

The first native integration used semantically equivalent but differently serialized transcript/schema input. Its checker missed Dean's known errors. Production was held. The release now uses byte-identical checker system/prompt serialization to the frozen Python evaluation across all 26 eligible fixtures. A fresh native request against the faulty Dean assessment then corrected both attribution and prompted-explanation claims (execution 702891), preserving score 48.1. This observed sensitivity is why cached replay alone was not treated as release proof.

Full isolated execution 702901 exercised context fetch, primary generation, structural guard, real checker, real reassessment and final return: valid score 76 with agreement confirmation corrected. All report/storage/Slack writes were absent from the isolated workflow. The candidate's production parameters matched that tested workflow before publication.

27 local integrated replays matched expected results: 26 eligible scores plus one genuine technical-only exclusion. The prior 26 native cached fixtures remain supporting evidence. Six failure cases passed (provider errors, bad JSON, incomplete audits/decisions), structural guard/error wiring checks passed, and 19 contract/parser/release tests passed. Actual persistence mapping of all 26 eligible results preserved exact scores, review status, and non-write mode; maximum field string 14,071 characters.

Live n8n validation reports zero errors. Generic warnings include old untouched HTTP node versions, valid IF false branches mislabeled as error outputs, regex `.exec` false positives, and singleton/code-reference lint warnings. Real native execution covers the touched code and branches; source inspection confirms paired error outputs on the new HTTP nodes.

## Rollback and remaining verification

Private rollback: `.magic-mike-scoring-release-2026-09-10/rollback.json` restores the original scorer definition, connections, name and caller settings. Baseline snapshots and paid receipts are alongside it. Published version was re-read and exact-matched after saving. No old scorer was reactivated.

Natural incoming Call 2 delivery after publication remains the final live observation. Do not describe pre-release executions as candidate live proof. No automatic monitor was restarted. Once a natural call confirms the full path, reassess backfill readiness and cost; backfill still requires explicit approval. Isolated sample success is evidence of improvement, not a guarantee of every future factual judgment.


## Eligibility cost gate correction — September 10

Published scorer version `06611470-8c48-4c12-989c-7531dfc848df`. The only production code change is the reviewer-entry condition: a primary `eligible: true` flag cannot override the validator's explicit `exclusion_category`. Excluded assessments now skip both paid reviewer stages and return `not_applicable`, preserving the exclusion/coaching and primary cost. Repairable evidence failures (no exclusion category) still enter review. No rubric, provider, credential, connection, persistence or compliance changes.

Verification: Theo's exact execution 703173 input replayed in native n8n with both reviewers skipped and costs equal to the original primary cost. Native eligible Dean and repairable-evidence 688011 inputs both retain review routing. All 27 regression replays match, six failure tests pass, and 25 automated tests pass including five exclusion cases and a repairable-evidence case. Tests used cached responses and incurred zero additional AI charges. Test workflow Iwz9wODE2yqabCt6 is inactive. Published code was re-read and matched; every other scorer node, edge and setting is unchanged. Baseline/rollback source is .magic-mike-scoring-gate-2026-09-10/baseline.json.

Natural eligible call during the work: Aidan Whytock execution 703297 passed bounded review, scored 70.8, and corrected agreement confirmation. Persistence execution 703320 created score record recuTzZc7LUcHZWWM; parent 703295 delivered both Slack messages. This natural run began before the gate-only patch and verifies the unchanged eligible scoring path; the new exclusion gate was verified separately in native replay. Parent 703295 subsequently completed successfully; dashboard returned ok=true and report 5885, independently confirmed in the production database. No backfill.
