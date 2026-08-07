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
- [x] GitHub PR `#128` merged as `dd6f54604f51af3eeeb54870cbc99b16a578d4cc`; its change is scoped to rep-scoring code and documentation.
- [x] Production deployment `dpl_7hDpPYncQvBqtUx3K2qsoQMdMsJN` reached `READY` and owns the canonical `sales-performance-dashboard-rose.vercel.app` alias.
- [x] Authenticated overview, rep detail, and exact call routes loaded without browser console warnings/errors; the deployment error-log scan was empty.
- [x] Live counts and representative clear, coaching-focus, needs-attention, and critical-event cases were checked after deployment.

## Production result

At the production verification snapshot, the page contained 2,572 valid V4.3 calls across 114 reps; 65 reps had at least 15 calls. That strong-evidence cohort now contained 8 Needs attention, 23 Coaching focus, and 34 No priority concern results. These groups reconcile exactly to the 65 displayed reps and replace the V4.3 saturated result. Twelve strong-evidence reps had separate critical-call alerts; 17 critical calls existed across the complete cohort.

Sarah Matte verified the corrected separation: her 77.5 overall score and 39 valid calls show `No priority concern`, while a separate `Pricing omission` card opens the exact July 31 Call 2+ assessment containing the stored quote and timestamp. Jackeline Medina verified a supported coaching-focus path: `Contract and close` averaged 37.5 across 8 observations, 6 were genuinely weak, and both coaching links open the same exact weakest supporting assessment.

The existing V4.3 n8n coordinator and worker were inspected before implementation and were not edited. The V4.4 deployment reads the same immutable call evidence, so no backlog, reprocessing window, or new workflow concurrency was introduced.

## August 7 table-layout hotfix

The manager table now uses explicit, stable column widths and wraps long main-finding explanations inside their own column. All row content is top-aligned, and narrower viewports use horizontal scrolling instead of allowing findings to overlap the recent-direction column. This presentation-only fix does not alter scores, statuses, evidence, or workflow behavior.

GitHub PR `#130` merged as `c030193f0362ac95f0c3edfb676f201cc005417d`. Production deployment `dpl_GDvhNGPJXHERazni7UcujSBVJDY5` reached `READY` and owns the canonical alias. The authenticated Rachel McKay row was measured after deployment: every cell's scroll width matched its visible width, the finding and recent-direction cells had separate non-overlapping boundaries, and the browser console and Vercel error-log scan were empty.
