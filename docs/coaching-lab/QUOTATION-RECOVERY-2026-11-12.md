# Source quotation validation and recovery — November 12

## Scope and cause

Authorized scoped fix for quotation-only coaching holds and recovery of source `recz9YQhQ1yZRjNQu` (Jessica / Robert). Script Adherence is explicitly outside scope. The previous native core execution 1703082 rejected an otherwise contiguous quotation solely because the reviewer wrote `what` while block T0046 said `What`; its bounded repair repeated that difference. Parent 1703051 retained the source rather than delivering an unaudited report.

## Change

One shared resolver accepts exact source substrings first. Otherwise it permits only ASCII capitalization, whitespace runs and curly/straight quotation typography, and requires exactly one contiguous match in the specified unique source block. It restores the original source span. No paraphrase, dropped words, punctuation stripping, numeric rewriting, negation changes, cross-block search or fuzzy matching is allowed. Short-fragment protections remain. Raw provider receipts and original transcript blocks are unchanged.

The review edit ledger, observation dispositions, coverage additions and exceptional safety adjudication use the same validation. The older judgment validator uses it as well. Prompts, model configuration, request identity, generation, policy, taxonomy and independent final safety review remain unchanged. The application only normalizes derived evidence, never cached provider data. No additional AI node or API request is introduced.

## Verification before release

The 344-test coaching suite passed, followed by two added integration regressions for coverage additions and adjudication. The held call's saved analyst, writer and original reviewer receipts replay through the compiled native Start/Advance nodes to the mandatory safety stage, without a new request or a format repair. Workflow connections and expressions validate with zero errors. Bundled code is compiled and directly executed, rather than relying on the static validator's known array-return heuristic.

## Deployment, recovery and rollback

Pending final receipt entry. Only the active core's Start/Advance bundled transition code will change; node inventory, connections, settings, model envelope, parents and other workflows are preserved. Private before/target snapshots and compare-before-write checks guard concurrent changes. Rollback restores the two original node bodies only after verifying the live installed version. Recovery must check terminal ownership, no active provider work and no existing delivered artifact before releasing the exact held claim. The existing recovery worker must perform normal source/artifact checks and independent safety before delivery.

### Related identity boundary discovered during recovery

PR422 merged as `9ac4289df37daddee7c920c9f9c21a13bc512b55`. Core version `75a3fd75-57d4-44b4-b770-606a6174fc6f` was published with only Start/Advance changed. Official/manual parents and provider matched their pre-existing snapshots. Jessica's exact claim and queue row were released once; native parent 1703636 started recovery.

A separate call (`recfSF8zfKcSHnu5E`, parent1703522/core1703570) failed before this patch with the same lowercase-versus-uppercase difference in identity evidence. Extend the shared resolver to that layer as well. During Jessica's recovery the cached identity object's JSONB property order also changed the bound policy string, missing its existing writer checkpoint. Fixed explicit identity field ordering now preserves the normal analyst schema order across cache roundtrips. Do not interrupt or replay already running paid requests. This correction changes neither identity interpretation nor governed policy.

348 coaching tests pass, including identity evidence restoration and JSONB key-order invariance. Saved real failures replay to safety (Jessica) and writer (identity case), with no paid test calls. The original exact analyst/writer/reviewer receipt IDs for Jessica still match the corrected transition; the already-running native recovery remains on its immutable execution snapshot.
