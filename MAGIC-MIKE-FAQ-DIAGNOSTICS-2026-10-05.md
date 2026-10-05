# FAQ failure diagnostics — October 5, 2026

## Scope and decision
Authorized bounded investigation and diagnostics; base dashboard 605eb79 (production). Branch agent/faq-diagnostics-2026-10-05. Only FAQ runtime diagnostics, request warning, admin technical details and tests changed. No model/effort, prompts, retrieval, knowledge, validation acceptance, retries, Coaching, schema, source documents or Slack changes. Do not treat this as a proven repair of the historical failure.

The October 4 active-show-list incident had successful plan/answer/review calls and revamp_invalid_output, but retained no rejected output or specific failure reason. Three isolated current-runtime repetitions answered successfully. Therefore no speculative behavioral fix was made. These tests cannot reconstruct the original rejected answer.

## Implementation
The existing evidence validator now returns its first specific rejection: missing_fact_evidence, unknown_evidence_reference, unsupported_url or unsupported_route. The boolean wrapper and acceptance conditions are preserved. Runtime metadata records stage and reason for provider, schema, evidence and unexpected failures; existing error_class/outcome remain compatible. Evidence positions and SHA-256 fingerprints identify repeated rejected values without saving raw rejected prose or private URL values. Existing candidate IDs, knowledge version and provider attempts remain available.

The authenticated FAQ API emits a structured warning for revamp failures with request/message/conversation IDs, model, pipeline/knowledge version and diagnostics. Thus an HTTP-200 safe fallback is visible in runtime logs. It does not expose diagnostics in the rep-facing API response. Existing admin-only Technical details shows stage/reason and message ID. Old rows remain readable without invented historical diagnoses. No DB migration or historical mutation.

## Validation and limits
Initial secret-file setup lacked an OpenAI key: the evaluator stopped before any network dispatch, cost zero. Correct existing private key used afterward. Three baseline repeats plus five candidate checks (all three UI starters, colloquial show-list phrasing and a context-free clarification request) had zero provider/schema/evidence failures. Baseline estimate $0.02307396; candidate $0.04179088; total $0.06486484 before hosted verification. Evaluation files and model outputs are private outside Git. Rates are the existing evaluator estimates, not a reconciled invoice.

All starter answers were usable: prices/plans and active list returned approved resources; platform-placement answer correctly denied a guarantee, though it included an unnecessary Magic Mike-specific caveat. This wording was not changed in a diagnostics-only round. Context-free 'Where do I find that list?' appropriately asked which list. No claim of perfect answer quality or prevention of every future failure.

Deterministic tests force reference/schema/provider/unexpected failures, verify stage/reason, preserve fail-closed behavior and three-call limit, and check diagnostics omit rejected private values. Release checks and production receipts are recorded after completion below.

## Rollback
Revert this scoped PR if needed; no database restoration, model switch or knowledge rollback. Preserve later Coaching or knowledge changes. No automatic retry introduced.

## Pre-release checks
376/376 FAQ tests passed across 32 files, including four new diagnostic tests. TypeScript, scoped ESLint, static safety validator and local production webpack build passed. Vercel preview dpl_BpTpDAJDGUR4312XtMfDfv7Pr6up failed before build with Resource provisioning failed. No preview resource or database changes attempted. GitHub CI and authenticated production verification remain required.

## Deployment verification and blocker
Dashboard PR258 merged at 57304255b0b2967db09d42ee06a13a97d07038ef; exact-head GitHub CI passed. Production build dpl_HBUb6h34nVCx7t8yQ1UDv9SPjsdM reached READY. The rose alias required explicit assignment. The active-show-list starter answered correctly through the work-profile UI; saved assistant faq_assistant_f74f0488-c6be-46ae-9485-6b5335377896 used GPT-5.6 Luna with no error. Three saved baseline-output replays also produced identical answers, sources, outcomes and call counts without paid calls.

Admin verification returned 404 on the new deployment. The same authenticated account and historical conversation work on the old deployment. The production ASK_SALES_FAQ_ADMIN_EMAILS sensitive variable was updated after the old deployment (October 4); its value is unreadable. Auth code was unchanged. The rose alias was immediately restored to dpl_Fzub5DAKfLkPFRK235bp62jZfc75 / 605eb79, and the old admin conversation was verified accessible again. User clarification requested before overwriting the hidden allowlist, preserving any deliberate team access changes. Diagnostic code is merged but not currently served on the rose alias. No claim that rollout is complete until this blocker is resolved.
