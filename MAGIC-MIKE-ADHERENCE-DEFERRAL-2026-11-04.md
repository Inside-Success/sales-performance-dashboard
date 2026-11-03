# Script adherence: scoped deferral and fresh-call verification

## Change and boundaries
Explicitly postponed tasks now display **Deferred**, require transcript evidence and a scoped explanation, and receive neither completion credit nor an omission penalty. The existing 50-percent action threshold remains unchanged. An interruption does not excuse earlier omissions, ordinary next-stage scheduling is not a deferral, and an incomplete recording cannot prove omission.

Pipeline `adherence-two-pass-2026-11-04-v9` evaluates shared applicability conditions once in each existing Terra pass. Actual task-specific completion or explicit deferral can establish applicability without activating unrelated conditional tasks. Rep continuation appointments remain distinct from production onboarding appointments. No model stage was added; Batch and realtime use the same request/parser path. Existing records remain readable. Deferred is counted within the existing unassessed storage total and separately explained in the UI; no database migration is required.

Company-wide intake and backfill remain off, transport remains Batch, canary keys remain empty. This work does not change official coaching, FAQ, source documents, or Slack.

## Evaluation and limits
Normal API requests were used, with durable receipts, exact request identities, project reservations and usage settlement. Three development iterations cost $1.481814: v7 $0.364413 (18 requests), v8 $0.477405 (24 requests), v9 $0.639996 (30 requests). v8 held two paid outputs because its overly strict shared-condition guard rejected a legitimate task-specific exception. Those receipts were settled and retained; neither was published. The generalized v9 condition/evidence rule fixes that design problem.

Final v9 evaluated 15 unique calls with two passes each: three prior regressions and twelve additional source calls. Only the final three were untouched by the preceding development rounds, and two of those were minimal transcripts. This is useful contrast testing, not a large independent accuracy benchmark. Do not report a 100-percent accuracy claim from schema acceptance or draft/review agreement. The selected set does not establish documentary Call 1 accuracy or every possible edge case.

Full transcripts were inspected for classification, applicability, videos and action evidence. Final observations:
- Original interrupted documentary Call 2: both videos genuinely absent; production onboarding explicitly postponed. 14 complete / 24 assessed, one deferred and one unclear payment-confirmation action. This replaces the old 14/26 omission treatment for this one pilot record only.
- Fresh documentary contract-review continuation: both videos played; explicitly postponed welcome-email work remains deferred while production-onboarding tasks whose condition has not occurred remain inapplicable.
- Distinct reality pitch and CEO orientation: both count even when out of order. A show-pitch with its embedded network tail does not count as two videos.
- Fresh reality audition titled Call 2: actual Call 1; later financial refusal does not erase earlier applicable actions.
- Two genuine Reality Call 2 presentations remain classified but unscored because no approved script exists.
- Short/voicemail/interrupted-opening records do not receive invented checklist failures.
- Final untouched substantive documentary call: both videos and all 16 applicable actions observed; payment/onboarding steps inapplicable after a financial refusal. This is action adherence, not a judgment that the sales handling was ideal.

Some semantic judgments remain interpretive (for example asking about audience familiarity versus specifically prior public sharing). No customer names, source keys, or expected test answers were added to prompts. No assurance of perfect unseen-call accuracy is warranted.

## Validation and release
104 script-adherence tests passed; TypeScript and production webpack build passed. A read-only production-data integration test passed against all 51 saved calls and pagination. Original 46-record digest must remain `48346bfb7b1aeb35173847865a53999a`.

Release and authenticated dashboard verification are pending below. Preserve prior accepted result, source transcript and original provider receipts when correcting the single affected pilot record. Fresh research calls are not published into the accepted dashboard.

### Completed verification
PR371 merged as `3e143b06729771b0a788c28a4837febf1d3b65ed`; Vercel production deployment `dpl_GnVCsHpVhmJeyUipzwo6JQcw2vUW` is Ready and owns the canonical dashboard alias. GitHub's adherence regression gate passed.

The single pilot correction was applied with an exact prior-request/result compare-and-set and an atomic call/metric update. Its prior accepted record is archived privately and its original provider review remains in the database. Repeating the correction was a no-op. The other 50 accepted records have an unchanged digest, and the original 46-record baseline also matches. All 51 calls remain saved; 25 have supported checklists, with 342 completed / 453 assessable actions. No fresh research calls were published.

Authenticated canonical dashboard and rep drilldown were verified: the affected call displays 58% (14/24), both videos Not complete, payment Not observable, and Arrange onboarding Deferred with the exact postponement quote. The rep aggregate reconciles to 39/62 (63%). The help panel distinguishes not applicable, unclear and deferred, and the owner status reports Paused, zero active batches and zero held calls. The read-only production integration check passed again after correction.

Final v9 usage: 470,359 input tokens, including 186,700 cached; 55,219 output tokens. Individual API requests took 5.162–50.144 seconds. All 30 final requests settled without validation errors. Recollecting an existing draft/review pair incurred no new request or charge. Project usage-priced total is $8.330047, with zero outstanding reservations; this round added $1.481814. Both pilot n8n schedules were verified inactive.

Assessment: the scoped defect is fixed and the implementation is suitable for a controlled wider rollout. This sample does not prove zero errors across all unseen calls, and unsupported scripts remain unscored by design. Company-wide activation and the one-week backfill remain separate decisions. Preserve the current Batch transport and disabled control until that decision.
