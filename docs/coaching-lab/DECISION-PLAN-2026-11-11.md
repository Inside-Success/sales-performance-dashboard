# Coaching decision-plan isolation — November 11

Status: implementation complete; frozen evaluation in progress. No production change or release recommendation yet. This supersedes the proposed further prompt-tuning direction in EDITORIAL-FINALIZATION, not its historical evidence.

## Problem and change

The previous analyst → writer → reviewer → safety path could discard useful contextual teaching after writing. Accountability proved where edits came from, but not that the judgment was right. The opt-in `decision-plan-v1` path now uses four normal calls: Terra builds source-bound decisions and observations; Terra independently reviews those decisions; Sonnet expresses the reviewed plan through prose-only patches; DeepSeek verifies facts, safety and preservation of meaning against both the full source and reviewed plan.

The plan reuses the existing report ontology for decisions, evidence and inventory; it is not a new user-facing section. The writer cannot change categories, handling, resolution, evidence, inventory or order. It can hold a contradictory plan instead of silently changing it. Final verification may still identify a genuine error in the plan: it is not unquestionable ground truth. One bounded substantive prose correction is allowed, followed by another independent check; non-prose contradictions and repeat failures remain held. Existing source identity, provider receipts, review provenance and publication guards remain in force. Production defaults are unchanged.

Prompt responsibilities are separated: foundations/interpretation/strategy/execution and governed offer facts inform planning and judgment review; expression owns readability and concision; final verification owns factual integrity and meaning preservation. Existing production layouts/readers and report taxonomy stay intact. No new AI stage is added to the four-call candidate.

## Frozen evaluation and stopping rule

Six known real regressions, four unused real calls (two documentary, two reality), and four synthetic contrast cases were selected before candidate inspection. There is no unused NLCEO call in the available snapshot; its known regression is retained. Synthetic scenarios test mechanisms, not population accuracy. Full sources and source-first expectations remain private.

Material unsupported advice or accusations, invented commitments, policy contradictions, lost material concerns, and reversed meaning fail acceptance. A different defensible lesson, stylistic preference or omitted optional lesson does not by itself block release. Compare selected prior candidate and current production on the same real calls; judge against full sources, not agreement. Do not alter prompts after seeing this cohort. Validate actual compiled official/manual adapters, isolated storage and authenticated reader paths. No external Slack/Doc deliveries or production writes.

Starting cumulative cost: $58.550417634 of $70; remaining $11.449582366. Exact-request reservations and settlements remain mandatory; uncertain paid requests are never replayed. Only the existing isolated transport is activated temporarily, then shut down after all outcomes are reconciled.

Implementation check caught an incomplete output specification: six first-stage plans used unspecified observation labels or nonempty sound-handling feedback fields. They were held before downstream processing. The explicit enum/field invariants and one bounded format repair were added; all six terminal attempts are retained and charged ($0.39980810 total). No assessment criteria, call selection or substantive coaching rule changed. The corrected contract is frozen for the full run; the initial attempts are not counted as completed reports.
