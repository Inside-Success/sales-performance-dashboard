# Ask Sales evidence selection and conversation context — October 15, 2026

Status: published and production-verified October 15, 2026. Retrieval improved; ambiguity handling is only partially improved.

## Problem and scoped change

Recent saved conversations demonstrated two distinct causes of incomplete answers: general company-context dependencies consumed up to 28 of the 36 evidence slots before question-specific retrieval, and an assistant-introduced premise could persist through follow-ups despite never being established by the user.

Retrieval now gives the direct request and prior user context the first selection opportunities, followed by reviewed expanded-query candidates and fused rankings. General company context fills remaining space rather than occupying a mandatory prefix. Applicable governing evidence still precedes historical hits; product boundaries, source diversity and the 36-record maximum remain enforced. No question strings, topic-specific answer branches or new factual rules were added to production code.

Planner, answer and reviewer instructions now explicitly distinguish user-established relationships from assistant-added assumptions, including repeated assumptions. They preserve ambiguity and explain supported interpretations conditionally rather than narrowing the question into an artificial knowledge gap.

## Scope preserved

Knowledge remains `0492d8d294d53d729bc81946` (2555 records). October 14 is still the last knowledge-refresh checkpoint. No Slack/Google writes, knowledge/source edits, model/reasoning changes, extra model stages, schema/auth/env changes, Coaching or manager-feature changes. No local dev server.

## Validation design

- Same current knowledge and GPT-5.6 Luna medium for baseline/candidate; 20 selected real log questions retain their original user and assistant history, including mistaken assistant history.
- Eight separate synthetic holdouts cover general advice, unavailable actions, explicit independent production, Call 1 exceptions, paused products, changed people, assistant-invented context and product families.
- Synthetic retrieval test uses unrelated office-context chains plus a reimbursement rule, including reversed corpus order. Three commission phrasings verify reachability without production keyword gates.
- Existing full FAQ suite, static checks, TypeScript, scoped lint and production build; hosted release identity and authenticated UI verification required before completion.
- Raw logs, provider outputs and spending ledger stay outside both repositories. These are bounded comparisons, not a population accuracy estimate. Retain failed attempts and remaining weaknesses.

## Rollback and release boundary

Baseline Git main: `5158e3b`. Before-release rose deployment: `dpl_8GhVERnSMZzhYbnP9fe6sHUQYgrv`. Revert only this release's retrieval/prompt changes if needed; preserve concurrent dashboard work and October 14 knowledge. Do not roll back the entire shared application to an old knowledge-refresh deployment.

## Results and live receipt

- Final full FAQ suite: 406/406 passed. Initial run had one unchanged legacy V5.14 test exceed its 5-second timeout; its isolated 27-test suite and the final full run passed without relaxing timeouts.
- TypeScript, scoped ESLint and local webpack production build passed. The static validator initially failed because the October 14 admin-access refactor replaced inline allowlist parsing with getSalesFaqAdminEmails. Updated only that stale static assertion to check the shared accessor and its configured FAQ allowlist; runtime access policy is unchanged.
- Baseline implementation a3da3f01a25f8b76: 20 real-log replays. First candidate 208c257cceba5b9d: 20. Final 9b9eb3aaac059414: 20 plus eight independent synthetic holdouts. All 68 returned without technical errors. Estimated total isolated API cost $0.58991224, no unresolved reservations. Same knowledge, model, medium reasoning and original conversation history in paired runs.
- Concrete gains: dummy-passoff commission evidence/answer, active-show resource URL, and removal of the definite independent-production premise in the later documentary distribution answer. Final royalties answer also restores the supported no-cast-royalties explanation. These are qualitative paired observations, not a claimed all-question accuracy percentage.
- Median latency on the 20 real questions: baseline 13.478 seconds, final 13.582 seconds. Small uncontrolled sample; no meaningful speed gain claimed.
- Remaining limits: some replies are verbose/cautious. The separate marketing-onboarding holdout no longer assumes a hired agency as fact, but gives conditional external-service routing and a vague internal-reference answer instead of the most helpful existing Money Mondays path. Seven other holdouts preserve the relevant boundaries/usefulness. Do not claim all holdouts or all questions are fully solved. No broad knowledge rewrite was attempted.
- Preview dpl_D3yfMFJx3GxxmmpeY67KUoSD7mGi failed with Resource provisioning failed, before an application build. No preview success or database/env workaround is claimed. Production built successfully; no preview pass is claimed.


## Production verification

Dashboard PR305 and FAQ documentation PR105 are merged. Runtime merge a0dad194f03bff7db8838de07f68b9883c109e90 deployed READY as dpl_GR1oB7CF4BBX5zNxmUZoKfaXcJJ1 and was assigned the production rose alias. GitHub CI run 38714577437 passed all checks.

Authenticated Chrome work-profile checks verified three saved live responses: commission distinction (9.569s), broad documentary timing (17.128s), and an explicit package-documentary clarification (9.829s). All returned without technical failure, with unchanged model and knowledge identity. Commission now gives the supported 10% set-only / 20% set-and-close distinction. Explicit package clarification correctly explains the standard filming process and individual written-approval exception.

The broad documentary question remained overly cautious and implicitly separated a personal project from the package before the user established that distinction. It retrieved the relevant mini-documentary evidence but did not lead with the useful conditional answer. Thus live ambiguity handling is NOT fully solved, despite improved historical replay. Together with the marketing-onboarding holdout this is a retained limitation, not a claim of universal answer correctness. Do not add exact-question exceptions to conceal it.

FAQ admin access and current conversation list loaded successfully. Coaching home loaded its rep selector (166 reps); no coaching generation was triggered. A bounded production error-log scan returned no error entries. These checks do not prove every application path or every future answer.

Private evidence, including raw provider outputs, live message receipts and screenshot, is retained locally under .magic-mike-evidence-context-2026-10-15 and is excluded from Git. The $0.58991224 estimate covers isolated comparisons; the three live checks are additional normal production usage.
