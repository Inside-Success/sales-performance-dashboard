# Ask Sales quality and formatting follow-up — September 16, 2026

Scope: Ask Sales only. Keep Luna medium, current provider selection, knowledge registry, coaching/report/scoring code, database/auth configuration, and collectors unchanged.

## Changes

The revamp runtime already joined paragraphs with blank lines, but the structured-answer summary rendered them inside a single HTML paragraph. Revamp summaries without legacy sections now use a memoized CommonMark/GFM renderer. Paragraphs, lists, headings, quotes, emphasis and tables retain their authored structure. Tables scroll within the answer. Raw HTML and images are disabled; links only use HTTP(S), with safe external-link attributes. Legacy structured answer cards remain on their existing path. Saved revamp answers benefit when reopened if their stored text contains paragraph breaks; previously generated single-block prose is not silently rewritten.

Draft/review prompts select presentation appropriate to the question, preserve substantive qualifications, and do not force a fixed answer template. Capability metadata explicitly refers to the assistant rather than the rep. The prompts distinguish internal inquiry from external disclosure and explain supported conditional paths without guaranteeing approval.

For continued conversations, retrieval adds a bounded independent lane from the last two user messages. It retains at most four top context hits within the existing 36-record budget, retains product-scope filtering, and never uses prior assistant statements as authoritative evidence. New-subject requests exclude this lane. This addresses planner rewrites that omit an important previous user fact, without adding another model call or question-specific regex rules.

## V5.14 comparison

Exactly 196 saved V5.14 user turns; V3 excluded. Compared against saved first-release revamp responses, not fresh regenerated responses. Alternating anonymized A/B grading by Luna medium with current retrieved evidence, followed by assistant review of grade rationales, flagged full answers and full-registry evidence. Twelve new-answer labels were manually corrected; old redacted ACH identifiers were marked unverifiable. This is model-assisted assessment, not independently human-certified accuracy. Current-source correctness and usefulness are evaluated; 91 rows have policy/date ambiguity, so this is not an isolated model or unchanged-knowledge experiment.

| Assessment | Old V5.14 | First-release revamp |
| --- | ---: | ---: |
| Correct/sufficient response | 23 | 155 |
| Appropriate clarification | 0 | 11 |
| Justified source limitation | 27 | 20 |
| Partial | 69 | 8 |
| Incorrect/context failure/unnecessary refusal | 75 | 1 |
| Technical failure | 1 | 1 |
| Unverifiable | 1 | 0 |

Band comparison: 140 improved, 52 same band, 3 worse, 1 unverifiable. Correct, appropriate clarification, and justified limitation share the satisfactory band; partial is lower; incorrect/technical failure lowest. Among 105 rows without a temporal flag: 66 improved, 38 same band, 1 worse. Do not advertise these as externally validated accuracy or attribute all gains to the model. Correctness labels include responsiveness and grounded qualification, not merely fluent text.

The three regressions were duplicate-booking guidance, an overly cautious general differentiation objection, and a provider timeout. Other flagged weaknesses included omitted follow-up context, a sharing rule overextended to internal inquiry, nurse-category guidance, greenlight text timing, cohort timing, contract scope, and a narrow reapplication exception. Their final-candidate checks and retained limitations are recorded in the release receipt. The entire 196 was not regenerated after this patch: final validation uses targeted failure cases plus unaffected questions and new paraphrases.

## Verification and release

324 Ask Sales tests passed, including actual server-rendered Markdown paragraph/list/table/link safety tests and bounded context retrieval/product/new-subject isolation. TypeScript and scoped ESLint passed. Hosted build/CI, focused paid model cases, production browser verification and exact deployment receipts are recorded in the GitHub PR and workspace final report. No local development server; no Slack writes; no n8n changes.

Comparison grading cost: $0.4533 estimated using existing recorded provider rates. Additional candidate and hosted calls are recorded separately in the private usage ledger. Raw conversations, keys and per-case grading stay in private workspace artifacts, not Git.

Rollback: revert this scoped change and rebuild production from production configuration. Do not promote the isolated preview environment. No data migration or knowledge publication is required.

## Live verification follow-up: privacy boundary

A live test caught a pre-existing address-redaction false positive: in `$30,000 reality-show VIP deliverables in a way`, the street-address regex started at the trailing `000` and matched through `way`. Removing that span destroyed the product context before retrieval. The address matcher now requires a complete numeric token not prefixed by currency, decimal/grouping punctuation, or word characters. Real street addresses remain redacted. Eleven regression tests cover grouped/ungrouped currency variants, real addresses and mixed price/address/email/credential input. No raw user text bypasses privacy filtering.

The offline evaluation snapshot now includes the privacy dependency, so changes to sanitization invalidate saved evaluation caches. The exact failed live wording and an ungrouped-currency variant are rechecked separately; prior 45-case evidence is not relabeled as testing this new input. Production release receipts and the retained failed verification answer are recorded in the workspace report/PR. This follow-up does not change pricing, model, knowledge, or coaching.
