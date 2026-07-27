# Ask Sales V5.6 Unseen Promotion Gate Preregistration

Date: 2026-07-27

Status: preregistered before reading candidate Slack thread replies or generating V3/V5.6 outputs.

## Decision

This evaluation decides whether frozen V5.6 is ready for a separately approved, reversible production canary. It cannot deploy, merge, alias, or promote V5.6 by itself.

Frozen V5.6 dashboard commit: `1ba4f756357c0afe7ca4a3b4ac2fba84853c348a`

Production V3 remains live and unchanged. Runtime code, authority resolutions, knowledge overlays, and prompt behavior may not be changed after source-gold questions are revealed. If the gate exposes a runtime defect, the result remains valid evidence against this freeze; any correction requires a new candidate and a different unseen promotion set.

## Sources and write boundary

- Slack channel `C0AUQKNR8CF` is read-only. No message, reaction, draft, canvas, file, profile, reminder, or other Slack mutation is permitted.
- Only parent questions with a reliable threaded resolution are eligible for the primary source-gold gate.
- Preferred decision authors are Rich, Mike, Rudy, Raul, and Madeline. Another author may be used only when their ownership and the finality of the answer are clear from the thread.
- Authority is claim-specific. Rich normally controls the same sales decision, but a materially newer, explicit, and more specific owner decision can supersede an older step. Unresolved conflicts are excluded from answerable gold and retained as governance findings.
- Local privacy-reduced V3 production-log exports may supply a small realism diagnostic. No live database read or write is required. Production-log prompts do not count as unseen Slack promotion evidence.
- Google, n8n, Neon, Vercel production, authentication, and the governed publisher remain unchanged.

## Primary set

The primary set will contain exactly 30 prompts selected from previously unused Slack source threads:

- 22 standalone prompts;
- four two-turn conversations, for eight prompts;
- at least four correct passive-action or unsupported-question controls;
- at least six exact relationship, qualifier, scope, or authority challenges;
- at least six pricing, payment, contract, eligibility, or other high-impact decisions;
- representation of offers/platforms/content rights, qualification, sales process/timing, post-sale/fulfillment boundaries, privacy/claims, and action ownership.

The final source set must contain zero source-message-ID overlap with every earlier checked-in Ask Sales evaluation artifact. Questions must be understandable without a missing screenshot, attachment, undocumented pronoun, private client detail, or live case status.

## Admission rules

A candidate is admitted only when all are true:

1. the parent is a realistic sales-rep question;
2. the thread contains a final answer from a reliable owner;
3. the answer is sufficiently specific to define required and forbidden concepts;
4. the rule is stable enough for a passive chatbot, or the correct result is a deterministic action route;
5. source IDs, author, date, product, actor, action, object, stage, qualifiers, and operational effect can be recorded;
6. the question is not a duplicate or close paraphrase of an earlier evaluation item;
7. the source thread was not used to build or tune frozen V5.6.

Exclude live case-status checks, requests to perform an action, unresolved debates, tentative answers, expired one-time logistics, missing-context posts, non-sales chatter, and low-quality questions selected only because one system can answer them.

## Knowledge-presence split

Before runtime execution, every admitted item is checked against the frozen V5.6 snapshot and labeled:

- `present_exact`: the controlling raw record is in the frozen snapshot;
- `present_compatible`: the complete rule is available through compatible approved records;
- `missing_from_snapshot`: the source is authoritative but was never published into the frozen snapshot;
- `governance_conflict`: the current controlling rule cannot be established safely.

Runtime usefulness is judged primarily on `present_exact` and `present_compatible` items. Missing-source cases measure refresh/publisher coverage and must not be disguised as retrieval failures. Governance conflicts should route and must not be answered by guessing.

## Production-log realism diagnostic

Up to five additional privacy-reduced prompts may be selected from the existing local production-log export. Selection must be based on category coverage and real-world clarity before V5.6 outputs are generated. These prompts are reported separately and cannot rescue or fail the unseen Slack gate by themselves.

## Execution and blinding

- Run the exact production V3 entrypoint and frozen V5.6 entrypoint in process.
- Use identical DeepSeek provider, model, transport, and provider-availability requirements.
- Stop rather than substitute deterministic output when provider parity is unavailable.
- Freeze all runtime outputs before unblinding.
- Display the verified source rule above each blinded pair.
- Show one question at a time in batches of five and keep system identity hidden until feedback is exported.
- Safe non-answers on genuine action, unsupported, or governance-conflict controls count as correct.

## Promotion gate

V5.6 passes the technical gate only if all are true:

- every required output completes without a terminal provider failure;
- zero V5.6 material wrong-rule answers;
- zero V5.6 wrong action owners;
- no material regression in any required knowledge stratum compared with V3;
- at least 85% project-owner acceptable outcomes on the 30 primary prompts;
- a meaningful human usefulness lead over V3: at least four pairwise net wins and positive coverage in more than one knowledge stratum;
- all high-risk repeatability cases preserve lane, owner, numbers, permissions/prohibitions, and material qualifiers across three V5.6 executions;
- missing knowledge and runtime rejection are reported separately;
- the project owner explicitly approves any canary after reviewing the evidence.

These thresholds are guardrails, not substitutes for judgment. A safe route is not a failure when the chatbot should not answer. One confident materially wrong operational rule blocks promotion regardless of aggregate percentage.

## Verification before handoff

- dataset schema, hashes, source uniqueness, prior-source overlap, strata, and author evidence;
- provider-parity runtime receipts and complete causal traces;
- blind packet integrity and scorer binding;
- focused and complete Ask Sales tests;
- static safety and isolation validators;
- TypeScript, zero-warning ESLint, optimized production build, diff and secret checks;
- GitHub governed checks on the final isolated head;
- explicit proof that no production selector, deployment, alias, database, Slack, Google, n8n, authentication, subscription, or knowledge release changed.

No local development server may be run.
