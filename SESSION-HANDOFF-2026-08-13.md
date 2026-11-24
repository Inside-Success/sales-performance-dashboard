# Magic Mike Complete Session Handoff

Date: 2026-08-13

Status: canonical continuation entrypoint for the complete Magic Mike project

Scope: Coaching, AI Closer Scorecard, Ask Sales FAQ, hidden manager/admin pages, shared dashboard infrastructure, and connected production workflows

## First-turn rule

The next Codex chat must begin with read-only orientation.

1. Read this file completely.
2. Read `AI-CLOSER-SCORECARD-HANDOFF-2026-08-13.md` completely.
3. Read `MAGIC-MIKE-PROJECT-HANDOFF-2026-07-30.md` completely for the full Coaching and Ask Sales architecture and history.
4. Inspect the current Git boundaries and dirty state before relying on paths below.
5. Re-check any live fact that matters to the next task.
6. Briefly summarize the complete current state, then wait for the user's next prompt.

Do not implement, deploy, edit production, trigger workflows, or write to connected services on that first turn.

## Non-negotiable operating rules

- Treat every part of Magic Mike as live production.
- Start read-only and verify current state before relying on an older snapshot.
- Never start a local development server anywhere inside the `lil rudy` workspace. It can crash the user's laptop.
- Slack and Google knowledge sources are read-only unless the user authorizes an exact write. Do not send Slack messages, edit Docs/Sheets/Drive, or alter sharing without that authorization.
- Use the relevant n8n skills and the n8n MCP/global MCP path before changing n8n or connected systems.
- Do not expose API keys, personal access tokens, credential contents, Auth secrets, environment values, or other secrets. Some were supplied earlier in the conversation; they must never be copied into documentation or chat output.
- Preserve unrelated dirty/untracked work and rollback paths. Never use destructive Git commands to simplify the workspace.
- Never use `.first()` as a multi-item state or metadata fallback in n8n. State and content must remain aligned item by item.
- Make the smallest coherent production change, validate it without a local server, update the relevant Markdown record, push only intended files, and verify the production alias after authorized implementation.
- Separate verified facts, historical facts, inference, open questions, and user decisions. Do not manufacture problems or claim certainty that was not proved.

## Project and repository map

Workspace root:

`/Users/moonishaider/Desktop/upwork/Inside success tv/lil rudy`

The workspace root is not itself a Git repository.

### Dashboard/runtime repository

- Canonical local checkout: `/Users/moonishaider/Desktop/upwork/Inside success tv/lil rudy/sales-performance-dashboard`
- GitHub: `https://github.com/Inside-Success/sales-performance-dashboard`
- Production: `https://sales-performance-dashboard-rose.vercel.app`
- The canonical checkout was dirty when this handoff was created. Its modified files belonged to existing work and were not touched.
- This handoff was prepared in the clean worktree `/Users/moonishaider/Desktop/upwork/Inside success tv/lil rudy/sales-performance-dashboard-rep-scoring-v7-2026-08-13`.

### Ask Sales knowledge/governance repository

- Local checkout: `/Users/moonishaider/Desktop/upwork/Inside success tv/lil rudy/FAQ Chatbot`
- GitHub: `https://github.com/Inside-Success/faq-chatbot`
- This contains governed sales knowledge, source lineage, compilers, tests, evaluation records, and Ask Sales handoffs.

### Important source and history locations

- Broad Magic Mike history: `MAGIC-MIKE-PROJECT-HANDOFF-2026-07-30.md`
- AI Closer Scorecard current launch record: `REP-SCORING-V7-1-PRODUCTION-LAUNCH-2026-08-13.md`
- Hidden manager/admin routes: `docs-hidden-pages-access.md`
- Rep-scoring operations/history: `docs-rep-scoring-admin.md`
- Ask Sales current production/governance: `docs-ask-sales-faq-v5-14-production-cutover.md`, `docs-ask-sales-knowledge-refresh.md`, and `docs-ask-sales-faq-admin-and-adoption.md`
- Ask Sales chronological history: `../FAQ Chatbot/POST-LAUNCH-CONTINUATION-HANDOFF-2026-07-13.md` and `../FAQ Chatbot/CURRENT-PENDING-WORK.md`
- Coaching source scripts used to redesign scoring:
  - `/Users/moonishaider/Downloads/Rudy's Master Script - CALL #1.docx`
  - `/Users/moonishaider/Downloads/INSIDE SUCCESS TV - CALL SCRIPT #2 .docx`
- Initial rep-scoring research inputs:
  - `/Users/moonishaider/Downloads/rep-scoring-architecture-questions.md`
  - `/Users/moonishaider/Downloads/rep-scoring-followup-questions.md`
  - the nine Claude-authored planning/prompt files formerly supplied in the workspace's `scoring reps/` folder

These inputs are historical design evidence. Do not blindly trust a Claude plan or an older architecture record when live code, workflows, and current owner decisions disagree.

## What Magic Mike contains

Magic Mike is one authenticated production dashboard with two main products and several hidden management surfaces.

### Coaching

Coaching processes Zoom sales calls through a multi-stage n8n pipeline. It generates feedback reports, accepts manual/self-submitted feedback, tracks verified report use, and supports manager analytics. The active official Coaching workflow is not the old single-agent grader; the pipeline separates intake, scoring/feedback, output translation, storage, and downstream delivery.

Key production workflow IDs recorded by the canonical handoff:

| Purpose | Workflow ID | Expected state |
| --- | --- | --- |
| Zoom intake/reconciliation | `qMQYNQtQbRZWjtG2` | Active |
| Official Coaching generation | `L8Nn7xncA9ZPDdWA` | Active |
| Manual feedback | `BMRrGxHyXMcgO6j3` | Active |
| Weekly summary | `sNPNGveZvEiRlU69` | Active |
| Provider/router | `CiDBJxWJZCDRJChK` | Active |
| Feedback support | `Vt1Ze3LiWynk7mao` | Active |

The older rollback workflow IDs `h7NGOb3vvTbZkVRU`, `hZVoiZ8siQsCu3a6`, and `JtkROaJUV7QCB8i9` must remain inactive unless a separately verified rollback is authorized.

### Ask Sales FAQ

Ask Sales is the internal authenticated sales assistant at `/ask-sales-faq`. Its current production runtime is V5.14, with V3 preserved as selector-based rollback. It answers from governed evidence and must route safely when current evidence cannot support an answer. It must not pretend to perform operational actions.

The governed knowledge refresh runs daily at 9 PM Miami and uses read-only Slack and Google collection, DeepSeek proposal generation, human review, immutable release previews, protected GitHub publication, Vercel verification, and fail-closed stopping rules. Automated knowledge approval is not allowed.

The old 9:20 PM automated quality judge `Flp8t7eNbHWu0z0O` remains inactive because its judgments were noisy and later executions failed after evaluation. Quality review is manual/on demand using stored production evidence.

The broader policy-matching replacement plan remains intentionally pending. It must not be implemented automatically; first prove a current systemic gap after accounting for V5.14 and the governed refresh path.

### Hidden manager/admin pages

Current route inventory and access rules are documented in `docs-hidden-pages-access.md`.

Important pages include:

- `/manager/usage` — Coaching usage analytics
- `/manager/sales-correlation?days=7|14|30|90` — Sales Impact
- `/manager/compliance` — compliance review
- `/manager/rep-no-show` — rep no-show impact
- `/manager/rep-scoring` — AI Closer Scorecard
- `/ask-sales-faq/admin` — Ask Sales quality and operations
- `/ask-sales-faq/admin/usage` — Ask Sales adoption and usage
- `/ask-sales-faq/admin/knowledge-refresh` — governed source updates

These routes are hidden from normal rep navigation and use protected authentication/noindex behavior. Ask Sales admin pages deliberately return 404 to authenticated non-admins.

Sales Impact reads the current Google Sheet in read-only mode on each load. Its retained dashboard snapshot is availability fallback only when the live read fails or is unusable.

## AI Closer Scorecard: goal and project arc

The scorecard started as a hidden admin-only Coaching page to help managers identify closers who may be struggling, understand why, and decide where to investigate or train. It is supporting evidence, never an autonomous firing or personnel-decision system.

The user's durable product requirements are:

- make it simple enough for non-technical managers such as Mike and Rich;
- show a straightforward 0–100 scorecard sorted lowest to highest;
- retain evidence drill-down without overwhelming the first page;
- evaluate Call 1 and Call 2+ fairly and separately before combining them;
- use absolute evidence rules, not a forced bottom percentile;
- do not invent a weakness when a rep has none;
- do not reward every script-following call with an exceptional score;
- do not punish a rep for Zoom/transcript/speaker failures or external factors;
- a good Call 1 can be a correct progression decision, including a justified rejection;
- a difficult prospect may reasonably require repetition or a longer call;
- a Call 2 sale does not automatically prove strong execution, and a no-sale does not automatically prove poor execution;
- keep the score linked to exact call evidence and the correct rep/call identity;
- remain isolated from the Coaching generation workflow and the Ask Sales system;
- keep live-call scoring reliable, idempotent, cost-aware, and recoverable.

Tyler's final stakeholder expectation was deliberately modest: an AI Closer Scorecard that gives each closer a 1–100 score, sorts the table so struggling closers are easy to find, and lets the managers ask for changes. He preferred receiving the link and a screenshot rather than a Loom. That expectation is why the manager landing page was simplified; deeper evidence exists only when a manager chooses to open it.

### What failed in earlier iterations

Earlier V3/V4/V4.3/V5/V6.3 attempts produced important lessons:

- tiny or confusing samples made dashboard counts misleading;
- slow serial backfills could take many hours and caused timeout/auto-deactivation failures;
- poorly separated coverage, backlog, and scored-call metrics confused the owner;
- scores clustered too high or too low and sometimes made nearly everyone look bad or nearly no one look concerning;
- percentile-based priority could mark a bottom group even when everyone was competent;
- transcript and speaker uncertainty could be mistaken for rep performance;
- manager pages contained technical versions, raw JSON, empty sections, and unclear labels;
- double-reviewing ordinary calls inflated cost without proportional quality;
- overlapping launchers could create retry rows even though per-call idempotency prevented a full duplicate purchase;
- broad backfills using an immature architecture consumed substantial real DeepSeek cost.

Those versions are historical evidence, not the current live architecture.

### V7.1 scoring design

V7.1 uses the Call 1 and Call 2 scripts as guidance rather than rigid word-for-word checklists. The model returns structured evidence for each criterion: coverage, specificity, material gap, confidence, and quotes/context. Deterministic code—not the model—derives criterion states and the final score using anchors `0`, `20`, `45`, `68`, `84`, and `100`.

Ordinary script completion is competent. Strong execution requires completeness and specificity. Exceptional scores are deliberately rare. Transcript/speaker failures remain exclusions. A fair Call 1 rejection can score well. Call 2+ outcome is considered without substituting for execution quality.

Each ordinary call uses one primary AI assessment. A short second verifier runs only when a material-risk gate is crossed, so quality protection is selective rather than routine double-scoring. Temperature and deterministic scoring controls reduce same-call variation.

### Backfill and production result

The fixed historical cohort ran from `2026-08-03T04:00:00.000Z` through `2026-08-13T07:14:07.298Z`.

- Unique eligible source calls: 1,660
- Valid scores: 1,483
- Fair terminal exclusions: 188
- Extra stored retry rows from earlier calibration overlap: 11 rows across 10 source IDs
- Score range: 12.3–85.4
- Median: 80.6
- Mean: 75.1
- Below 75: 428
- Below 60: 206
- At or above 90: 0
- Evidence-supported manager signals among reps with sufficient evidence: 57 needs attention, 1 coaching focus, 12 monitor
- Selective verifications: 246 material-gate calls; ordinary calls were not double-scored

Identical retries collapse to one assessment. Conflicting duplicates fail closed and are excluded from manager and Coaching output. Historical evidence rows were not deleted.

## Current verified production snapshot

This section was refreshed read-only on 2026-08-13 while creating this handoff. It is a snapshot, not a substitute for future verification.

### n8n

- n8n health returned `status: ok` for `https://insidesuccess.app.n8n.cloud`.
- V7.1 live coordinator `gXGkKGtsXPudAePR` is active.
- V7.1 worker `QPUh149BvYlqhKOq` is active.
- Official Coaching workflow `L8Nn7xncA9ZPDdWA` is active.
- Preserved V6.3 coordinator `EghbY2jr86yjJl4d` is inactive.
- Preserved V6.3 worker `w8JaLibcm8zqVGP1` is inactive.
- The latest ten V7.1 coordinator executions returned success, from execution `494417` through `494612`.
- The latest listed V7.1 worker executions returned success.
- Error-filtered execution lists for the live V7.1 coordinator and worker were empty in the checked window.

The V7.1 coordinator currently runs every five minutes. It is balance-gated and single-flight, can dispatch at most five workers of ten calls per clear slot, prioritizes new live calls, and skips when active leases exist. The owner has explicitly said the five-minute cadence may consume too many n8n executions and wants to revisit a more efficient cadence later. No replacement schedule has been approved yet; research and agree on the change before editing it.

### Vercel and GitHub

- Latest verified `origin/main`: `5b6eedcfccae0360860c39315a351819b11f30a1`.
- Current main production deployment: `dpl_DhSTRJqnf8sj6W3ds8Kn1dzUBDHv`.
- Deployment state: `READY`.
- Canonical alias: `sales-performance-dashboard-rose.vercel.app`.
- Error/fatal runtime-log query for the checked two-hour window returned no matching logs.
- Main scorecard release PR: `#162`, merge `b82f0cfff9135eb539595606ad51a20432d37581`.
- Duplicate fail-closed PR: `#163`, merge `d0df69af92d8ef72291f160527787600ba63bf36`.
- Final launch documentation PR: `#164`, merge `0238bd50b6faaca2d5f042247d835870f2e8b21c`.
- Manager access PR: `#165`, merge `4673487df7faf7b76ff29d41c58c90f4086c0049`.
- Hidden Coaching score record PR: `#166`, merge `5b6eedcfccae0360860c39315a351819b11f30a1`.

### Manager access

The exact AI Closer Scorecard allowlist is:

- `syed.haider@insidesuccess.com`
- `tyler@mawercapital.com`
- `jawad.saghir@insidesuccess.com`
- `raul.rios@mawercapital.com`
- `rich.allen@mawercapital.com`
- `mike@insidesuccesstv.com`

The normal Magic Mike domain policy also supports the relevant company domains. Do not broaden the exact scorecard list without owner authorization.

### Coaching score visibility

V7.1 scoring and live processing are active, but numeric Call 2+ scores are currently hidden from Magic Mike Coaching reports through the server-side production toggle:

`REP_SCORING_COACHING_SCORE_ENABLED=false`

The score lookup remains read-only and exact-match. Turning the overlay back on later requires setting the toggle to `true` and redeploying; it does not require an n8n workflow change. Until the owner explicitly asks, leave it hidden.

## Current manager experience

The AI Closer Scorecard is live at:

`https://sales-performance-dashboard-rose.vercel.app/manager/rep-scoring`

The first view is intentionally simple:

- closers sorted from lowest score to highest;
- default filter of at least 15 reviewed calls;
- optional 8+, 3+, and all-evidence filters;
- name/email search;
- closer, 0–100 score, reviewed-call count, and review action only.

Rep detail keeps the overall score, Call 1/Call 2+ split, concise summary/next action, evidence-supported recurring weaknesses/strengths, and lowest-scoring calls. Call detail keeps the score, manager takeaway, opportunity/outcome context, material improvements, strengths, and a collapsed scoring audit. Raw JSON, empty technical sections, version labels, and backfill mechanics are absent from the manager-facing path. Route loading feedback and scroll-to-top behavior were added.

This is meant to identify whom a manager should inspect first and what evidence to open. It is not a sole personnel verdict.

## Completed work versus genuinely pending work

### Complete

- Coaching multi-stage production architecture and rollback separation
- authenticated Magic Mike hub and shared dashboard
- Coaching reports, feedback, verified usage, compliance, Sales Impact, and no-show analytics
- Ask Sales V5.14 production runtime with V3 rollback preserved
- human-governed Slack/Google knowledge refresh and protected publisher
- simplified Ask Sales quality, adoption, and source-update admin pages
- AI Closer Scorecard V7.1 scoring architecture, fixed-cohort backfill, manager UI, live refill, access controls, deduplication, and fail-closed evidence handling
- V6.3 scoring workflows stopped and preserved as rollback
- exact-match Call 2+ Coaching score integration implemented, then temporarily hidden by production toggle at the owner's request
- manager-facing launch message drafts prepared from read-only Slack context; no Slack message was sent by Codex
- redundant local project-copy cleanup was handled earlier in the session; do not repeat broad deletion without a new read-only inventory and explicit approval

### Pending or deferred by decision

1. Decide whether to replace the five-minute V7.1 polling cadence with a lower-execution-count live strategy. This is the most immediate likely next task, but no change is authorized merely by reading this handoff.
2. Collect manager feedback from Tyler, Mike, Rich, Raul, and Jawad on the simple scorecard. Do not pre-emptively redesign it without concrete feedback or evidence.
3. Leave the Coaching numeric score hidden unless the owner explicitly asks to re-enable it.
4. Continue normal read-only health checks when requested. A fair quarantine/exclusion is not itself a system failure.
5. Keep the Ask Sales broad policy-matching replacement pending until a current systemic gap is proved.
6. Keep the retired Ask Sales automated quality judge inactive.
7. Never auto-approve or auto-publish Slack/Google knowledge proposals.

## Known caveats and watchpoints

- The V7.1 worker's internal n8n name still says `Structured Calibration Worker (NO BACKFILL)`. Its workflow ID and published graph—not the old label—identify the live worker. Do not rename production infrastructure casually.
- Five-minute no-op coordinator executions are currently healthy but may be inefficient for n8n execution usage. Treat schedule redesign as an architecture decision, not a blind interval edit.
- Fair exclusions are expected for ambiguous speakers, unmapped reps, or too few valid dimensions. They should remain retriable only when the underlying problem is genuinely recoverable.
- Earlier calibration overlap left immutable retry rows. Application deduplication is deliberate; do not delete historical rows merely to make counts look cleaner.
- Older handoffs contain superseded V3–V6.3 states. Use them for rationale and rollback history, not current production truth.
- Some legacy prompt-benchmark routes may still exist in the codebase even though they are no longer relevant manager surfaces and are absent from the current hidden-page list. Verify before claiming they were physically removed.
- Production preview deployments can fail for branch-specific Vercel provisioning while the main production deployment remains healthy. Verify the canonical alias separately.
- Never infer that a successful n8n validation proves business correctness; inspect relevant runtime evidence and outputs for material changes.

## Safe continuation checklist

Before any implementation:

1. Identify whether the task concerns Coaching, AI Closer Scorecard, Ask Sales, a hidden manager page, or shared infrastructure.
2. Read the nearest `AGENTS.md` and task-specific handoff.
3. Inspect both Git boundaries and current worktree state.
4. Verify relevant live workflow/deployment state read-only.
5. Confirm the exact mutation scope and rollback path.
6. Use isolated worktrees when the canonical checkout is dirty.
7. Never start a local development server.
8. Run focused tests, ESLint, type/build checks, and `git diff --check` as appropriate.
9. Scan intended changes for credentials and unrelated files.
10. Push only intended changes and verify CI/current production in proportion to risk.
11. Update the relevant Markdown record.
12. Report what changed, what was verified, what was not verified, and any honest limitation.

## Handoff creation record

- The broad July 30 canonical handoff was read completely.
- The V7.1 production launch record and hidden-page inventory were reconciled.
- Live n8n health, workflow state, recent V7.1 executions, Vercel deployment state, and Vercel runtime errors were checked read-only.
- No n8n workflow, Airtable data, Slack source, Google source, environment configuration, deployment, or production behavior was changed while creating this handoff.
- No local development server was started.
- No credential value is included.
