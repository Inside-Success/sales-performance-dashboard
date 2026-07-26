# Ask Sales blind answer review

This is the corrected provider-backed diagnostic packet. The root-level packet is invalid and superseded. Read `TECHNICAL-READOUT.md` for the verified comparison and evidence limits before drawing a production conclusion.

Open `ASK-SALES-BLIND-REVIEW.html` in a browser. It shows one question at a time in four batches of five.

For each question:

1. Read the verified rule.
2. Choose Answer A, Answer B, both usable, or neither usable.
3. Mark an answer only if it says something materially wrong or sends the rep to the wrong place.
4. Add a short note only when useful.

At the end, download or copy the feedback JSON. Do not open the unblind key until the review is complete.

Return the completed JSON and score it from the repository root with:

```bash
pnpm score:ask-sales-faq:v5-5:blind-review -- --dir=artifacts/ask-sales-faq-v5-5-blind-gate/provider-corrected --feedback=/absolute/path/to/ask-sales-blind-review-feedback.json
```

The scorer rejects incomplete or mismatched feedback, unblinds only after review, checks the fixed thresholds, independently enforces the current repeatability hold, and always leaves production promotion unauthorized until a separate approved release decision. These questions were exposed during the invalid first review, so the human result is diagnostic rather than fresh unseen promotion evidence.
