# Rep Scoring V4.4 Manager Release Record

Date: August 7, 2026

## Goal and scope

V4.4 makes the completed rep-scoring evidence safe and useful for a manager review. It addresses two verified V4.3 problems: too many established reps received a concern from permissive aggregation rules, and a high-severity call event could label an otherwise healthy rep `Needs attention` while linking to an unrelated coaching example.

This is a versioned manager-decision policy over immutable V4.3 call assessments. It does not alter the DeepSeek prompt, scoring weights, stored calls, Airtable schema, source intake, Coaching, Ask Sales, Slack, Google content, or employment records. It does not launch another historical backfill.

## V4.4 decision policy

The factual 0–100 call-execution score is unchanged and remains sorted lowest first. V4.4 does not stretch scores or force a distribution.

- **Needs attention**: a call type has at least 8 valid calls and averages below 45; or at least 15 calls and averages below 55; or its newest five calls fell at least 15 points from the prior five and the newest-five mean is below 60.
- **Coaching focus**: no needs-attention condition is met, but a dimension has at least 8 observations, averages below 55, includes at least 3 Needs Improvement or Unacceptable observations, and those weak observations are at least 30% of the dimension evidence.
- **No priority concern**: neither rep-performance rule is supported.
- **Early evidence**: neither Call 1 nor Call 2+ has at least 3 valid calls.
- **Critical call to verify**: a separate call-level alert. It does not change the rep-performance status and links to the exact assessment containing the event.

The concern list remains adaptive. Zero concerns is a valid result; the page never forces three weaknesses or a negative conclusion.

## Manager experience

- The overview separates `Needs attention` from `Critical calls to verify`.
- The default manager view remains 15+ calls and lowest score first.
- Filters cover Needs attention, Coaching focus, Critical call, and No priority concern.
- Rep pages display exact recurrence counts, including how many observations were genuinely weak.
- The supporting coaching link chooses the weakest evidence-bearing example for that dimension.
- A dedicated critical-event card explains that the event is not an overall rep verdict and opens the exact flagged call.

## Why the scorer was not rewritten

The live audit found 2,501 evidence-valid V4.3 calls across 114 reps, including 65 reps with at least 15 calls. The completed evidence was sufficient; the principal defect was how multi-call evidence was converted into manager labels. Re-scoring the same calls without a completed human calibration would add delay, model variability, and n8n load without proving greater accuracy. V4.4 therefore fixes the verified decision-policy and traceability defects while preserving the auditable call evidence.

## Isolation and rollback

- V4.3 coordinator `dSULjXP2oh1kXeRb` and worker `KncPcmxT0xDQcEds` remain unchanged.
- V4.2 coordinator `53txJ8KuCRGim8LB` and worker `MZv9GY5l5HDikIql` remain available as workflow rollback.
- Dashboard rollback is the prior production deployment/commit; no data migration is required.
- The V4.4 code reads the same isolated scoring base and performs no writes.

## Verification checklist

- [x] Aggregation tests cover conservative low-score thresholds, recurring weak-evidence requirements, healthy declines, and exact critical-call linkage.
- [x] TypeScript, scoped lint, production build, `git diff --check`, and credential-pattern scan pass without a local development server.
- [ ] GitHub change is scoped to rep-scoring code and documentation.
- [ ] Production deployment reaches `READY` on the canonical alias.
- [ ] Authenticated overview, rep detail, and exact call routes load without console errors.
- [ ] Live counts and representative clear, coaching-focus, needs-attention, and critical-event cases are checked after deployment.
