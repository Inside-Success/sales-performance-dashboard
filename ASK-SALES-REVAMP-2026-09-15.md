# Ask Sales / Magic Mike revamp — isolated candidate

Status: implementation and evaluation in progress; **not approved for production**. Production remains V5.14. This work does not change coaching, compliance, or the AI Closer Scorecard.

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

## Evaluation evidence so far

- Development run 1: 40 Luna questions; three final reference failures plus factual/retrieval issues.
- After one grouped architecture correction: 40 Luna questions completed, median 7.729 seconds and p95 12.7 seconds. This is a technical completion measure, not a quality pass.
- Manual agent review still found problematic reapplication interpretation, old deposit guidance stated too broadly alongside current prices, unnecessary historical procedures and an overbroad CRM-notes privacy statement. These failures remain in private artifacts and block an unqualified release claim.
- DeepSeek comparison is being rerun after a narrow shared-scope format normalization. Its earlier failures are retained rather than hidden.
- Direct-query retrieval experiment: lexical 16/20 vs hybrid 17/20 exact gold-record recall. This modest test does not justify an extra production embedding request yet; semantic retrieval stays an offline experiment.
- An 80-case constructed regression set is frozen for final evaluation. It is not an independent human review or an unseen real-world holdout. Historical real questions are development evidence.

Evaluation scripts make model calls only, use private artifacts outside the repository, retain failed outputs, share a spend lock and enforce a ceiling. Cached cases are not fresh requests. Cost is estimated from provider usage; it is not an invoice.

## Validation and release

At this checkpoint: 302 full-suite tests passed, plus the later shared-scope test; 107 static checks passed; TypeScript, scoped lint and production build passed. The initial local build failed because node_modules was an external symlink; installing the unchanged lockfile into this worktree resolved it.

Full hosted end-to-end verification is pending isolated staging storage. A branch preview must not connect to the production database or run publication/feedback workflows. Code checks, a preview sign-in page, source references and model self-review do not prove correct answers.

Release gates, coordinated deployment and rollback are in `rollout/README.md`. Do not merge or switch the production selector while material quality failures or staging checks remain unresolved.
