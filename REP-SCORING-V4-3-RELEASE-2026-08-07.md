# Rep Scoring V4.3 Release Record

Date: August 7, 2026

## Goal

V4.3 corrects the manager experience and scoring bias observed after the V4.2 backlog became large enough to inspect. V4.2 was operationally reliable, but almost every established rep appeared to need attention and the results were compressed into a narrow middle range. V4.3 keeps the proven safety architecture while making the rubric specific to Inside Success TV and separating an imperfect call from a recurring performance concern.

This remains a supporting manager signal. It is not an employment verdict and does not write to source calls, Coaching, Ask Sales, Slack, Google content, or employment records.

## Scoring contract

- Scorer: `rep-reviewer-v4.3`
- Prompt: `rep-prompt-v4.3-istv-anchored`
- Rubric: `rep-rubric-v4.3-istv-anchored`
- Weights: `rep-weights-v1`
- Band points: `rep-band-points-v1`
- Config: `rep-scoring-config-v9-istv-anchored`
- Model: `deepseek-v4-pro`, non-thinking, temperature zero
- Final score: deterministic dimension-level median consensus from three independent evidence-valid reviews
- Fixed analysis start: July 18, 2026 at midnight America/New_York

V4.3 preserves the V4.2 dimensions and weights because they match the actual sales process: discovery, qualification, authority, value, next steps, agenda, pricing, objection handling, Green Light Letter positioning, onboarding, and contract/close. The change is the rubric, not a redistribution of points.

Every dimension now has an ISTV-specific meaning. The prompt no longer says the rubric is generically strict or tells the model to default downward. It selects the best-supported band and distinguishes adequate execution from exceptional execution. It also does not punish a rep for prospect outcome, lead quality, call length, prerecorded material, or topics the rep could not reasonably reach.

A dimension may be `not_applicable` only when it was not fairly observable. At least three dimensions must remain observable or the call is excluded. This prevents a prospect-controlled early ending from becoming a collection of artificial zeroes.

Speaker resolution, provider retries, immutable versioned writes, per-call leasing, quarantine, and three-review consensus remain unchanged. Exact timestamp/speaker/quote validation is still mandatory for any evidence that contributes to a score. V4.3 makes the validator more resilient by excluding a malformed dimension or unsupported critical event from consensus while retaining unrelated evidence-valid dimensions; a call still needs two valid reviews and at least three supported dimensions or it is quarantined.

## Manager decision policy

The dashboard still shows the factual 0–100 score, but a score alone no longer labels a rep.

- **Needs attention**: a call type has at least 8 valid calls and averages below 50; or it has at least 15 valid calls and averages below 60; or a separately supported material decline or verified high-severity call event exists.
- **Coaching opportunity**: no needs-attention rule is met, but a dimension averages below 60 across at least 5 valid observations.
- **No supported concern**: neither rule is met.
- **Early evidence**: neither Call 1 nor Call 2+ has 3 valid calls.

These rules do not force a quota or a fixed number of weaknesses. A strong rep may have zero recurring concerns. The thresholds use the rubric's factual band boundaries and stronger evidence for borderline results. They are server-configurable without rewriting aggregation code.

Call 1 and Call 2+ remain separately calculated. When both are present, the overall score is their equal-weight mean so call volume cannot make one stage overpower the other.

The manager table defaults to 15+ valid calls and remains sorted from lowest score to highest. Managers can broaden it to 8+, 3+, or all evidence. The overview shows only rep, score, evidence amount, main reason, recent direction, and review link. Rep pages retain strengths, supported concerns, next action, trends, and collapsed call evidence.

## n8n architecture and rollback

- V4.3 coordinator: `dSULjXP2oh1kXeRb`
- V4.3 worker: `KncPcmxT0xDQcEds`
- Read-only calibration audit: `R336QopOQmxehMCR` (inactive)
- Repeatability coordinator B: `fECcidhT2mbaUOPs` (inactive)
- V4.2 coordinator rollback: `53txJ8KuCRGim8LB`
- V4.2 worker rollback: `MZv9GY5l5HDikIql`
- V3 pair remains unchanged.

The V4.3 worker and coordinator were cloned from the verified V4.2 graphs. V4.3 has independent idempotency keys and ledger rows. Its historical scan rotates one completed day at a time from the fixed launch date through the current day, plus the newest two hours. Clear slots admit at most 160 calls in no more than eight 20-call workers. A 25-minute coordinator timeout and active-lease preflight prevent unsafe overlap. Busy slots succeed as no-ops.

Rollback requires deactivating the V4.3 coordinator, restoring `REP_SCORING_SCORER_VERSION=rep-reviewer-v4.2`, redeploying the last known-good dashboard artifact, and reactivating the V4.2 coordinator. No V4.2 rows are edited or deleted.

## Controlled verification

The first V4.3 coordinator run dispatched 12 calls in four three-call workers. All four workers succeeded and all 12 calls reached a final ledger state: 9 evidence-valid scores and 3 safe quarantines. The valid sample ranged from 44.9 to 70.3 with a 60.4 mean and 61.3 median. On six calls that also had V4.2 scores, the mean change was +7.1 points, ranging from -3.7 to +20.0. This is evidence that the anchor correction is material but not a blanket uplift.

The first repeat pass exposed that one malformed dimension quote could invalidate an otherwise evidence-supported review and make calls alternate between a score and quarantine. The validator was corrected to exclude only the unsupported dimension or critical event, disclose that correction, and retain the call only when two reviews still contain at least three evidence-valid dimensions.

The final identical-call passes used isolated versions `rep-reviewer-v4.3-calibration-d` and `rep-reviewer-v4.3-calibration-e`. Both produced 10 valid scores and zero quarantines across the same 10 calls, with zero route flips. Score spread had a 2.5-point median, 6.2-point 90th percentile, and 10-point maximum. Two raw display bands changed; those changes do not independently change the multi-call manager status. Calibration-only rows remain excluded from the dashboard.

This is a bounded operational and directional gate, not proof that every human judgment is correct. The short human review in `REP-SCORING-CALIBRATION.md` remains the correct way to challenge individual labels or evidence after the initial release.

## Release checklist

- [x] V4.2 and V3 rollback paths preserved.
- [x] V4.3 worker and coordinator created as separate versions.
- [x] Source remains read-only; output remains in the isolated scoring base.
- [x] Both production workflows validate with zero structural/runtime errors.
- [x] Connections read back and match the V4.2 proven topology.
- [x] Controlled 12-call load completed without a worker crash.
- [x] Dashboard policy has unit coverage for low results, sustained borderline results, recurring coaching opportunities, clear results, critical events, call-type weighting, and separate trends.
- [x] Repeatability result recorded.
- [ ] Production build, GitHub, Vercel, authenticated browser, and runtime-log checks recorded.
- [x] V4.3 backfill started; controlled production coordinator `452585` safely dispatched 36 calls in two isolated workers before the schedule resumed.
