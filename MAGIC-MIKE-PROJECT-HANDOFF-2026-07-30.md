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
