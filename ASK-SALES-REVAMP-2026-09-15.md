# Ask Sales / Magic Mike revamp — isolated candidate

Status: implemented and evaluated as a draft candidate; **not approved for production**. Production remains V5.14. This work does not change coaching, compliance, or the AI Closer Scorecard.

## Behavior and architecture

The candidate uses one normal answer path: contextual intent and query planning, product-scoped retrieval, a natural answer, and a grounded review. Conversation and general sales coaching can use the model's general knowledge. Company prices, permissions, eligibility, guarantees, owners and processes require applicable company evidence. Missing detail should produce a useful partial answer or a focused clarification. A provider failure is a technical failure, not a fabricated knowledge gap or Slack instruction.

Retrieval preserves direct-question candidates and complements them with model-generated queries. It recognizes the main ISTV, DJ/NLCEO and reality families, keeps a small maintained current-context set, and does not extend unspecified pre-reality policies to reality offers. Models receive short evidence IDs; the server maps these back to actual registry IDs and rejects invented references and resource URLs. A valid reference proves membership, **not that the paragraph is entailed**; model review and answer-quality evaluation remain necessary.

All candidate consumers use one effective registry: runtime, admin conflict review, release preview, publication manifest, health and evaluation. Admin releases use the same version-chained materializer with a separate candidate ledger. Previously approved legacy releases remain intact. The paired FAQ base is exported explicitly and divergent ledgers cannot be silently overwritten.

The old runtime is preserved as a baseline and rollback option. Select the candidate explicitly with `ASK_SALES_FAQ_RUNTIME_VERSION=revamp`; use a configured provider. There is no paid automatic provider fallback or question-specific answer override in the candidate.

## Knowledge work

The candidate includes curated reality FAQ and mandatory Call 2 video evidence, current HubSpot meeting/notes/automation guidance, invoicing SOP, product/contract boundaries and respectful objection-handling coaching. Both onboarding parent documents and their relevant links were examined. Old prices, copied scripts, old Keap videos and individual Slack suggestions were not blindly treated as current policy.

The full documentary benefit is treated as VIP for current reality sales based on the mandatory Call 2 video. The written FAQ discrepancy remains explicit; existing signed agreements are not reinterpreted. The reality FAQ is not a blanket substitute for later scoped authoritative instructions.

The source registry grows from 43 to 50 sources. Collector guards must change together with the registry; see `rollout/README.md`. The collector patch is generated, tested locally and not applied. No Slack messages or Google document edits were sent. Source coverage is substantial but not exhaustive: old-thread new replies and newly linked videos require further review.

## Observability and UI

The latest candidate question can retain 12,000 characters through UI/API/runtime. History is bounded separately. Technical failures, partial answers, conflicts, clarifications and knowledge gaps are recorded in candidate metadata. Admin review includes unanswered questions without negative feedback, and explains that handoffs are not automatically correct. Candidate source cards do not display invented numeric confidence or imply human approval.

## Evaluation evidence

- Initial Luna development run: 40 cases, three reference failures and substantive retrieval/scope defects. Failed outputs were retained.
- After the first grouped correction: Luna completed 40/40 cases, median 7.729 seconds, p95 12.7 seconds. DeepSeek completed 38/40 after narrow protocol normalization, median 6.751 seconds, p95 10.161 seconds. DeepSeek incorrectly transferred an ad rule to a PR-article question. Provider protocol differences limit claims about intrinsic model quality.
- First frozen 80-case Luna run: 80 technical completions, median 8.239 seconds, p95 13.28 seconds. Agent review marked 64 useful, 12 needing editing and four requiring source checks. These labels are neither a human acceptance score nor measured accuracy.
- An eight-question comparison used production V5.14 with DeepSeek, the candidate with historical knowledge under both providers, and the candidate with refreshed knowledge under Luna. The old runtime incorrectly answered “No” to company CRM note-taking and routed a greeting. The candidate improved synthesis, but Luna still invented a live-note-taking approval requirement and retrieval missed a newer reminder instruction. Historical and current corpora are not identical effective source sets, so this is diagnostic evidence rather than a controlled causal accuracy estimate.
- The second grouped correction gives planning a bounded catalog of maintained source topics, preserves ordinary low-risk practical reasoning, rejects invented restrictions, and reduces unrelated policy additions. The reminder source now retains its exact automation and manual-message boundaries. A follow-up eight-case run completed technically and answered live CRM note-taking normally. The 80-case regression rerun completed with no technical errors: median 7.268 seconds, p95 11.791 seconds. Agent review marked 70 useful, eight needing editing and two requiring source checks. It is a known regression set, not an unseen holdout.
- The older direct-query retrieval experiment returned lexical 16/20 versus hybrid 17/20 exact gold-record recall. It used an older snapshot and does not establish current production recall. Semantic retrieval remains an offline experiment.

Luna is the staging candidate because its structured-output reliability was stronger in these runs. It has not replaced DeepSeek in production. Answer correctness is assessed separately from schema validity, routing and latency. Some answers remain more procedural or verbose than desirable, and ambiguous source/contract situations remain explicit.

Evaluation scripts use private artifacts outside the repository, retain failures, share a spend lock and enforce a ceiling. Cached cases are not new requests. Cost is estimated from usage, not an invoice. Hosted smoke calls receive a conservative separate budget charge. Estimated total spend through the final focused run and hosted policy check is $3.3213, including the conservative hosted-call allowance.

A subsequent focused run caught a reapplication regression: the model reused an already-adjudicated six-month ordinary-deadline record. The final knowledge correction explicitly retires ten superseded records using the existing source-resolution evidence, preserves the separately reviewed VIP/Lite and reality exceptions, and retains the non-duration blacklist-language boundary. The compiler now rejects missing supersession targets and cycles. The current payment source also explicitly distinguishes the All Payments channel from a HubSpot menu. The final focused 16-case run completed without technical errors (median 6.618 seconds). All four targeted reapplication cases preserved the scoped intervals, and both payment cases correctly named the channel. Some answers still add unnecessary policy details; the booking answer still asks for information it cannot use to book. This is agent review, not independent acceptance; the 80-case figures above belong to the preceding knowledge snapshot, not a fresh run of the final snapshot.

Current candidate registry: `67d5ad54a3450de58b7fa635`. The paired FAQ export and candidate ledger must match this effective version.

## Validation and staging

All 24 candidate tests passed, including three new graph-validation checks. The final full suite passed 308 tests; TypeScript and the changed-file lint check also passed. The 107 static checks, TypeScript and scoped lint passed. Commit `573036e` passed GitHub CI and hosted deployment. Final implementation commit `8312430` passed GitHub CI (308 tests, static validation, TypeScript, scoped lint and build) and reached READY on Vercel. The paired FAQ commit `f2c8a26` also passed CI. Exact hosted results are recorded in the staging log.

The preview provisioning failure was traced to Neon's 10-branch limit. After specific user approval, one archived July preview branch was deleted; the new revamp database branch then provisioned successfully. Production remained on its original database and READY deployment. See `rollout/STAGING-VERIFICATION-2026-09-15.md` for the exact actions and evidence.

Hosted checks verified authentication rejection, a synthetic authenticated Luna response, saved history, request replay, feedback storage without external sync, admin rendering and separation from a second test account. They revealed a replay provider-label omission and missing feedback ownership enforcement, both corrected and verified on hosted commit `573036e`: replay retains OpenAI, feedback from another account returns 404, and feedback from the owner succeeds without external sync. Google OAuth login and a fully interactive authenticated browser flow remain unverified; no login bypass was added to the application.

The runtime/admin/registry changes and collector patch are reviewable but not a production rollout. Source-reference membership and model review do not prove entailment. No exhaustive Slack/video coverage or perfect accuracy is claimed. Existing contract disputes cannot be resolved without those specific agreements.

Release gates, coordinated deployment and rollback are in `rollout/README.md`. Do not merge or switch the production selector while material quality failures or required staging checks remain unresolved.
