# Ask Sales V4.2 Systemic Implementation And Evaluation

Date: 2026-07-23

Status: **implemented and verified in isolation; failed the production replacement gate. V3 remains live.**

## Outcome

V4.2 fixed the three named V4.1 failure shapes and preserved all 17 retained conversation/follow-up cases, but it did not improve the complete system on genuinely fresh questions. Source-by-source review of 50 recent authoritative Slack threads found that V4.2 abstained on three fewer answerable needs than V4.1, while making five more material errors and choosing the wrong owner for several live Finance, Greenlight, and Sales Tech actions.

The architecture is still useful, but this frozen candidate must not replace V3 or V4.1. The evidence narrows the next problem: recent authoritative knowledge is incomplete in the runtime corpus, and route ownership still depends too heavily on model request-kind wording instead of the original requested operation.

## Isolation And Safety

- Branch: `agent/ask-sales-v4-2-systemic-2026-07-23`
- Base V4.1 commit: `d90ea5decdd2ff3afe93bf65e83b3056c3d9f8da`
- Preregistration commit: `5fb7846`
- Frozen runtime commit: `36a5a00a25a2ebfa0aae718d30a51b507c4bf50c`
- Frozen runtime tree: `3444359c39e06cbad4901c76b507477d175d0d25`
- No runtime code changed after the fresh replacement set was opened.
- No V3 selector, production API, page, database, Neon state, Slack state, n8n workflow, Google integration, feedback, or conversation persistence was changed.
- Slack was read only. No message, reply, reaction, file, channel, or profile was changed.
- No local development server was run.
- No deployment, merge, cutover, or production replacement was performed.
- Evaluation artifacts remain local and untracked.

## What V4.2 Implemented

### Decision-object and measurement identity

The matcher now distinguishes the object being measured or decided, including handoff windows, deadlines, reapplication waits, availability periods, and session durations. It hard-rejects incompatible objects before exact-source recovery or validation can restore a merely related sentence.

### Artifact lifecycle identity

Artifact matching now separates pre-call templates, post-greenlight messages, approval or greenlight PDFs, contracts, recording artifacts, onboarding materials, and other lifecycle-specific documents. This prevents a similarly worded artifact from satisfying the wrong stage.

### Retrieval and validation hardening

Retrieval scores now include decision-object compatibility and stronger penalties for incompatible qualifiers. Exact-source recovery and sentence validation apply the same object checks so recovery cannot bypass them.

### Request-kind and route ownership

The route layer added operation-first rules for Finance, Greenlight, Sales Tech, policy, contract-redline, recording, referral-workflow, payment-page, CRM, technical-record, and missing-contract automation needs. Compound workflow-access gaps are preserved as separate atomic needs.

### Bounded runtime caches and tests

Object and relation inference caches are bounded to 4,096 entries. Deterministic tests cover object mismatch, artifact lifecycle, route ownership, recovery, and compound behavior. No benchmark question IDs, exact benchmark sentences, or one-off answer overrides were added to runtime code.

## Development Evidence Only

### Revealed V4.1 replacement set

On the previously revealed 50-case V4.1 set, V4.2 produced 16 answers, 2 clarifications, 6 partial answers, and 26 routes. It corrected the three specific V4.1 material failures:

1. the 7-minute pass-off window no longer matches a 30-minute licensing call;
2. the Monday greenlit-but-uncommitted email no longer matches a pre-call template; and
3. the greenlight-process case preserves the workflow-access need and appropriate artifact owner.

This was development evidence and cannot support promotion.

### Retained 78

The final retained replay completed all 78 cases with 32 answers, 3 artifacts, 17 conversation responses, 10 partial answers, and 16 routes. All 17 conversation/follow-up cases remained functional. Provider execution completed with 343 successful attempts and zero failures.

Retained artifact SHA-256: `4c79c23720621e5209281a1e74e2fe9da76f9dc7dff7fe5b76138ecb336088b5`

## Replacement Evaluation Set

The preregistered sealed builder failed closed because prior V4/V4.1 work had exhausted the remaining answer quota: only one unused answer case remained. It did not create or reveal a partial holdout.

A post-freeze diagnostic replacement was then built from 50 recent `#sales-questions-requests` threads with an authoritative reply: 30 answerable and 20 route/live/artifact cases. The set contains zero exact normalized overlaps with 257 prior prompts, and personal details were sanitized. Its source SHA-256 is `27c5e421a08724ee5c9aaf6fa5a278ef3c639b0179b4391c3d567a48cd72fc86`.

This is fresh source-backed evidence, but not canonical promotion evidence: it was manually curated after freeze and did not use independently created blind SME gold.

## Raw Fresh Behavior

| System | Answer | Partial | Clarify | Route | Provider result |
| --- | ---: | ---: | ---: | ---: | --- |
| V4.1 | 13 | 4 | 0 | 33 | 312 successful, 0 failed |
| V4.2 | 15 | 3 | 0 | 32 | 307 successful, 2 transient failures recovered |

V4.2 latency was 19.18 seconds p50 and 27.67 seconds p95. Every case completed and no runtime fallback was used. Lane movement alone is not correctness.

## Blind Judge Diagnostic

The same 50 source-backed cases were evaluated twice with system labels shuffled.

| System | Dual-pass weighted utility | Critical unsupported |
| --- | ---: | ---: |
| V3 | 27.8 | 0 |
| V4.1 | **55.0** | 1 |
| V4.2 | 50.8 | 1 |

Preference agreement was 92%, while per-need status agreement was 84%. Among consensus preferences, 37/46 were ties, 4 preferred V3, 3 preferred V4.1, and 2 preferred V4.2.

The judge is not the release decision. It accepted several generic `#sales-questions-requests` routes even when the source required Finance, Greenlight, or Sales Tech, and one pass treated phone-only payment/onboarding as correct despite the authoritative Zoom-recording condition. Those errors are why every case was also inspected manually.

Judge artifact SHA-256: `d42281a201fcdb72f79873f5393a2275c0a7af4321599d6069e560e9b41a822e`

## Source-by-source Manual Audit

The manual audit used the authoritative reply and expected owner for every thread, not only the judge label.

| Outcome | V3 | V4.1 | V4.2 |
| --- | ---: | ---: | ---: |
| Fully correct answer | 3 | 8 | 8 |
| Useful correct partial | 6 | 4 | 5 |
| Correct route/live owner | 11 | 11 | 8 |
| Safe false abstention | 15 | 15 | 12 |
| Materially wrong or wrong owner | 15 | 12 | 17 |
| Material high-impact errors | 1 | 2 | 2 |

Using the judge's 1.0/0.6/0/-0.5 utility weights on this single source review gives V3 20.2, V4.1 30.8, and V4.2 21.0. This number is a compact audit summary, not a universal accuracy estimate.

Important gains:

- V4.2 uniquely recovered the current package-upgrade form workflow.
- It correctly answered the cancellation/DNC boundary that V3 and V4.1 routed.
- It correctly routed an interrupted live greenlight case to Greenlight.
- It preserved correct answers for second-call stats, cast privacy, separate Daymond visits, unsigned-contract consequences, passenger calls, SAG, documentary scope, and other covered decisions.

Important failures:

- Recent authoritative answers for SEO, Sunbiz, Slack stats correction, outbound lead handling, Daymond deliverables, partner appearances, and several Next Level CEO details were absent or inaccessible.
- V4.2 regressed an answerable wire-payment SOP and the contract promotional-activities answer.
- It incorrectly described the swag package as not documented.
- It repeated a material phone-only payment/onboarding answer that omitted the required Zoom-video/recording policy.
- It repeated an incomplete and potentially misleading missed-deadline answer, omitting the six-month consequence.
- Live or controlled requests were sent to Sales Policy instead of the explicit owner: Greenlight contract confirmation, Finance contract voiding/payment failure, Sales Tech booking/referral/artifact/automation/stat corrections, and other workflow actions.
- A case-specific prospect review received generic rejection/package rules even though the necessary message was absent.

Manual audit artifact SHA-256: `d23f2f6c3a6a163c0924194234f76145684bbafdd07d7619978f9adef7a188a8`

## Verification

| Check | Result |
| --- | --- |
| Full Ask Sales Vitest | 37 files, 738/738 passed |
| Isolation validator | 15/15 passed |
| Fresh/replay validator | passed: 13 fresh and 16 replay prompts, including PII/source traceability |
| TypeScript | passed |
| Scoped ESLint | passed with zero warnings/errors |
| Optimized Next.js build | passed |
| `git diff --check` | passed before freeze |
| Secret/path scan | no provider-key, private-key, or workstation-path match in tracked candidate changes |
| Local development server | not run |

These checks prove implementation integrity and isolation. They do not override the failed behavioral release gate.

## Publication And Production-Unchanged Proof

- Dashboard draft PR [#73](https://github.com/Inside-Success/sales-performance-dashboard/pull/73) and FAQ documentation draft PR [#48](https://github.com/Inside-Success/faq-chatbot/pull/48) are open. Neither was merged.
- Dashboard governed CI run `30015751997` passed Ask Sales tests, static safety, V4 isolation, TypeScript, scoped ESLint, and the production build.
- The automatic branch Preview `dpl_AWPQwfaKCV7yTj2y1uCz5xvH7kTH` returned `ERROR` with no build log output. It was not retried or used as acceptance evidence.
- Dashboard `main` remains `1641c3fb9b410aa5a0d43c68b41edb0d04fbfc2b`.
- The production alias still resolves to `dpl_8UxUBMivafKEQN7fiy5aVMdETEFw`, target `production`, state `READY`.
- No production alias, deployment, environment variable, project setting, or integration was changed.

## Honest Decision

V4.2 is not better overall than V4.1 on fresh authoritative questions and is not ready to replace production V3. It meaningfully solved the object/artifact failures it targeted, so the work was not wasted, but the route-owner regressions offset those gains. V4.1 remains the strongest isolated baseline from this evaluation; V3 remains the only authorized live system.

The larger V4 direction remains viable. The next candidate should not loosen grounding or patch these 50 questions individually. It should:

1. implement a governed read-only Slack knowledge-refresh pipeline with authority, recency, conflict, and source-fidelity review before a rule becomes answerable;
2. derive route ownership from the original requested operation and artifact lifecycle before model paraphrasing, with Greenlight and Finance precedence over generic contract wording;
3. preserve live/action classification for booking, referral, controlled-artifact, automation, and record-correction requests even when the model labels them as knowledge;
4. add a deterministic contradiction gate for high-impact payment, deadline, contract, eligibility, and compliance claims; and
5. freeze that candidate and test it on another genuinely unseen stakeholder/SME-blind set rather than modifying it against this one.

No production replacement should be reconsidered until that candidate has no material high-impact error, materially better correct-answer coverage, and exact owner routing on fresh questions.
