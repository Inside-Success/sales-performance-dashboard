# Ask Sales FAQ V5.14 Production Cutover

Date: 2026-07-28
Status: implementation validated; production cutover in progress

## Scope

This release promotes the reviewed V5.14 answer architecture through the existing authenticated `/api/ask-sales-faq` route. It preserves the production page, authentication, request validation, rate limits, duplicate-request protection, conversation storage, feedback, admin analytics, and database schema.

The daily knowledge-refresh simplification and the older saved policy-matching replacement are explicitly out of scope and remain on hold.

## Safety design

- The cutover branch starts from the exact pre-release production commit `1641c3fb9b410aa5a0d43c68b41edb0d04fbfc2b`.
- The historical V5 research PR is not merged because it is stacked on another feature branch and contains a large evaluation history.
- Only the V5.14 runtime/compiler dependencies, a production adapter, selector support, and focused tests are added.
- `ASK_SALES_FAQ_RUNTIME_VERSION=v3` remains the first deployment state. V5.14 is enabled only after that exact deployment passes.
- Empty, misspelled, and unknown selector values fail safely to V3. V2 is explicit-only.
- A selected runtime never falls through to a different runtime after a retrieval, model, or validation failure.
- V5.14 uses the existing production `DEEPSEEK_API_KEY` and `FAQ_DEEPSEEK_MODEL`; no new credential or subscription is introduced.
- Input and retained conversation context are sanitized before both deterministic and model-backed V5.14 paths.
- The existing governed release ledger remains part of the materialized V5.14 corpus. A later admin-approved policy with the same decision key supersedes a bounded direct policy.
- Rollback is the frozen pre-release production deployment plus `ASK_SALES_FAQ_RUNTIME_VERSION=v3`.

## Verification before publication

- Focused cutover and V5.14 source-preservation tests: 35/35 passed.
- Complete production Ask Sales test suite: 17 files / 271 tests passed.
- TypeScript: passed with `npx tsc --noEmit`.
- ESLint: passed with zero errors or warnings.
- Next.js 16.2.6 optimized production build: passed.
- Credential-pattern scan: no committed credential found.
- No local development server ran.
- No Slack, Google, n8n, database, governed-release, authentication, or daily-refresh write was performed during implementation.

## Deployment sequence

1. Publish and merge the focused main-based cutover PR after exact-head CI passes.
2. Verify the resulting production deployment while the runtime selector is still V3.
3. Update the production selector to `v5.14` without changing any other environment value.
4. Redeploy the exact verified code commit.
5. Verify the production alias, exact commit, authenticated route behavior, runtime logs, error rate, and availability.
6. If any rollback trigger fires, restore the frozen pre-release deployment and reset the selector to V3.

## Rollback triggers

- deployment is not `READY` or the alias points to an unexpected commit;
- authentication, request guards, storage, or feedback behavior regresses;
- V5.14 cannot access the configured provider;
- production responses do not record `pipelineVersion=v5.14` once real traffic arrives;
- new runtime errors or materially unsafe answer behavior appear;
- latency or provider failures become operationally unacceptable.

## Final production record

To be completed after the two-stage deployment and post-cutover verification.
