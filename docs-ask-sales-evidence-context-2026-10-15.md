# Ask Sales evidence selection and conversation context — October 15, 2026

Status: candidate under isolated evaluation; not yet a production receipt.

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

Pending final evaluation and release verification.
