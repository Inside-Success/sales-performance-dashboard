# Ask Sales FAQ V5.14 Production Cutover

Date: 2026-07-28
Status: V5.14 live in production; rollback remains available

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

- Focused release PR: `Inside-Success/sales-performance-dashboard#88`.
- Governed exact-head CI: run `30358213867`, passed.
- V5.14 feature head: `83c5bd520e6696d5b5a04fe6359a370cab2280ec`.
- Merged production commit: `1e7fd8a28b8de05bc6354dd653c844f89c173fd8`.
- Stage A production deployment with the selector still on V3: `dpl_B3cF4R7nEPpwbtVfx9YCyBnCcnBj`, `READY`.
- Production selector changed only from V3 to `v5.14`; no other environment value was changed.
- Live V5.14 deployment: `dpl_FLXZhHVwJ8py4TXcbHDazh69TVhK`, `READY`.
- Production alias: `https://sales-performance-dashboard-rose.vercel.app`.
- Deployment metadata confirms `main`, the exact merged commit, a verified GitHub commit, and no alias error.
- Post-cutover page check returns the expected authentication redirect (`307`).
- Post-cutover unauthenticated API check returns the expected safe rejection (`401`).
- Post-cutover Vercel runtime-error query reports no errors; the observed logs contain only those two intentional access checks.
- Production environment inventory confirms that `DEEPSEEK_API_KEY`, `FAQ_DEEPSEEK_MODEL`, authentication, database, feedback, and refresh variables remain assigned. Vercel intentionally does not expose sensitive production values to a local `vercel env run`, so that command cannot serve as an authenticated provider smoke test.
- An authenticated browser/API exchange was not fabricated or bypassed. The first real signed-in question must be checked in the stored runtime metadata for `pipelineVersion=v5.14`; absence of that marker or provider failure is an immediate rollback trigger.

## Exact rollback

1. Set production `ASK_SALES_FAQ_RUNTIME_VERSION` back to `v3`.
2. Redeploy the verified pre-release V3 deployment `dpl_8UxUBMivafKEQN7fiy5aVMdETEFw` (commit `1641c3fb9b410aa5a0d43c68b41edb0d04fbfc2b`), or redeploy the current code with the V3 selector if application code is healthy.
3. Confirm the production alias, authentication redirect, unauthenticated API rejection, and a signed-in V3 exchange.
4. Do not modify the daily refresh workflow or knowledge approvals during rollback.

## Deferred work

The older saved policy-matching replacement remains intentionally pending. It was not mixed into the production cutover.

## Post-launch health and presentation follow-up

Date: 2026-07-28

- Five genuine authenticated production questions completed with HTTP `200`; their conversation-history reads also completed with HTTP `200`.
- All five stored exchanges report `pipelineVersion=v5.14`, `error_class=null`, the expected source label, and `answer_from_evidence`.
- Four model-backed responses used `deepseek-v4-pro`; the exact governed pricing response correctly used the deterministic path. No provider terminal failure occurred.
- Vercel reports no Ask Sales runtime-error cluster after launch.
- A narrow presentation fix removes a structured body or item when it exactly repeats the already-visible summary. Additional steps, caveats, and non-duplicate structured content remain visible.
- Focused presentation checks pass 7/7; the complete Ask Sales suite passes 17 files / 273 tests; static safety passes 107/107; TypeScript, zero-warning scoped ESLint, and the optimized production build pass.
- The rude/poor-fit test response was source-grounded and safe but did not directly settle whether the rep should end the live call immediately. This is an answer-completeness watch item, not a runtime or deployment failure.

## Admin operations completion

Date: 2026-07-29

- The 9 PM read-only source refresh, human approval, protected publication, and production verification path is operational and has published an approved release successfully.
- The noisy 9:20 PM AI quality-audit workflow remains inactive. Its six historical failed executions and stored review history are preserved; no production log or historical record was deleted.
- Quality review is now manual and requested only after enough real production data has accumulated.
- `/ask-sales-faq/admin` is reduced to four understandable counts, a precise attention list, recent conversations, and collapsible feedback/technical details.
- Safe routes remain visible but no longer appear as defects. Only runtime failures and thumbs-down answers enter **Needs attention**.
- Rep adoption and Source Updates were not changed by the Quality & Operations cleanup.
- The build phase is operationally complete. Continuing source approvals and periodic log reviews are normal maintenance, not unfinished implementation.
