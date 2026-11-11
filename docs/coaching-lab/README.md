# Coaching foundations evaluation — isolated only

Latest isolated phase: [November 11 interaction-first evaluation](INTERACTION-COACHING-2026-11-11.md). Earlier results, budgets and experiment procedures below are historical records, not the latest candidate verdict. The current authorized cumulative ceiling is $100, with a $10 incremental cap on this round. Production remains unchanged.

Authorized November 5, 2026. Scope: substantive Call 2 selling for main documentaries, Next Level CEO, and reality. No Call 1 rollout, production publication, Slack delivery, source mutations, or accepted report writes.

## Preserved invariants

Observed concern, actual response, handling quality, resolution and payment are separate. Full transcripts and counterevidence remain available to both stages. Evidence and source identity are immutable during wording repair. One reviewed record owns all rendering. Production checkpoints, owner leases, uncertain-write holds, manual/official separation, safety and delivery receipts are untouched.

## Experiment

Freeze source identities and transcript digests before evaluation. Hold out twelve sources (four per family) from prompt development. Use a smaller balanced architecture screen with identical models, then a bounded model screen with identical prompts. Extend the selected configuration across development and untouched cases. Existing reports are a historical comparator, not ground truth. Flag known development examples and prior exposure. Never infer the offer from title or price alone.

Compare integrated coach + substantive reviewer with evidence analyst + coach/final reviewer. Second stage always receives full evidence and the same governed knowledge. Four learning layers describe reasoning, not four required provider calls. Retain one owner per lesson: objection-specific teaching stays with that objection; distinct transferable lessons appear once afterward. Focus points to an entry rather than repeating its prose.

Assess false/missed objections, actual-response fidelity, material unsupported claims, chronology/recovery, policy applicability, justified criticism, teaching usefulness and readable non-repetitive output. Do not optimize for mandatory findings, model agreement, a single exact expected answer, or test count. Record raw failures and review-introduced regressions. Unknowns and multiple defensible approaches are valid.

## Cost and privacy

Hard experiment ceiling $40, not a target. Reserve conservative upper bounds before each paid request, save intent before send, settle from usage receipts, and hold uncertain requests without blind retry. Keep transcripts, prompts derived from the private Tyler repository, private policy snapshots, outputs, credentials and receipts outside public Git. No local development server.

## Release boundary

This experiment can recommend a candidate; it cannot establish increased sales or authorize production deployment. Production acceptance later requires backward-compatible schemas, explicit adapters for all new prose fields, manual/automatic safety and repair regressions, authenticated presentation, real delivery receipts and separately approved rollout/rollback.

## Current experiment record

A 36-source manifest (14 main documentary, 8 Next Level CEO, 14 reality) was frozen with 24 development and 12 held-out sources. Selection is by source identity within families, not report outcome; known prior examples are outside the holdout. Full source documents are kept private; model inputs remove prior AI summaries before the Full Transcript boundary. The initial three-case transport smoke run used the older scoped knowledge selection and is excluded from the subsequent controlled comparison. Both comparison arms use the same November source additions and prompt digest.

The experiment's provider fixture is separate from production. It has no report, database, Slack or production callbacks, requires a random token and disables paid HTTP retries. A single local runner lock, saved exact-request intent and usage receipts prevent blind replay; an uncertain response holds the request for execution reconciliation. Reusing a receipt has zero incremental cost. The actual production checkpoint transport remains unchanged.

## Reproducing an authorized run

The generic runner expects ignored `.private-coaching-lab/{corpus.json,prompts.cjs,transport.json,ledger.json}`. Supply an experiment-authorized OpenAI key via `COACHING_LAB_OPENAI_API_KEY`, never in command arguments or Git. The private prompt adapter exports `system` and `prompt(call, stage, prior)`; the corpus contains immutable source blocks and a split. Do not recreate the ledger to resume. Recover existing receipts and reconcile uncertain requests first.

Run `node --test scripts/coaching-lab/contract.test.cjs` before paid requests. An attended command is `node scripts/coaching-lab/runner.cjs integrated sonnet opus <development-source-ids>`, or `analyst` for analysis followed by composition. At most two independent calls run concurrently; stages of each call remain sequential. The runner never calls a production publisher. Only add a holdout unlock file after recording the selected configuration and frozen prompt hash. Validation proves structure/reference existence, not semantic accuracy.

Pricing is usage-based standard API pricing, checked November 5 against provider documentation. Any provider timeout, missing usage or receipt identity mismatch remains a reserved hold; there is no automatic replay. Read-only n8n execution reconciliation is needed for webhook timeouts. Claude cache writes/read tokens and OpenAI reported cached tokens are counted separately; failed generations with a valid usage receipt still count toward spend. These test costs do not include existing production spend.

## Frozen foundation and acceptance contract

`foundation.cjs` composes ordered source layers only when their content matches the recorded digests. The private pack snapshots principles/taxonomy, Tyler's foundations, offer policy, November source updates, current commercial guidance and the report contract. It does not depend on a temporary clone remaining available. Refactoring these layers preserved the exact experiment system digest; no candidate received a different prompt as a result.

`acceptReview` rejects contradictory verdicts, unsupported evidence references and silent eligibility changes. `usage.cjs` accounts separately for OpenAI fresh input, cache writes, cache reads and output. The first OpenAI receipts revealed `cache_write_tokens`; their initial local estimates used the older field name and are reconciled from saved raw receipts without paid re-requests. Both the original and corrected accounting are retained privately.

See [production integration boundary](INTEGRATION.md) for the explicit compatibility and safety changes required before this report contract can be deployed. The original experiment did not modify those consumers; the November 6 follow-up adds isolated candidate readers and transport adapters, without deploying them.

## Evaluation freeze and held outputs

Before opening the twelve held-out sources, two finalists were recorded: integrated Terra/Terra and Haiku-medium/Terra. Both receive the same frozen source pack and coaching prompts. This is a comparative holdout used to choose a configuration, not an independent accuracy guarantee after selection. No coaching-prompt edits are made in response to these twelve outputs.

A complete paid reviewer response can still fail acceptance. Eligibility disagreement remains held for adjudication, with both outputs preserved outside accepted results. Rendering validation runs before saving an accepted result. An output hold does not retry the model or discard sibling cases; uncertain transport remains a hard stop for that worker. Any held candidate inspected by an evaluator is recorded as a proposed, rejected output, never counted as delivered or accepted.

Final presentation places lessons about repeating good practice after other distinct lessons, using a stable rendering order without editing the reviewed prose or mutating the accepted object. This display-only change was made after comparison; it does not change frozen coaching prompts or justify new model-quality claims.

See [completed findings and recommendation](RESULTS.md). The isolated study is complete; no production rollout is authorized or claimed.
