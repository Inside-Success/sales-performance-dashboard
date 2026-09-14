# Isolated staging verification

This is a verification log, not production deployment approval.

## Infrastructure

The existing Neon project had reached its 10-branch limit. Nine branches were archived previews; `main` was the production branch. Older unrelated dashboard previews had the same provisioning failure.

After explicit user approval, only `preview/agent/ask-sales-policy-plan-v2` (`br-square-fog-aqk2s1bq`) was deleted. Its PR #1 had merged on July 9, and Neon recorded it as archived since July 24. The console then showed 9/10 branches and production `main` still present. No other old branch was deleted and no plan was upgraded.

Retrying the revamp preview successfully provisioned `preview/agent/chatbot-revamp-2026-09-15` (`br-ancient-night-aqyzbw2z`). Its database endpoint was checked against the Neon console and a read-only SQL connection. Production remains `br-long-snow-aqr75bys`. The project is at 10/10 branches again; another unrelated preview will need its own capacity resolution.

Only the Git branch `agent/chatbot-revamp-2026-09-15` has the revamp preview overrides: isolated `DATABASE_URL`, separate auth and ingest secrets, Luna configuration, a synthetic test admin, knowledge publishing disabled, and no outbound feedback or publisher webhook. Global inherited Postgres aliases still identify an older endpoint; this application uses `DATABASE_URL`, which is explicitly overridden. Do not copy another alias over it.

## Hosted checks at candidate fc860851

Deployment `dpl_5gj4U8yShQ3jJGahY2KJSYKmVfLB` reached READY.

- Signed-out browser navigation displays the Magic Mike Google sign-in page.
- An unauthenticated conversation-history API call returned 401.
- A one-hour synthetic session, signed using only the isolated preview secret, authenticated successfully. This is API authentication verification, not a completed Google OAuth login test.
- The initial test account had empty history. A greeting returned a Luna conversation response in 2.959 seconds with no Slack route.
- History reloaded the saved user and assistant messages.
- Repeating the same request ID returned the existing message ID and the replay header. This exposed a provider-label normalization omission, now fixed in the next candidate.
- Positive feedback saved and explicitly reported external sheet sync skipped because no webhook was configured.
- The test admin could load quality and knowledge-refresh pages. A second test account saw empty history and no admin content. Next.js streamed its not-found boundary with HTTP 200; checking only the status would have missed this distinction.
- Inspection found feedback writes lacked message ownership enforcement. The next candidate inserts feedback only for an assistant message belonging to the signed-in viewer and supplied conversation. Rejected ownership never reaches external sync. Two route tests cover rejection and normal feedback.

Production was rechecked as READY at commit `325a8243d5700f66e80c8c6377db9f88859f52ea`, retaining the production domain. No production database writes, environment changes, main merges, or n8n publications were performed.

## Follow-up checks at candidate 573036e

Deployment `dpl_FcCzqzHBNU2i9HjeuABA98knhh8f` reached READY and its GitHub validation passed. Replaying the saved request returned `provider: openai`. The second test account's attempt to rate the first account's answer returned 404. The owning account's feedback returned 200, with sheet sync still skipped as unconfigured.

## Remaining verification

Google OAuth in preview is not configured. Source refresh, release version conflicts and materialization have local automated coverage; full hosted publication stays disabled. Do not report these partial checks as complete browser-to-production verification.

## Final implementation verification at 8312430

Dashboard CI run `34901889430` passed, including all 308 tests, static checks, TypeScript, scoped lint and production build. Paired FAQ commit `f2c8a26` passed CI run `34901890478`. Vercel deployment `dpl_3KjpDJ2oWGMBEhmnvW6D6z2iDEn9` reached READY; the GitHub status on exact head `83124305500c6ad2fcc1deadc7fdf4e2becdbbce` identifies that deployment.

On this final implementation, replay returned the original message with provider `openai`; another account's feedback returned 404. A new company-policy question, following the earlier greeting in the synthetic conversation, returned the correct three-month ordinary main-show payment/signature-deadline rule in 5.961 seconds. A read-only query scoped to that synthetic message on the verified isolated endpoint confirmed runtime `revamp` and effective registry `67d5ad54a3450de58b7fa635`.

Both remote main refs were rechecked and remain unchanged. These checks do not close the remaining OAuth, independent quality acceptance or controlled publication gates above. Later documentation-only commits do not change this tested implementation.
