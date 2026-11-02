# Script-adherence model comparison — 2026-11-02

## Equal-condition reference comparison

Thirty calls, same v4 prompt, source, rubric and token ceiling. The reference was frozen before this comparison, but was previously used during development. Agreement is not an independently established accuracy rate. Invalid output counts as disagreement. Costs are actual provider-usage receipts for this batch, including both stages where applicable.

| Pipeline | Valid calls | Classification agreement | Action agreement | Video agreement | False video omissions | USD per call |
|---|---:|---:|---:|---:|---:|---:|
| haiku | 28/30 | 30/30 | 292/339 | 27/30 | 0 | $0.00452 |
| haiku → haiku | 28/30 | 28/30 | 289/339 | 28/30 | 0 | $0.00863 |
| haiku → luna | 28/30 | 30/30 | 289/339 | 27/30 | 0 | $0.00717 |
| haiku → terra | 30/30 | 30/30 | 321/339 | 29/30 | 1 | $0.02339 |
| luna | 29/30 | 29/30 | 277/339 | 25/30 | 0 | $0.00229 |
| luna → haiku | 30/30 | 29/30 | 309/339 | 29/30 | 0 | $0.00614 |
| luna → luna | 30/30 | 29/30 | 302/339 | 28/30 | 0 | $0.00474 |
| luna → terra | 30/30 | 29/30 | 322/339 | 29/30 | 0 | $0.02066 |
| terra | 30/30 | 30/30 | 325/339 | 30/30 | 0 | $0.01687 |
| terra → haiku | 30/30 | 30/30 | 323/339 | 30/30 | 0 | $0.02080 |
| terra → luna | 30/30 | 30/30 | 311/339 | 28/30 | 0 | $0.01945 |
| terra → terra | 30/30 | 30/30 | 328/339 | 29/30 | 1 | $0.03421 |

## Refined prompt, unused calls

All three writers received the same v5 prompt on 20 unused calls from 19 roster reps. These results measure validation, not a fully human-adjudicated action accuracy score.

| Model | Valid outputs | Actual batch cost | Cost per call |
|---|---:|---:|---:|
| haiku | 17/20 | $0.075658 | $0.00378 |
| luna | 19/20 | $0.050380 | $0.00252 |
| terra | 20/20 | $0.374827 | $0.01874 |
| terra-review | 20/20 | $0.362392 | $0.01812 |

Terra review cost is the second stage only. Terra draft plus review cost $0.737219 for these 20 calls ($0.036861 per call).

One Terra output included an extra action from another known script. The application removes that extra action only when the entire required checklist is present. Missing actions, duplicates, unknown action IDs, fabricated evidence references and unsupported omissions still fail validation. Original raw outputs are retained.

## Recommendation and limits

Use Terra for drafting and independent full-source factual review. It is materially stronger than Luna or Haiku in the equal-condition reference comparison. The extra review is a safety layer, not proof that the second answer is always correct. The v4 review introduced one false missing-video label; v5 clarified distinct playback roles and corrected that case. The untouched calls retained consistent video decisions between Terra draft and review.

Do not claim 100% real-world accuracy. Some old reference labels are ambiguous on substantive prior-call portions and conditional advancement. No reference labels were silently rewritten to inflate scores. Unsupported scripts and genuinely incomplete evidence remain unscored rather than scored as rep failures.

Full-company activation and one-week backfill remain disabled pending end-to-end release acceptance.
