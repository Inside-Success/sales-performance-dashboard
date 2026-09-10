# Isolated source-ID scoring evaluation

**Not a production release. Do not wire this candidate into the live scorer.** See ../../MAGIC-MIKE-SCORING-LUNA-EVALUATION-2026-09-10.md for the failed accuracy gate.

`evidence-contract.cjs` resolves a model-selected turn ID to the original full quote, timestamp and speaker. It rejects unknown IDs and commitment requests attributed to another speaker. An exact name with a role suffix is supported without fuzzy identity matching. `validate-evidence-candidate.js` is the isolated deterministic validator used for replay, including compatibility coaching fields. These files do not call APIs or persist scores.

The saved prompt/schema are the evaluated 20-call Luna arm, retained for reproducibility, not recommended configuration. Later exploratory variants are recorded privately alongside their exact paid request/response receipts. No source transcripts or credentials are committed.

Run the evidence-contract checks with:

```sh
node --test n8n/scoring-luna-candidate/evidence-contract.test.cjs
```

The unchanged rubric weights, caps and band points do not guarantee factual accuracy. Exact quotations establish source attribution, not whether the interpretation is correct. Passing these tests must not be treated as approval to publish or backfill.
