# Ask Sales admin redesign — September 17, 2026

Released to production on September 17, 2026 (Pakistan time). Runtime PR201 is merged; production is READY. Final browser verification is partial because Chrome reports an extension popup blocking automation.

## Delivered scope

Conversations and Usage replace the old three-tab admin. Date ranges use inclusive Miami calendar days; search and filters cover full retained question/answer text, people, feedback/failures and review status. Full conversation readers include prior context, render safe Markdown, preserve source details and hide technical diagnostics behind a disclosure. Review notes and reviewed status are separate from chatbot answers and knowledge. New messages/feedback reopen review; optimistic version checks prevent silent overwrites. Existing exact-email admin authorization is unchanged. Rep navigation uses HMAC keys, not email URLs.

Usage counts actual user questions; returning users must have activity on at least two days in the selected period. One chart retains zero-activity days, with a daily-number table for accessibility. Rep history uses the same conversation reader. Known users are drawn from recent dashboard/call activity and retained Ask Sales users, not a complete HR roster. Admin accounts are excluded by default; an explicit switch includes them. Unknown test traffic cannot be inferred reliably.

Knowledge publication date is tied to the active knowledge hash, not page-load time. It shows unknown if the recorded publication receipt no longer matches. Weekly knowledge updates remain user-requested in the existing task; no new automation was created.

## Retired refresh workflow

The Source updates UI redirects to Conversations. Its interactive candidate/maintenance/release endpoints remain admin-gated and return 410 without mutation or publisher calls. Existing source registry, snapshots, checkpoints, candidate history and service safeguards are retained.

The dedicated daily orchestrator `ua18B5wbsYptLqJX` was deactivated through n8n MCP, not executed or deleted. Fresh comparison confirms `active=false`, with nodes, connections and settings unchanged. The analyzer has only an execute-workflow trigger, so pausing its scheduled parent stops the automatic proposal pipeline. Collectors, analyzer, credentials, error records and coaching workflows were not modified. Exact before/after snapshots are private under `.magic-mike-admin-2026-09-17/`.

## Verification results

Isolated SQL checks passed: question/answer search, full history, correct user counts, partial flags, feedback flags, review persistence, concurrent-write rejection, new feedback reopening, period-specific usage, admin exclusion and opt-in. A timestamp precision issue found in testing was corrected by retaining microseconds in review watermarks.

Hosted preview checks passed again on the final runtime source `d7795ee`: admin pages and reader, real HTML paragraph/list rendering, denied non-admin page access without conversation leakage, denied non-admin writes (404), cross-origin denial (403), review save (200), stale write rejection (409), retired publication (410), source-page redirect. Next.js streamed not-found/redirect documents sometimes carry outer HTTP 200; the checker verifies the framework denial/redirect marker and absence of conversation content rather than trusting HTTP status alone.

An additive production migration creates only `ask_sales_faq_admin_reviews`; it does not alter existing tables, answers, knowledge or permissions. Exact seven-column schema verified. Production read-only reconciliation found 55 questions, 16 people, one unhelpful rating and one technical failure for August 18–September 16 (Miami), **including admin activity**. Usage users and daily-chart totals both equal 55. The local environment export contains an empty value for the protected admin allowlist; the first draft incorrectly described this SQL check as excluding admins. That reporting error is corrected here. No production allowlist was changed. The live Conversations page with admin activity excluded showed 31 questions, 15 people, one unhelpful rating and zero technical failures. Counts are dated snapshots, not answer-quality scores.

Final CI [35142095251](https://github.com/Inside-Success/sales-performance-dashboard/actions/runs/35142095251) passed all 346 tests plus the static guards, TypeScript, lint and production build. Final preview `dpl_9ZcDdfHycrk5iDUAW1WnUDnhq93F` was READY on source `d7795ee1218535d960d112d0fadc457488d7ba12`. Hosted preview tests verified review saving and persistence, concurrency rejection and authorization; their disposable fixture was removed from the isolated preview database.

[PR201](https://github.com/Inside-Success/sales-performance-dashboard/pull/201) merged as `241063e04da70c1711da4706cea6d19523c1a906`. A fresh production build from that exact main commit, with production configuration, is READY as `dpl_3C8VmXwBRKbnL8wc6TAWAUMZgL3V` and owns `sales-performance-dashboard-rose.vercel.app`. This was not a promotion of the preview database/configuration. Vercel API creation was used because Git events did not start the expected deployments.

Production desktop Conversations was visually inspected at 1425px with no horizontal overflow. Browser navigation reached the live Usage URL/title. Further page inspection, mobile layout, live review-save interaction and chat/coaching visual smoke checks were blocked by Chrome's extension-popup error, which persisted after the user dismissed the popup. These are **not claimed as completed**. No production conversation or review note was mutated for verification. Existing runtime paths were unchanged and the shared production build passed.

Fifty source-registry checkpoints were preserved in the private verification folder for future user-requested weekly refreshes. No source history was deleted.

The old static guards assumed the removed source UI remained enabled. They were updated to require retirement and preserve access checks, opaque navigation and retained historical safeguards. No chatbot model calls were made or charged for this admin-only work.

## Boundaries and rollback

No changes to chatbot prompts, provider/model, runtime knowledge, scoring, coaching, report generation or auth configuration. Separate coaching PR196 remains open at its prior head. On rollback, revert this admin release and rebuild production with production configuration; leave the additive notes table intact. Do not restart the retired scheduler without a deliberate decision to resume automatic proposals.

## Remaining practical limitations

- Known-user coverage is not a complete employee roster; absent identities cannot be classified as non-users.
- Unlabelled test questions cannot reliably be separated from genuine rep use. Admin exclusion helps but is not a universal test detector.
- Review status means a manager looked at an exchange; it does not certify accuracy or repair a chatbot response.
- Historical answers remain historical. The redesign does not regenerate them or automatically change knowledge.
- Mobile and the remaining production browser interactions need a brief check once Chrome automation is available; automated and hosted-preview functional verification passed.
