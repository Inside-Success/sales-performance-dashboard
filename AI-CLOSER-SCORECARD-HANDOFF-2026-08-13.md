# AI Closer Scorecard Focused Continuation Handoff

Date: 2026-08-13

Status: V7.1 is live; historical cohort is complete; future eligible calls continue through the live path; Coaching score display is temporarily hidden

## Purpose

Use this focused handoff when the next task concerns rep scoring, live-call processing, scorecard manager UX, score visibility in Coaching, access, cost/throughput, or the V7.1 rollback path. Read `SESSION-HANDOFF-2026-08-13.md` as the broad project anchor first.

## Product outcome

The AI Closer Scorecard is a hidden manager tool that helps a manager answer three questions quickly:

1. Which closers have the lowest evidence-supported scores?
2. How much reviewed evidence supports each score?
3. What exact recurring pattern or low-scoring calls should the manager inspect?

It is not an automatic employment decision, a forced ranking, or a rep-facing punishment system.

Tyler's stated delivery expectation is a simple 1–100 closer scorecard, shared by link and screenshot, with managers invited to request changes. The scorecard's first page should honor that simplicity; the evidence pages exist for optional verification, not as mandatory reading.

Production route:

`https://sales-performance-dashboard-rose.vercel.app/manager/rep-scoring`

## Durable owner decisions

- Keep Call 1 and Call 2+ conceptually separate; both matter.
- Call 1 is about correct fit/progression judgment. A justified rejection can be good performance.
- Call 2+ considers execution, objections, offer, contract/close, next steps, and outcome. A sale is relevant but is not automatic proof of strong execution.
- Use the Call 1 and Call 2 scripts as authoritative guidance, not rigid word-for-word checklists.
- Do not punish the rep for Zoom/transcript/speaker problems or genuine external factors.
- Do not force a fixed number of weaknesses or a bottom-percentile failure group.
- Do not make the system so lenient that routine script completion produces exceptional scores.
- Do not make it so strict that most reps are automatically labeled deficient.
- Keep the manager page minimal. Evidence drill-down is available, but the first view should be a straightforward scorecard.
- The scorecard should support investigation and training, not act as the sole reason for termination.
- Historical evidence may be retained long term.
- Live scoring must be reliable, idempotent, recoverable, and cost-aware without degrading quality.

## Current architecture

### Live n8n

| Purpose | Workflow ID | Current state |
| --- | --- | --- |
| V7.1 live coordinator | `gXGkKGtsXPudAePR` | Active |
| V7.1 worker | `QPUh149BvYlqhKOq` | Active |
| Official Coaching | `L8Nn7xncA9ZPDdWA` | Active and unchanged by scoring |
| V6.3 coordinator rollback | `EghbY2jr86yjJl4d` | Inactive |
| V6.3 worker rollback | `w8JaLibcm8zqVGP1` | Inactive |
| One-time final continuation | `80MLVQW3SdmxZzNH` | Inactive after completion |
| V7.1 audit helper | `U1qAFJ92IjypX5jv` | Inactive |

The coordinator is scheduled every five minutes. Each clear slot can admit up to 50 calls as five workers of at most ten calls. Single-flight lease checks prevent overlap. Provider balance, source, ledger, lease, and invariant failures fail closed.

The fixed historical cohort is closed. Post-cutoff eligible calls are the live stream and are not constrained by the historical testing cap.

### Scoring contract

- Immutable scorer: `rep-reviewer-v7.1-shadow-1`
- Primary model produces structured criterion evidence rather than directly choosing the final number.
- Deterministic code maps criterion states through anchors `0/20/45/68/84/100`.
- One primary request is used for ordinary calls.
- A short verifier runs only for a material risk, contradiction, or transcript limitation.
- Transcript/speaker uncertainty is quarantined or excluded rather than scored against the rep.
- Exact idempotency and leases prevent routine double purchase.
- Retry duplicates are reconciled by stable source identity; identical copies collapse and conflicting copies fail closed.

### Data boundary

The scorer reads the approved Zoom Closer source and transcript documents. Its score/ledger/quarantine data remains in the isolated rep-scoring Airtable base. It does not write back into the source call records, Slack, or Google knowledge sources.

Do not record credential values in documentation. Use only task-specific credentials already configured for this system when authorized work requires them.

## Historical cohort and evidence quality

Fixed cohort:

- Start: `2026-08-03T04:00:00.000Z`
- End: `2026-08-13T07:14:07.298Z`
- Unique source calls: 1,660
- Scores: 1,483
- Fair terminal exclusions: 188
- Extra immutable retry rows: 11 across 10 source IDs

Score distribution:

- Minimum: 12.3
- 10th percentile: 54.8
- 25th percentile: 73.1
- Median: 80.6
- 75th percentile: 83.7
- 90th percentile: 84.0
- Maximum: 85.4
- Mean: 75.1
- Below 75: 428
- Below 60: 206
- At or above 90: none

Manager aggregation with sufficient evidence returned 57 needs-attention, 1 coaching-focus, and 12 monitor results. These are absolute evidence rules, not a percentile quota.

Exclusions were 71 unmapped/insufficient speaker-resolution cases, 82 ambiguous multi-rep cases, and 35 calls with too few valid dimensions. These exclusions protect fairness and should not be relabeled as rep failures.

## Manager UI contract

### Scorecard page

- Sort lowest score first.
- Default to reps with at least 15 valid calls.
- Keep 8+, 3+, all-evidence, and search controls.
- Show only closer, 0–100 score, reviewed-call count, and review action in the primary table.
- Do not put workflow versions, backfill progress, raw validation counters, or internal status language in the manager view.

### Rep page

- Overall score and valid-call count
- Call 1 and Call 2+ split
- Concise manager summary and next action
- Only evidence-supported recurring weaknesses and strengths
- Lowest-scoring calls for review
- No deterministic requirement to invent three weaknesses

### Call page

- This-call score and plain-language label
- Manager takeaway
- Opportunity/outcome/progression context
- Material improvements and strengths
- Collapsed scoring audit when deeper verification is needed
- No raw JSON and no empty technical sections

### Navigation

The scorecard subtree has immediate route loading feedback and deterministic scroll-to-top behavior. If a future report says the page appears only after scrolling, verify the current production browser behavior and runtime logs before editing.

## Exact access

Scorecard access requires normal Magic Mike authentication plus exact membership in `REP_SCORING_ADMIN_EMAILS`.

Current approved emails:

- `syed.haider@insidesuccess.com`
- `tyler@mawercapital.com`
- `jawad.saghir@insidesuccess.com`
- `raul.rios@mawercapital.com`
- `rich.allen@mawercapital.com`
- `mike@insidesuccesstv.com`

The page is absent from normal navigation and protected with noindex behavior. Do not add a public navigation link or broaden access without authorization.

## Coaching integration

The official Coaching workflow is not edited by the scorecard. The dashboard performs an optional read-only Call 2+ lookup.

When enabled, a numeric score appears only if exactly one valid V7.1 assessment matches both:

1. source Airtable record ID; and
2. automation key.

It must also pass scorer version, call type, scored status, numeric validity, internal consistency, and duplicate-agreement checks. A missing, ambiguous, conflicting, old-version, Call 1, quarantined, or lookup-error case shows no score and never blocks Coaching feedback.

Current production decision:

`REP_SCORING_COACHING_SCORE_ENABLED=false`

Therefore the numeric score is currently hidden in Coaching while the AI Closer Scorecard and scoring workflows remain live. Re-enable only after explicit owner instruction.

## Current verified health snapshot

Read-only check on 2026-08-13:

- n8n health: `ok`
- V7.1 coordinator: active
- V7.1 worker: active
- Coaching: active
- V6.3 coordinator/worker: inactive
- Latest ten coordinator executions: success
- Latest listed live worker executions: success
- Coordinator error-filtered list: empty
- Worker error-filtered list: empty
- Current Vercel main deployment: `dpl_DhSTRJqnf8sj6W3ds8Kn1dzUBDHv`
- Deployment: `READY`, canonical alias attached
- Vercel error/fatal logs in checked two-hour window: none

Recent live proof includes coordinator execution `494326`, which selected two post-cutoff live calls and no historical calls, and worker execution `494328`, which completed both. Later live worker executions also succeeded. A live call that reaches a fair exclusion such as insufficient valid dimensions is evidence that the fail-closed path worked, not necessarily that the pipeline failed.

## Cost, throughput, and scheduling lessons

- Earlier broad retries and double-review architectures consumed significant real DeepSeek cost.
- Never reprocess an already valid immutable V7.1 score just to refresh a dashboard.
- Keep one primary assessment per ordinary call and use the verifier only behind the material gate.
- Use atomic run keys, per-call claims, leases, bounded workers, and exact cohort boundaries for any future batch.
- Aggressive historical backfill concurrency was temporary. Normal live processing must favor reliability and low execution overhead.
- The current five-minute coordinator cadence is healthy but produces many no-op n8n executions. The owner wants this revisited.

### Pending schedule decision

Do not change the interval immediately from this handoff alone. First compare at least these options against current live volume and Coaching timing:

1. a less frequent scheduled refill with a larger safe per-run admission cap;
2. an event-driven trigger from the existing Coaching/call intake path with a low-frequency reconciliation schedule;
3. a hybrid queue/refill design that preserves isolation and exact idempotency.

The preferred solution should reduce n8n execution count without delaying scores unreasonably, coupling score failure to Coaching, or risking duplicate purchases. Verify current call arrival patterns before recommending an interval.

## Rollback

If V7.1 live scoring has a material fault:

1. deactivate `gXGkKGtsXPudAePR`;
2. preserve the isolated V7.1 evidence rows;
3. only reactivate V6.3 coordinator `EghbY2jr86yjJl4d` and worker `w8JaLibcm8zqVGP1` after verifying their published versions and avoiding simultaneous triggers;
4. revert the manager application release only if the UI/data contract is implicated;
5. leave the official Coaching workflow unchanged.

To change only Coaching score visibility, use the server toggle and redeploy. Do not modify n8n.

## What not to do

- Do not start another historical backfill; the approved fixed cohort is complete.
- Do not delete retry, quarantine, or historical rows to make counts prettier.
- Do not force the lowest 10–15% into an underperformer label.
- Do not add Call 1 scores to Coaching; Coaching is Call 2+ only.
- Do not show a score when exact identity matching is ambiguous.
- Do not modify the official Coaching prompt/workflow to attach this score.
- Do not expose technical scoring details on the manager landing page.
- Do not turn the Coaching score overlay on without explicit permission.
- Do not assume a five-minute no-op run is a failure; inspect selection/output and leases.

## Likely next task

The most likely next task is to reduce the live coordinator's n8n execution consumption while preserving timely, isolated, exact-once V7.1 scoring. The first turn in a fresh chat must still remain read-only: refresh current live executions and call arrival volume, explain the options simply, and wait for the user to authorize a change.
