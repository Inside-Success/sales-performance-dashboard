# Magic Mike scoring Luna evaluation — September 10, 2026

**Decision: not ready for historical backfill. No production scorer replacement was released.** Existing live V2 remains active. This is an evaluation record, not a deployment announcement.

## What was implemented and tested

- Created and verified a Moonis-owned OpenAI credential in the Moonis n8n project. Luna API access works. The key is not in this repository.
- Built an authenticated, isolated Luna review workflow. Its only external operation is a model request; it has no report, score persistence or notification nodes.
- Built source-ID hydration: code supplies the actual transcript text, timestamp and speaker; the model selects IDs. Unknown IDs, wrong-speaker asks and missing evidence are rejected. Transcription punctuation is not used to decide whether a spoken request exists.
- Tested Luna medium reasoning on all twenty previous sample calls, including the six previously withheld by the primary/editor pipeline. This twenty is now a regression sample, not untouched data. Reused cached Sonnet 4.6 primary responses to avoid paying to regenerate them.
- All twenty now produce numeric results in isolated validation, ranging 37.8–76. Nine additional comparison calls also produce numbers after the role-suffix hydration correction. This fixes the observed technical availability problem in the sample; it does not prove factual accuracy or guarantee every future provider request succeeds.
- Eight source-contract unit tests pass. The twenty-call cached replay preserves compatibility coaching and passes the existing pure persistence mapping without writing any records. No new frontend behavior was implemented.

## Independent accuracy findings

Luna is **not approved as the sole factual gate**. On call 675511 it changed 76 to 59 by treating an incidental remark as an abandoned primary objection, despite the adjacent explanation and prospect response. On call 689516 it denied a commitment ask despite a conditional commitment question elsewhere in the transcript. A later Luna development run still made that omission claim and yielded 49. Exact source IDs prevented fabricated quotations but did not prevent these interpretation errors.

An exploratory Luna-plus-Sonnet adjudication restored the known two cases and produced twenty numeric results. That extra stage added cost and was not adopted as a validated production pipeline. A simpler direct Sonnet 4.6 review was also tried to avoid stacking reviewers. In its final development check, Dean's assessment still described the tier discussion as unprompted and attributed the rep's suggested use cases to the prospect's goals. Reading the full transcript confirms those premises are unsupported. The unchanged 48.1 numeric score does not make that explanation accurate. The latest simplified candidate therefore failed its development gate; it was not rolled forward to another paid twenty-call run.

Native Anthropic structured output rejected the assessment schema as too large to compile, including a nullable-field simplification. These requests returned API errors without metered token usage. Plain JSON review completed, but the factual failure above remains. Earlier high-reasoning Luna output-limit failures and all other charged experiments remain included in cost accounting.

There is no human-adjudicated gold score for every call. This record makes a narrower finding: coverage improved in the isolated sample, while specific reproducible factual errors prevent release. Do not describe the exploratory double-review arm as independently certified, or assume a wider score range proves fair grading.

## Production and boundaries

Final read-only comparison found the scorer, shared provider, persistence and official workflow nodes/connections/settings unchanged from the captured baseline. Scorer 35bFcPYdHSADpyTN remains active on its existing V2. Both temporary test workflows nSomjtQ3i1TDw0S8 and kIHkG6gsXYwWNnqJ are deactivated. The created OpenAI credential remains available for future authorized use.

Latest scorer 699495 and persistence 699498 are successful; no newer natural Call 2 scorer execution appeared during this phase. Official execution 702251 encountered an Airtable-trigger 502 before processing a call. A subsequent official execution 702285 succeeded on the Call 1/no-show route; that is not new Call 2 scoring evidence and does not establish whether the failed poll had any pending records. No unrelated CRM workflows were inspected or changed.

No historical backfill, report rewrite, Slack message, Google Doc edit, compliance change, Ask Sales change, dashboard change or production model swap was performed. Existing baseline scoring behavior, including its possible technical withholding, remains; the sample improvement is not live.

## Cost and next gate

This phase's metered-token estimate is **$5.7267**. Cumulative testing estimate is **$41.0113**, below the authorized $50 ceiling, plus a separate $1 uncertainty reserve that is not a confirmed charge. The initial twenty-call Luna review itself cost $0.1340; the rest includes development attempts, additional calls and Sonnet comparisons. These are token-based estimates, not a reconciled invoice. No paid tests remain running.

Do not approve the 601-call backfill from this result. The remaining requirement is factual reliability of the review, not obtaining a numeric output or raising grades. Preserve these failures as regressions and verify any subsequent candidate against them before spending on another fresh sample. Production release, new genuine-call verification and historical backfill have not occurred for this candidate.

Exact private request/response receipts, frozen sample IDs/hashes, comparisons, full transcripts, replay results, workflow baselines and final health/cost records are under `.magic-mike-scoring-luna-2026-09-10/` at the workspace root. This draft PR must not be merged as a production release.
