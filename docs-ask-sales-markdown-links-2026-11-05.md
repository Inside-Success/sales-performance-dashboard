# FAQ Markdown resource-link validation — November 5, 2026

Candidate targeted repair; production verification pending.

## Confirmed problem

Two November 4 evaluation outputs contained a valid source-backed Magic Mike URL wrapped in Markdown bold. The raw URL regex consumed the closing emphasis markers, producing `unsupported_url` and replacing the reviewed answer with a technical fallback. Removing only URL emphasis in memory made the exact saved answer pass. The current production implementation was checked before editing. Italics and inline code reproduced the same class of mismatch.

## Change and safety boundary

Use the same Markdown dialect as the existing answer renderer (remark-parse and remark-gfm) to extract actual destinations, then retain exact source matching and the existing sentence-punctuation tolerance. Parse both source text and answer text. Resource URLs in code still require evidence. Reference-link destinations are checked, including an untrusted destination hidden behind an approved-looking label. Do not strip arbitrary stars, underscores, query strings, fragments, encoded characters or URL path components. Keep unknown/missing evidence and unsupported route checks.

The parser packages were already locked transitively through the renderer; declare those same versions directly (unified 11.0.5 and remark-parse 11.0.0). No dependency upgrades. No model, prompts, retrieval, knowledge, UI, Coaching, permissions, provider retry or schema changes. No new AI call or automatic retry. Knowledge remains `b34d16420bf7dff04d1be866`, 2,599 records; retain November 4 source checkpoint and freshness date. Source Docs/Slack unchanged; no Slack messages.

## Verification

- 35 new regression cases cover emphasis, code, lists/tables, reference links, Markdown/rendering agreement, escaped characters/entities, legitimate URL special characters, spoofed hosts, invented paths/query/fragments, masked destinations and evidence/route boundaries.
- 527/527 FAQ tests, 107/107 static checks, TypeScript and scoped lint pass.
- Exact saved-output replay: 32 outputs from two prior 16-case runs. Both previous formatting failures pass; 30 previously passing outputs still pass. This is validator acceptance, not a claim of independently rescoring every answer's factual quality.
- Local representative validation: first measured call 28.2 ms; 100 warmed calls median 10.8 ms, p95 20.2 ms. No meaningful slowdown shown locally; not a production latency SLA or complete cold-start benchmark.
- Fresh isolated model checks and authenticated live verification recorded below when complete.

Private evidence: `.magic-mike-faq-markdown-links-2026-11-05/`. Rollback: revert only this repair's parser/runtime/tests/dependency declarations. Preserve knowledge and unrelated Script Adherence releases. This repair prevents formatting-based false rejection; it does not remove real grounding failures or guarantee every future provider response succeeds.
