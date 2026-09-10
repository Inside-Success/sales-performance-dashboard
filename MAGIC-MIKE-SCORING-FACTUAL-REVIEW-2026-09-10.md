# Call 2 scoring factual correction — September 10, 2026

**Status: evaluation complete; candidate rejected for production. No scorer replacement or historical backfill in this phase.** The existing live V2 remains active. This branch contains experimental code, not a production mirror.

## Decision and evidence

The ordinary Sonnet 4.6 primary plus Sonnet 4.6 factual editor corrected the known Dean attribution/chronology issue in an isolated development run (48.1; no target grade). It then ran on a newly frozen 20-call sample, seed 9102027, excluding previous test source IDs and transcript hashes. The older twenty used in earlier iterations are regression evidence, not this fresh sample. Neither generation nor review prompt changed during the fresh run.

- Primary: 16 numeric scores, 4 withheld after the existing bounded retry; 9 calls used that retry.
- With editor: 14 numeric scores, 6 withheld. The editor introduced two additional withheld results and used three structural repair retries.
- Eight delivered explanations were corrected; six approved unchanged. All 14 retained numeric scores were unchanged by the editor, ranging 31.2–76. This is not evidence of better numeric calibration.
- Sample cost: $4.4232, comprising $3.0096 primary and $1.4136 editor. The editor added about 47% to primary sample cost while reducing score availability.

Direct source checks confirmed useful corrections: crediting recovered direction, distinguishing proposed parallel payment from a prospect's accepted sequence, and removing invented attribution to the prospect. They also found a reviewer error: on case 675511, the editor called a rep's 00:34:36.260 turn the prospect's turn and proposed a nonexistent 00:34:50 timestamp. Its correction was blocked. On 689516, its no-request claim conflicted with a conditional request it quoted elsewhere; malformed/orphan correction output was blocked. These failures did not reach production. Four other withheld cases failed primary evidence/request validation; they are technical withholding, not legitimate call-type exclusions.

The guards worked, but useful textual corrections do not establish that this extra model stage is a safe overall improvement. Do not publish it, deactivate the existing scorer, or use it for backfill. The sample is a frozen automated evaluation with targeted independent source checks, not twenty human-adjudicated gold assessments. No forced score distribution or increase was used as a success criterion.

## Implementation preserved for review

The isolated candidate changes four existing Code nodes and adds nine nodes (23 total): balanced, non-exhaustive observed actions; stricter counterevidence validation; unchanged one-retry path; and a bounded factual editor that can replace only allowed manager-assessment fields. The same deterministic validator recomputes the score. Invalid/uncertain edits withhold the score; compatibility coaching remains untouched.

Local code also fixes a final-band/explanation mismatch, withholds a validated score when its reviewable draft is missing, and removes an unsupported probing qualifier from generated eligibility metadata. These code-only repairs were prepared after freezing model prompts and replayed against cached outputs; they did not change numbers, eligibility, compatibility coaching or costs. They are not published either.

Weights 20/25/25/30, band values 10/32/55/76/93, caps, score-version identity, persistence behavior, caller restrictions and credential references remain unchanged. The user cancelled Sonnet 5 scoring experiments; none were restarted. Other existing production model settings, including coaching, are unchanged. Extra-thinking and DeepSeek editor prototypes were not selected.

## Verification and production

150 scoring/access/runtime tests, TypeScript and scoped ESLint passed. The isolated 23-node connection graph passed validation with zero errors/invalid connections; ordinary IF-branch warnings were not treated as errors. Cached replay covers the fresh sample plus two development cases. This is local saved-response verification, not a live release or new end-to-end candidate delivery. Earlier actual n8n runtime verification covered a previous four-node candidate only. The temporary verifier Wc6FaQJoiVARxESL remains inactive.

Natural existing-V2 proof: official 698805 → scorer 698807 (49.0) → persistence 698813 (recZhLzTUms5HYtUm) → dashboard 5878. Slack parent/thread returned ok:true, dashboard ingestion returned ok:true, and the authenticated report displayed Greg Easthouse / Homita Bam, coaching and 49.0/100. The task-owned browser tab was closed. This verifies the existing baseline only. Unauthenticated page probes reached sign-in pages; they are not evidence of protected page contents.

Live scorer remains 35bFcPYdHSADpyTN, published 7090932d-db97-40c2-8723-2071feb8ad1e. Persistence remains iG6pvqUTn0askw9y, published bd084b23-1de1-44f7-8e98-1b950f04af73. Scoped official/intake/manual/weekly workflows were active and their latest listed executions successful. No production workflow, source Google Doc, Slack delivery, historical record, compliance behavior, manager page or Ask Sales implementation changed.

## Cost, artifacts and next boundary

Cumulative metered-token estimate: **$35.2846**, including the prior $18.5675 scoring phase, rejected experiments and failed attempts. The user authorized a cumulative $40 ceiling. A separate conservative $1 reserve covers uncertain transport/internal-provider retry usage; it is not a confirmed charge. No more paid experiments are running. Prices/token estimates are not an invoice reconciliation.

Private baselines, frozen candidates, source calls, every paid response, request receipts, fresh-summary.json, fresh-independent-review.json, cached-replay-results.json and live-latest-verification.json remain under workspace root `.magic-mike-scoring-factual-2026-09-10/`. No transcripts or credentials are included in this Git change.

The next approach should simplify source attribution and evidence handling before adding another paid model pass. Preserve the failed examples as regression cases, explicitly test proposed versus agreed actions and incomplete spoken requests, and evaluate a future candidate on genuinely unused calls. Do not keep retuning against these twenty and describe them as untouched. Historical backfill still requires explicit approval. This draft must not be merged as a production release.


## September 10 Luna follow-up evaluation

The isolated source-ID/Luna candidate produced 20/20 numeric results but failed factual accuracy checks. It was not published; live V2 remains unchanged and no backfill is approved. Both temporary test workflows are inactive. Cumulative estimated tests $41.0113 plus a separate $1 uncertainty reserve against the $50 ceiling. See [Luna evaluation](MAGIC-MIKE-SCORING-LUNA-EVALUATION-2026-09-10.md) for exact scope, evidence and remaining gate.
