# Ask Sales blind answer review

Open `ASK-SALES-BLIND-REVIEW.html` in a browser. It shows one question at a time in four batches of five.

For each question:

1. Read the authoritative rule.
2. Choose Answer A, Answer B, both acceptable, or neither.
3. Mark a serious error only for a materially wrong rule, unsafe answer, privacy issue, or wrong action owner.
4. Add a short note only when useful.

At the end, download or copy the feedback JSON. Do not open the unblind key until the review is complete.

Return the completed JSON and score it from the repository root with:

```bash
pnpm score:ask-sales-faq:v5-5:blind-review -- --feedback=/absolute/path/to/ask-sales-blind-review-feedback.json
```

The scorer rejects incomplete or mismatched feedback, unblinds only after review, checks the preregistered thresholds, and always leaves production promotion unauthorized until the owner gives separate approval.
