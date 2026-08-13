# Magic Mike Project Handoff — 2026-07-30

Handoff version: `v1`

This is the canonical continuation record for the complete Magic Mike project in:

`/Users/moonishaider/Desktop/upwork/Inside success tv/lil rudy`

It covers both major product areas:

1. **Coaching** — the production sales-call coaching, compliance, dashboard, manual feedback, analytics, and reporting system.
2. **Ask Sales FAQ** — the production company FAQ chatbot, governed knowledge, source refresh, admin review, and manual quality operations.

This file supersedes older restart prompts as the first file to read. Historical handoffs remain useful evidence and must not be deleted, but when they conflict with this file or current live state, re-check production and follow the newer verified state.

No credential value, API key, token, database URL, webhook secret, or OAuth secret is recorded here. A DeepSeek API key was supplied during the prior chat; it must never be copied into Markdown, code, Git, logs, or a future prompt. Verify only the existence of required managed environment variables without revealing their values.

## Start here in the next session

1. Read this file completely.
2. Read the nearest `AGENTS.md` before working inside either repository.
3. Read the current task-specific document listed under **Canonical supporting records**.
4. Treat all Magic Mike systems as live production.
5. Start read-only, verify current live state, summarize it briefly, and wait for the user's actual next task.
6. Do not run a local development server.

## User's standing operating rules

- Safety is the highest priority. Do not perform malicious, harmful, destructive, or broadly scoped actions.
- Never delete or overwrite company data, Slack history, Google files, database records, n8n workflows, or user files unless the user explicitly requests an exact, verified target and the action is necessary.
- Slack, Google Docs, and Google Sheets are read-only knowledge sources unless the user explicitly grants a different, narrowly scoped action. Do not send Slack messages, reactions, or replies during research or knowledge work.
- Do not subscribe to new software or upgrade a paid plan without explicit approval. Normal use of already configured providers is allowed when implementation/testing is authorized.
- Never start a local dev server in this project. Use non-server checks, GitHub CI, Vercel deployment, and production-safe probes.
- For n8n changes, read the applicable n8n skills first and use the n8n MCP path. Confirm the target workflow and live/draft state before editing.
- Preserve production isolation. Experiments and evaluations must be isolated until the user explicitly approves a production change.
- For dashboard changes, update the correct GitHub repository, let Vercel deploy from GitHub, and verify the deployed result.
- Update the relevant project Markdown record after every implementation.
- Existing dirty worktrees contain user work. Do not clean, reset, discard, or stage unrelated changes. Prefer a clean scoped worktree.
- Do not treat a passing test suite, AI judge, replay, or familiar benchmark as sufficient promotion evidence. Use current production data, manual inspection, source-grounded evaluation, and explicit owner approval.
- Ask before any materially broader action. Production promotion, workflow activation/deactivation, and knowledge publication require explicit authorization.

## Repository and system boundaries

### Dashboard repository

Path:

`/Users/moonishaider/Desktop/upwork/Inside success tv/lil rudy/sales-performance-dashboard`

Remote: `Inside-Success/sales-performance-dashboard`

Responsibilities:

- Magic Mike authenticated product hub
- Coaching report library and report detail UI
- manual feedback submission and report status
- manager usage, compliance, sales-correlation, rep-no-show, and prompt-benchmark pages
- Ask Sales rep UI, APIs, conversation persistence, feedback, admin pages, runtime selector, and governed knowledge materialization
- Neon/Postgres-owned application state

Important: the longstanding local checkout is dirty. On 2026-07-30 it was on `agent/magic-mike-home-hub-launch` with modified `AGENTS.md`, `README.md`, `docs-auth-verified-usage.md`, `docs-n8n-dashboard-ingest.md`, and an untracked nested directory. Do not disturb it. Use a clean worktree from current `origin/main` for scoped future changes.

Verified `origin/main` on 2026-07-30:

`47c9e2895e807742d1144e460ef88d93aa51d9ec` — Simplify Ask Sales quality operations (#97)

### FAQ repository

Path:

`/Users/moonishaider/Desktop/upwork/Inside success tv/lil rudy/FAQ Chatbot`

Remote: `Inside-Success/faq-chatbot`

Responsibilities:

- governed knowledge source records
- release manifests and policy ledgers
- Ask Sales evaluation evidence and canonical implementation records
- source-side pull request for each governed knowledge release

The ordinary local checkout has accumulated unrelated/older changes. Use a clean worktree from current remote main for future Git work.

Verified remote main on 2026-07-29:

`5f963c74e273e2a4cf5c2ee400d09967091e8127`

### Root project folder

The `lil rudy` root contains historic designs, transcripts, testing artifacts, handoffs, and many clean worktrees created for isolated releases. The root itself is not the canonical Git boundary. Do not assume that every neighboring worktree is current or that an older versioned folder is production.

## Current production product

Production URL: `https://sales-performance-dashboard-rose.vercel.app`

The authenticated Magic Mike hub exposes two company tools:

- `/coaching`
- `/ask-sales-faq`

Google authentication is the common front door. Approved company domains are centrally controlled and currently include `insidesuccesstv.com`, `insidesuccess.com`, `mawercapital.com`, and `nextlevelceotv.com`.

Human pages require authentication. `/api/*` routes retain their narrowly defined n8n/webhook responsibilities. Ask Sales admin pages are hidden behind an exact-email admin allowlist and are not linked from rep navigation.

## Coaching: current architecture and production state

The live Coaching system is a multi-stage production pipeline. It is not the old one-prompt grader.

### Active workflows verified on 2026-07-30

| Purpose | Workflow ID | State |
| --- | --- | --- |
| Zoom sales-call intake to Airtable | `qMQYNQtQbRZWjtG2` | Active |
| Official Magic Mike coaching bot | `L8Nn7xncA9ZPDdWA` | Active |
| Manual/self-submitted feedback bot | `BMRrGxHyXMcgO6j3` | Active |
| Weekly compliance summary | `sNPNGveZvEiRlU69` | Active |
| Provider/router workflow | `CiDBJxWJZCDRJChK` | Active |
| Enhanced-report feedback collector | `Vt1Ze3LiWynk7mao` | Active |

Inactive rollback workflows that must stay inactive unless an explicit rollback is authorized:

- old official: `h7NGOb3vvTbZkVRU`
- old manual: `hZVoiZ8siQsCu3a6`
- old weekly: `JtkROaJUV7QCB8i9`

Never activate old and new copies of the same trigger together. That can duplicate Slack messages, Airtable rows, Docs, dashboard records, and compliance rows.

### Pipeline stages

1. Fetch the live ISTV Context Pack.
2. Classify the call and routing state.
3. Generate coaching.
4. Generate compliance analysis.
5. Apply deterministic filters and compliance gating.
6. Run the DeepSeek coaching safety screen.
7. Repair only the flagged content when needed.
8. Translate the result into the legacy downstream shape through the node still named `Performance Agent`.
9. Continue to Airtable, Slack, Docs/PDF, dashboard ingest, and compliance Sheet outputs.

Provider roles in the established Coaching architecture:

- Anthropic: classifier, coaching, compliance, and targeted repair.
- DeepSeek: coaching safety screen.
- The provider/router workflow is production infrastructure despite its older benchmark-oriented name.

Do not regenerate live prompts from memory. Inspect current published workflow nodes and the current Context Pack.

### Critical state-alignment rule

The most serious post-launch Coaching incident was caused by cross-item state contamination: a retry path used a `.first()` fallback and paired one call's content with another call's metadata.

Never use `.first()` or an equivalent cross-item fallback in a multi-item n8n path. If aligned state is missing, fail and alert instead of guessing. Preserve Automation Key/source-record safeguards. Do not modify upstream intake unless the user explicitly scopes that work.

### Current Coaching policy anchors

- **Platform window:** Inside Success TV platform hosting is five years. The client's lifetime license to their own episode is separate. Do not combine them.
- **Recording consent:** disclosure followed by continued participation/no objection is acceptable; missing disclosure is a flag; continuing after an objection is a flag.
- **Refunds:** Next Level CEO/Daymond John may include a three-day refund statement. Other shows remain no-refund unless a newer authoritative rule is verified.
- Numeric coaching scores/grades are intentionally absent in the enhanced architecture. Blank score fields are not dashboard failures.
- Compliance risk remains normalized for legacy downstream compatibility.
- Report chat is coaching-only. It must not answer compliance, legal, red-flag, or policy questions.

### Coaching dashboard behavior

- Official and manual reports remain separate.
- Reports before `2026-06-17T17:14:00.000Z` are `Legacy`; later reports are `Enhanced`.
- Report feedback appears only for Enhanced reports.
- Thumbs-up is simple; thumbs-down requires the rep's name and a written explanation.
- Verified usage is based on signed-in viewer identity and a ten-second visible/focused engagement event.
- Official, manual, legacy anonymous, manager, and Ask Magic Mike chat activity are kept distinct.
- `/manager/sales-correlation` reads the company sales Sheet through a read-only export, validates it, stores only a dashboard-owned last-good snapshot, and must never write to the company Sheet. Its result is associative, not causal.
- `/manager/rep-no-show` deduplicates display only; it does not weaken intake keys or delete source records.
- `/manager/compliance` is read-only and preserves the distinction between summary flags and available raw evidence.

## Ask Sales FAQ: why the architecture changed

The user launched V3 and found it useful but too conservative and sometimes unnatural. It could answer impressive questions, but it routed many answerable questions and occasionally matched the wrong relationship, stage, owner, or neighboring policy.

The goal was never simply to maximize answer percentage. The target behavior is:

- answer every question that the approved knowledge genuinely supports;
- route/pass on unsupported, unsafe, ambiguous, or live-action requests;
- preserve the right person, relationship, stage, product, qualifier, scope, and action owner;
- handle greetings, thanks, goodbyes, natural conversation, and follow-ups naturally;
- avoid outdated rules and hallucinated details;
- remain useful like a general chat assistant while staying company-specific and evidence-grounded.

The central balance is deliberate: too much deterministic matching produces false routes and rigid responses; too much model freedom produces hallucinations and wrong-policy answers. The final system uses broad retrieval/model reasoning for coverage, bounded deterministic contracts for high-risk decisions, and fail-closed routing where knowledge is not strong enough.

## Ask Sales evolution and lessons learned

### V3

V3 was the strong production baseline. It was sometimes confident and helpful, but it had false routes where approved knowledge existed, wrong-neighbor/relationship matching, uneven follow-ups, rigid phrasing, and occasional unsafe confident answers. V3 remains the immediate rollback path and an important regression comparator.

### V4 and early V5 iterations

V4/V4.1/V4.2/V4.3 and early V5 variants explored vector-like retrieval, evidence admission, authority resolution, answer composition, and deterministic guards. Many iterations improved the same revealed question sets but failed on genuinely fresh Slack questions. This confirmed the user's warning about overfitting.

Important lesson: replaying the same 50 questions can show regressions, but it cannot prove generalization or justify promotion.

### Independent evaluation lessons

The project used the user's detailed review of 50 V3/V4.1/V4.2 answers, multiple blinded A/B packets, source-gold-first Slack questions with reliable threaded answers, complete production-log population replays, fresh source-disjoint gates, repeatability/lane-flip checks, manual trace inspection, and external Claude second opinions treated as critique rather than authority.

The user feedback established several durable points:

- a safe route is correct when the question is unsupported, operational, confusing, or requires a live action;
- `unresolved` is acceptable as backend state but should not appear in user-facing prose;
- confidence is desirable only when the selected policy is correct;
- answer quality can fail even when retrieval selected the correct source;
- the bot should not expose private cast-member details or arrange contact;
- action ownership and relationship matching are high-impact safety boundaries;
- future tests must not tune directly on consumed question sets.

### Authority and conflict resolution

Reliable sales authorities include Mike, Rich, Rudy, Raul, and Madeline. Authority is contextual, not a naive permanent numeric hierarchy.

- Rich is Head of Sales and generally outranks Madeline on the same sales decision.
- A newer, narrower, clearly applicable statement from Madeline or another authoritative owner can matter more than a much older broad statement.
- Evaluate exact decision, product/stage, specificity, recency, role, finality, and whether a later statement actually replaces all or only part of an older rule.
- Close or unresolved conflicts fail closed for human confirmation.
- Rich's reviewed main-ISTV reapplication minimum is three months.

### Action ownership

Ask Sales is a passive chatbot. It can explain a stable procedure, but it must not pretend to perform live mutations.

- Finance actions go to the Finance request channel.
- Greenlight actions go to the Greenlight request channel.
- General questions and unresolved sales guidance go to the Sales Questions/Requests channel.
- The bot must preserve the exact current owner when the knowledge specifies another operational team or channel.

### Important approved knowledge examples

These are examples, not a substitute for the governed registry:

- Call 2 normally begins from the $20,000 baseline package, followed by an appropriate upsell or downsell based on the situation and approved plans.
- Only approved installment plans may be offered; reps must not invent custom splits.
- Main ISTV reapplication minimum is three months, subject to any verified narrow approval exception.
- Doctors can be eligible under the reviewed Mike/Rich rule even without owning a practice when the exact professional criteria are met; nurses and adjacent professions do not automatically inherit that rule.
- Do not guarantee Tier-1 platform placement.
- Cast-member contact details and private introductions are not shareable; use approved public testimonials only.
- The current Inside Success studio address is `751 Collins Avenue, Miami Beach, FL 33139`.

### V5.14 outcome

V5.14 became the first candidate with enough evidence for direct replacement. It introduced source-preserving candidate recovery without copying V3 answers, an immutable decision contract around actor/action/object/stage/owner/qualifiers, the current governed release ledger in the corpus, bounded deterministic projection for complete high-confidence families, general model/retrieval composition, natural/follow-up handling, passive action routing, and no cross-runtime fallthrough after selection.

It was tested with regression sets, fresh source-disjoint questions, complete production-population replay, follow-up conversations, natural turns, repeatability checks, and blinded human reviews. Earlier candidates that failed promotion gates were not silently treated as wins.

## Ask Sales current production state

V5.14 is live on the existing authenticated production route.

Production selector: `ASK_SALES_FAQ_RUNTIME_VERSION=v5.14`

Launch facts:

- V5.14 production cutover merged through dashboard PR #88.
- Production preserved the existing UI, auth, API contract, request validation, rate limits, duplicate protection, conversation storage, feedback, and admin analytics.
- Real signed-in exchanges stored `pipelineVersion=v5.14` and completed without provider terminal failure.
- A narrow presentation repair removes a structured `Guidance` body only when it exactly duplicates the visible answer. Distinct caveats and steps remain visible.
- V3 remains a selector-based rollback path. Do not remove it without a separately approved retirement plan.
- A poor-fit/live-call question remains a completeness watch item: the answer was safe and grounded but did not directly settle whether to end the current call.

The frozen pre-V5.14 rollback record and exact deployment details are in `docs-ask-sales-faq-v5-14-production-cutover.md`. Re-verify live Vercel state before any rollback.

## Ask Sales governed knowledge operations

### 9 PM Miami source refresh

The knowledge-refresh system is active and deliberately human-governed.

| Purpose | Workflow ID | State |
| --- | --- | --- |
| Daily orchestrator | `ua18B5wbsYptLqJX` | Active |
| Slack collector | `ODCwPMUxJphOSpcy` | Active subworkflow |
| Google collector | `RJpxKZjm0f3gfWHS` | Active subworkflow |
| Analyze and stage | `rNc9rWTBHRSEwM3P` | Active subworkflow |
| Refresh error handler | `dX97Cup1oPeTS1wQ` | Active support workflow |
| Dedicated publisher | `4nFkqpPFvFIVavKZ` | Active release workflow |

Core contract:

1. Slack and Google are read-only discovery sources.
2. Only allowlisted sources are collected.
3. DeepSeek proposes atomic reusable rules; it cannot approve or publish.
4. The dashboard recomputes relevance/conflict state and requires human review.
5. Accepted content becomes a draft, not production authority.
6. `Build test preview` creates an immutable proposed release.
7. Synchronized FAQ/dashboard PRs must pass exact governed checks.
8. Explicit publish rechecks exact heads, merges verified PRs, waits for Vercel, and verifies the expected production knowledge version.
9. Any ambiguity, stale evidence, invalid PR, failed check, or timeout stops before production changes.

The admin flow was simplified to one obvious next action, three understandable review lanes, compact cards, ten highest-priority proposals per page, and collapsed technical controls. Bulk approval does not exist.

The July 29 repair fixed two systemic causes of an empty queue: unrelated Slack-channel changes no longer stale every pending proposal, and the analyzer receives complete added/changed root threads with verified identities instead of a large whole-channel transcript.

Pending drafts carry forward only when their substantive evidence is still present. Missing or ambiguous evidence remains fail-closed. Historical records are preserved. The first governed source release and later July 29 two-policy release both completed through the protected path and reached `Production verified`.

### 9:20 PM quality audit

Workflow `Flp8t7eNbHWu0z0O` is inactive. Do not reactivate it casually.

It was retired because its automatic nightly judgments were noisy and its final executions failed after model evaluation due to a schema mismatch. Historical executions and stored review history remain preserved.

Future quality review is manual and on demand: when enough real production traffic has accumulated, the user asks Codex to inspect stored questions, answers, selected sources, route reasons, feedback, and technical traces.

### Quality & Operations admin page

`/ask-sales-faq/admin` is now intentionally simple:

- Questions
- Answered
- Safely routed
- Needs attention
- recent conversations
- collapsed feedback and technical details

Only runtime failures and thumbs-down answers enter `Needs attention`. Safe routes remain visible but are not labeled as defects. No nightly judge is required.

### Rep Adoption and Source Updates

Rep Adoption remains a separate admin function. Source Updates remains the governed 9 PM workflow described above. The Quality & Operations cleanup did not change either one.

## Current work status

### Complete

- Coaching multi-stage production cutover and rollback separation
- production dashboard redesign and authenticated Magic Mike hub
- manual feedback and Enhanced-report feedback collection
- verified usage, compliance, sales correlation, rep-no-show, and manager analytics
- Ask Sales V5.14 production launch with V3 rollback preserved
- duplicate Guidance presentation repair
- governed read-only knowledge refresh and protected publication
- refresh retention/Slack-delta/authority repair
- simplified Source Updates owner experience
- retirement of noisy automated quality audit
- simplified manual Quality & Operations page

### Normal ongoing operations

- review and approve useful source proposals individually;
- publish only through the protected exact-head release path;
- periodically request manual production-log review after enough data accumulates;
- monitor real user feedback and provider/runtime failures;
- update rules only from current, attributable, scoped evidence.

These are maintenance activities, not incomplete construction.

### Intentionally pending

The older broad policy-matching replacement remains saved and intentionally pending. Its core idea was to replace broad relation matching with exact same-decision matching, atomic source-faithful extraction, entailment checks, shortlist-only retrieval, shared versioned matching, and fail-closed UI.

Do not implement it automatically. Some of its original motivation has been addressed by V5.14 and the refreshed governance path, so any future implementation must first re-audit the current production matcher and prove a remaining systemic gap on new data.

### Not currently authorized

- replacing or removing the V3 rollback;
- reactivating the 9:20 automated quality audit;
- fully automating knowledge approval/publication;
- writing to Slack or Google knowledge sources;
- changing Coaching prompts, upstream intake, compliance policy, or output schemas without a newly scoped request;
- deleting historic test worktrees, review records, failed executions, or old handoffs.

## Read-only health snapshot — 2026-07-30

This snapshot is evidence for continuation, not a substitute for a fresh check.

- n8n instance health returned `status: ok` for `https://insidesuccess.app.n8n.cloud`.
- Core active/inactive workflow states matched the inventory above.
- Official, manual, and weekly workflows validated with zero errors and zero invalid connections under the scoped runtime validation profile. Existing warnings are advisory legacy/error-handling suggestions, not newly introduced failures.
- A recent full official execution (`407985`, July 29) succeeded and produced aligned Airtable, dashboard/side-effect, and Slack outputs.
- The official workflow has one historical error from July 24; intake has three historical errors from July 27. Later successful executions exist. Manual, weekly, and provider error lists were empty in the checked list.
- The compliance Sheet's weekly rep and category tabs contained current week `Jul 27-Aug 2, 2026` data, and raw evidence remained readable.
- Production route probes returned HTTP 200 with the expected sign-in shell for protected pages.
- The Vercel runtime-log connector returned `403 Forbidden` during this handoff check. That is a connector permission limitation, not proof of a production error or proof of no errors. Use another authorized read-only Vercel path if current runtime-log evidence is required.
- No local server, Slack write, Google write, database mutation, n8n mutation, or production change was performed for this handoff.

## Canonical supporting records

Read only what is relevant to the next task.

### General Coaching and production

- `../SESSION-HANDOFF-2026-06-23.md` — broad June dashboard/auth/analytics/compliance history
- `../magic-mike-cutover-SESSION-HANDOFF.md` — Coaching cutover architecture and rollback details
- `../prod main/cutover-17-current-production-state-2026-06-18.md` — production workflow state after the state-alignment repair
- `../performance-bot/session-handoff-2026-06-18.md` — testing journey and final multi-stage architecture
- `AGENTS.md` — current dashboard operational rules
- `README.md` — current dashboard routes and runtime responsibilities
- `docs-auth-verified-usage.md` — authentication and verified-usage behavior
- `docs-n8n-dashboard-ingest.md` — dashboard ingest and feedback integration

### Ask Sales current state

- `docs-ask-sales-faq-v5-14-production-cutover.md` — exact launch and rollback record
- `docs-ask-sales-knowledge-refresh.md` — current governed refresh architecture and July 29 repairs
- `docs-ask-sales-faq-admin-and-adoption.md` — current manual Quality & Operations and adoption UI
- `docs-ask-sales-faq-policy-guard.md` — policy guard behavior
- `../FAQ Chatbot/ask-sales-blind-review-feedback.json` — preserved owner feedback from the early blinded comparison
- `../FAQ Chatbot/transcription/` — Zoom meeting transcript with Mike and Rich used for authoritative sales-rule interpretation
- `../FAQ-Chatbot-quality-operations-final-record/CURRENT-PENDING-WORK.md` — chronological Ask Sales status through July 29
- `../FAQ-Chatbot-quality-operations-final-record/ASK-SALES-MANUAL-QUALITY-OPERATIONS-2026-07-29.md` — final quality-operations record
- `../FAQ-Chatbot-release-final-record/POLICY-MATCHING-REPLACEMENT-PLAN-2026-07-21.md` — intentionally pending historical plan

The many V4/V5 evaluation records and Claude second-opinion packets remain in the FAQ worktrees/repository for forensic history. Consult them only when a future task needs the exact evidence; do not load every historical artifact by default.

## Safe continuation checklist

Before any future implementation:

1. Confirm whether the task concerns Coaching, Ask Sales, shared dashboard infrastructure, or more than one area.
2. Re-read the nearest `AGENTS.md` and task-specific canonical record.
3. Inspect the correct Git boundary and current `origin/main`.
4. Inspect the working tree; preserve unrelated changes.
5. Re-check live workflow/deployment state if the task touches production behavior.
6. Confirm every connected service is read-only unless the requested implementation truly needs a scoped write.
7. Make the smallest coherent change.
8. Run appropriate non-server checks; never start a local dev server.
9. Push only intended files to the correct GitHub repository.
10. Verify CI and Vercel/current production in proportion to risk.
11. Update the relevant Markdown record.
12. Report honestly what is verified, what is inferred, and what remains pending.

## Handoff validation

- [x] Project root and Git boundaries recorded.
- [x] Coaching and Ask Sales both covered.
- [x] Live workflow inventory refreshed read-only.
- [x] Current dashboard production route probed read-only.
- [x] Current compliance summary data checked read-only.
- [x] V5.14 production and V3 rollback preserved in the record.
- [x] 9 PM refresh and inactive 9:20 quality workflow recorded.
- [x] User governance, safety, no-local-server, and GitHub/Vercel rules preserved.
- [x] Long Ask Sales evaluation lessons preserved without duplicating every artifact.
- [x] Pending matcher explicitly remains pending.
- [x] No credential value or API key included.
- [x] No production or connected system changed while creating this handoff.

## Change log

- `v1` — 2026-07-30: created the first canonical project-wide handoff spanning Coaching, Ask Sales, production architecture, governance, July operations, health state, and safe continuation rules.
- `v2` — 2026-07-30: added the isolated Rep Performance Reviewer production implementation recorded below.
- `v3` — 2026-07-31: guaranteed the initial administrator through the global Google sign-in gate, corrected misleading preview-auth error handling, and recorded the final production review path.
- `v4` — 2026-08-11: recorded the final V6.3 manager-priority release, completed live/catch-up state, and exact-match Call 2+ score display in Coaching.
- `v5` — 2026-08-13: recorded the isolated V7.1 structured-criteria calibration; V6.3 production and Coaching remain unchanged.
- `v6` — 2026-08-13: recorded the completed atomic additional-250 checkpoint, simplified manager UX, combined 411-call audit, and restoration of normal production pace.
- `v7` — 2026-08-13: records the authorized V7.1 production launch, fixed-cohort completion, simple AI Closer Scorecard, live refill, and exact-match Call 2+ Coaching score cutover.

## Rep Performance Reviewer production addendum — 2026-07-30

This feature is now live as a hidden, server-authorized manager page at `https://sales-performance-dashboard-rose.vercel.app/manager/rep-scoring`. The initial exact allowlist contains only `syed.haider@insidesuccess.com`. It is intentionally absent from normal navigation.

Production boundaries:

- Existing Coaching intake `qMQYNQtQbRZWjtG2`, official coaching workflow `L8Nn7xncA9ZPDdWA`, Ask Sales workflows, source Airtable records, Slack, and Google content were not modified.
- The new scorer reads eligible calls from the existing Zoom Closer source and reads transcript Docs, but writes only to the separate Airtable base `appEQQkTlJnc7tJgi`.
- The result is a coaching/review signal, never an autonomous employment decision.
- Call 1 and Call 2+ dimensions remain separate. Relative bottom-15-percent review is a supporting signal rather than an exclusive gate.

Live components:

- n8n workflow `JQgSOlzomtjBotYJ`, `MM Rep Performance Reviewer - Isolated Shadow`, is active on a one-hour schedule with a 10-call cap. Its controlled webhook is disabled.
- Current contracts are scorer `rep-reviewer-v3`, prompt `rep-prompt-v2`, config `rep-scoring-config-v2`, and model `deepseek-v4-pro` with thinking enabled and medium reasoning. V3 corrects null critical-event score-cap handling; V2 remains audit history and is excluded from the live manager view.
- A task-specific DeepSeek credential and separate source/store Airtable credentials were created in n8n. Credential values are not recorded here.
- The Airtable base contains `processing_ledger`, `call_scores`, `quarantine`, `rep_identity`, `rep_rollups`, `config`, `formal_reports`, and `scoring_runs`. The dashboard derives provisional rollups from immutable current-version scores until materialized rollups are populated.
- Each run reads the rolling seven-day eligible set, collapses the source output to one ledger lookup, removes completed and actively leased v3 idempotency keys, and only then applies the 10-call cap. The schedule is hourly so it can advance through the observed source volume while each sequential batch remains inside the 30-minute timeout. Active leases are also rechecked per item to prevent overlapping retries from rescoring owned work. The dashboard de-duplicates immutable retry rows and excludes pre-launch/superseded quarantine rows from live manager metrics while retaining audit history.

Release and verification:

- GitHub implementation PRs `#99` through `#105` are merged to `main`; current production head is `acc4f19`.
- Production deployment `dpl_3mxdyVxVMUWFmira47W6ZGgopWyL` reached `READY` and owns the canonical production alias.
- The unauthenticated hidden route returns the protected Magic Mike sign-in boundary with `noindex, nofollow`. `syed.haider@insidesuccess.com` is explicitly permitted by the global authentication gate and separately required by the rep-scoring page allowlist.
- Preview deployment `dpl_9QeTkGBvPztj3AZw7X8KP7QsRQD2` lacked production Auth.js secrets and produced the misleading generic email-rejection screen. PR `#105` makes configuration failures distinct from genuine `AccessDenied` responses and keeps the dashboard header hidden on the sign-in screen even when authentication cannot initialize. Preview URLs remain invalid review links; use only the canonical production route.
- The dashboard passed ESLint, TypeScript, and repeated production builds. No local development server was started.
- n8n validation reports zero errors and zero invalid connections. Existing warnings are advisory Code-node/error-output/long-chain suggestions.
- Controlled backfill execution `413452` completed successfully after examining 10 eligible calls: 7 new v2 scores, 1 evidence quarantine, and 2 already-completed records skipped. Two confirmation requests also completed successfully; immutable overlaps are retained for audit and reconciled by stable IDs in the manager view.
- Corrected v3 smoke execution `413836` collapsed 1,106 eligible source rows to one ledger request and wrote a 70-point score with one `null` critical-event cap, proving the cap no longer becomes zero. Corrected v3 batch `413852` selected 10 calls and completed with 3 v3 scores, 4 evidence quarantines, and 3 safe per-item skips after a concurrent scheduled run completed those keys first.
- Latest checked scheduled scorer execution `413947` completed successfully, including immutable scores, evidence quarantines, completed ledger records, and a successful `Run Complete` result. The latest checked intake and official Coaching executions were also successful.
- Production Vercel runtime error/fatal logs were empty in the post-release check.

The production Google chooser in the connected Chrome profile did not contain the company account; it contained only personal Gmail accounts. The review tab was therefore left at Google's password prompt for `syed.haider@insidesuccess.com`. After the user completes that Google sign-in, OAuth will return to the canonical hidden page; Codex did not request, read, or enter the password.

Operational record and rollback details are in `docs-rep-scoring-admin.md` in the dashboard repository. To stop this feature without affecting Magic Mike, deactivate n8n workflow `JQgSOlzomtjBotYJ` and/or set `REP_SCORING_ENABLED=false`; reverting the dashboard release is independent of existing Coaching and Ask Sales paths.

## Rep Performance Reviewer V6.3 final-live addendum — 2026-08-11

The earlier July addendum above is retained as historical architecture only. Current production uses:

- manager scorer `rep-reviewer-v6.3-realistic-fair-1` at `https://sales-performance-dashboard-rose.vercel.app/manager/rep-scoring`;
- active five-minute, balance-gated, single-flight coordinator `EghbY2jr86yjJl4d`;
- active internal V6.3 worker `w8JaLibcm8zqVGP1`;
- completed historical inventory of 1,268 terminal calls from the approved Aug 3 launch window; and
- uncapped live admission for eligible calls after the fixed historical cutoff.

Final manager behavior:

- Existing absolute concern and recurring weakness rules remain unchanged.
- The lowest 15% of reps with at least 15 valid calls are marked `Manager priority` when no stronger supported concern applies. This is a comparative review starting point, not an underperformance verdict, and it does not change any score.
- Production verification showed five comparative priorities among 33 strong-evidence reps, 1,163 valid scores, and zero historical calls waiting.

Final Coaching behavior:

- The official Coaching-generation workflow `L8Nn7xncA9ZPDdWA` was not edited.
- An existing Call 2+ Coaching report displays only the numeric V6.3 score when source Airtable record ID and automation key both match exactly one valid immutable score row.
- Missing, mismatched, duplicate, Call 1, old-version, quarantined, inconsistent, or invalid records display no score. A lookup failure never blocks Coaching feedback.
- Production report `/call/4914` showed its matched `79.8 / 100` score and all existing feedback. Pre-window report `/call/3904` rendered normally without a score.

Release evidence:

- GitHub PR `#156` merged as `fa3a843bd932063bcff9e4227afeb05e29723cb8`; documentation PR `#157` merged as `8e705f4f73c586739499341e7efb06a1d02e4234`.
- Final production deployment `dpl_9gbKjC9bbq46qM9LuwXS4EbWXMdD` reached `READY` and owns the canonical alias.
- All 343 tests, ESLint, and the production build passed without a local development server.
- Vercel returned no runtime errors after signed-in verification of manager and Coaching routes.
- Both V6.3 n8n workflows validate with zero errors and zero invalid connections. Their remaining warnings are advisory static-analysis findings on proven Code/IF/loop patterns.
- The latest verified coordinator scan returned `historical_target_complete`, zero active leases, and no calls needing dispatch. A new live call was admitted and scored successfully immediately before that clean scan.

Rollback is code-only for the manager-priority and Coaching-score presentation: revert PR `#156`, or set `REP_SCORING_COACHING_SCORE_ENABLED=false` to hide only the Coaching score lookup. The isolated score store, live scorer, and Coaching-generation workflow remain independent.

## Rep Performance Reviewer V7.1 isolated-calibration addendum — 2026-08-13

V6.3 remains the current live manager scorer and the exact-match Call 2+ score source for Coaching. V7.1 is an isolated shadow calibration only. It has not started a historical backfill, replaced a production workflow, or changed a Coaching score.

V7.1 components:

- structured worker `QPUh149BvYlqhKOq` using scorer `rep-reviewer-v7.1-shadow-1`;
- focused 30-call launcher `Y2M5YOqxwuqpg6Hw`;
- additional 120-call launcher `AMDHxcR2stfvFixj`; and
- read-only audit workflow `U1qAFJ92IjypX5jv`.

The focused calibration finalized 28 evidence-supported scores and two fair speaker-resolution exclusions. Its distribution was 51.3–85.4 with a 79.7 median, no score at or above 90, ten calls below 75, and three below 60. An evidence audit of low, middle, and high calls found that low scores were tied to exact missed or weak checkpoints while high scores retained competent or strong evidence. One genuine repeated manager concern appeared; no percentile rule was used.

Only after that focused audit passed, the extension admitted 120 new calls balanced 60 Call 1 and 60 Call 2+ across twelve reps. The completed isolated cohort contains 155 scores and six fair exclusions, ranging 17.0–85.4 with an 80.6 median, 54 calls below 75, 27 below 60, and none at or above 90. Seven reps have evidence-supported needs-attention signals, one has a routine coaching opportunity, and five have enough evidence without a priority concern.

The validation cohort exceeded its 150-call target by 11 final calls. Two extra launch requests overlapped the launcher's slow source/reference scan before the first run established leases. Per-call idempotency prevented a second 120-call purchase, but 11 additional unique calls finalized. Both launchers are inactive. This validation launcher must not be reused for a backfill; any future backfill requires a database-level run lock before source reads and atomic per-call claims.

V7.1 asks the model for structured coverage, specificity, material-gap, confidence, and evidence facts. Deterministic code derives criterion status and score using 0/20/45/68/84/100 anchors. Ordinary script completion is competent; strong requires complete and specific execution; exceptional remains rare. Transcript failures remain exclusions, a fair Call 1 rejection may still score well, and Call 2+ outcome never substitutes for execution quality.

The isolated validation UI is documented in `REP-SCORING-V7-1-CALIBRATION-RELEASE-2026-08-13.md` in the dashboard repository. Scoring quality is a GO for user/stakeholder shadow review and a future approved backfill. Operational backfill remains NO-GO until the atomic controller is wired. Promotion to the live manager route or Coaching requires separate explicit approval.

## Rep Performance Reviewer V7.1 atomic-250 and manager addendum — 2026-08-13

The atomic control plane is now implemented and proven. One-time coordinator `aVvWQpt1vuN9ljf4` acquired a database-backed lock before reading source calls, selected exactly 250 unique V7.1 calls from the approved `2026-08-03T04:00:00.000Z` boundary, and dispatched 25 workers of ten calls in guarded waves of 20 and 5. The selection was balanced 125 Call 1 and 125 Call 2+. A dispatched run cannot reopen, while per-call V7.1 leases and idempotency provide an independent duplicate-cost guard.

All 25 top-level workers completed successfully. The checkpoint finalized exactly 250 calls: 228 scores and 22 fair exclusions. The new score mix was 108 Call 1 and 120 Call 2+; the exclusions were 17 Call 1 and 5 Call 2+. New selective second review ran on 51 of 228 scores, or 22.4%, rather than double-scoring every call.

The combined evidence set now contains 383 scores and 28 fair exclusions. Its score range is 17.0–85.4, median 81.5, and mean 75.2, with 12 Unacceptable, 41 Needs Improvement, 62 Developing, and 268 Meets Expectations calls. There are 115 calls below 75, 53 below 60, and no call at or above 90. Among 26 reps with enough evidence, the deterministic manager aggregation returns 13 Needs attention, 2 Coaching focus, and 11 No priority concern. The concern group is evidence-driven, not a forced percentile; repeated Call 1 discovery gaps and a smaller set of Call 2+ outcome-execution gaps have exact supporting calls.

The hidden manager page was simplified for non-technical use. Technical version/backfill mechanics were removed from the primary view; immediate manager priorities appear first; lower-priority and early-evidence records are collapsed; rep pages show a concise summary and next action; and call pages show a manager takeaway and only useful evidence sections. Navigation now gives immediate loading feedback and scrolls deterministically to the top.

Production deployment `dpl_32D17Hv6X6z65hXRZgR2iByzWcDv` is `READY` at the canonical alias. V7.1 coordinator, worker, audit, and temporary finalizer are inactive after the checkpoint. Existing V6.3 coordinator `EghbY2jr86yjJl4d`, V6.3 worker `w8JaLibcm8zqVGP1`, and Coaching `L8Nn7xncA9ZPDdWA` remain active at their prior versions and normal pace. The remaining historical backfill is explicitly not authorized until the user reviews this combined result and gives separate approval.

## AI Closer Scorecard V7.1 production addendum — 2026-08-13

The user subsequently authorized the complete V7.1 production launch. The fixed historical cohort is 1,660 eligible calls from `2026-08-03T04:00:00.000Z` through `2026-08-13T07:14:07.298Z`. V7.1 continues to use isolated worker `QPUh149BvYlqhKOq` and immutable scorer `rep-reviewer-v7.1-shadow-1`.

The final 460 unfinished calls are handled by webhook-only continuation `80MLVQW3SdmxZzNH`, protected by database run key `v7.1-final-460-continuation-2026-08-13`, exact per-call idempotency, active leases, provider balance checks, and bounded batches. It dispatches 46 workers of at most ten calls in guarded waves of 20, 20, and 6. It cannot reopen the same cohort after dispatch.

The production live path is separate schedule coordinator `gXGkKGtsXPudAePR`. It reads only the V7.1 ledger, gives post-cutoff live calls priority, dispatches at most five workers of ten calls per safe slot, and fails closed on a provider, source, ledger, lease, or invariant failure. A five-minute schedule does not mean overlapping execution: any unexpired V7.1 processing lease causes that slot to skip.

The manager route is now a simple scorecard sorted lowest score first. The primary table contains only closer, 0–100 score, reviewed-call count, and review action, with 15+, 8+, 3+, and all-rep filters. Technical versions, backfill mechanics, validation counters, priority labels, and raw JSON are absent from the manager-facing path. Rep detail retains only evidence-supported summary, Call 1/Call 2+ split, recurring areas, and lowest-scoring calls; call detail keeps a concise takeaway and an optional collapsed scoring audit. Route progress and scroll restoration cover the full manager scorecard subtree.

Magic Mike Coaching remains fail-open and read-only. Its workflow is not edited. A numeric Call 2+ score appears only when exactly one V7.1 score matches both source Airtable record ID and automation key and passes scorer, call-type, status, consistency, and numeric validity checks. Lookup failure or ambiguity hides the score without affecting the feedback report.

The detailed launch, verification, rollback, workflow IDs, deployment, and final data audit are recorded in `REP-SCORING-V7-1-PRODUCTION-LAUNCH-2026-08-13.md`.
