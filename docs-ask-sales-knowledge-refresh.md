# Ask Sales Daily Knowledge Refresh

Date: 2026-07-14

## Purpose

The refresh system checks the approved Ask Sales discovery sources every day, extracts possible policy changes, compares them with the governed V3 registry, and places proposals in an exact-email admin review queue. Discovery content never becomes answer authority automatically.

The live chatbot, Coaching workflows, Magic Mike report generation, and existing dashboard ingest paths are not modified by this system.

## Schedule and sources

- Schedule: daily at 9:00 PM in `America/New_York` (Miami), including daylight-saving changes.
- Slack: read-only access to `C0AUQKNR8CF` and `C09AF0NQJE7` only. Both are private channels. Full channel history and thread replies will be normalized into deterministic snapshots after the dedicated Slack read credential described under **Current production state** is connected.
- Google: read-only access to the 37 Docs and four Sheets already present in the governed FAQ source corpus. Every visible Sheet tab is read through the Google Sheets API.
- The high-volume Green Light tracking Sheet is fingerprinted across every visible cell, but row-level operational records are deliberately excluded from AI review. The AI sees tab names, headers, row/cell counts, and full-tab fingerprints. Other large Sheets use bounded head/tail samples plus full-tab fingerprints, so middle-row changes are still detected without oversized requests.
- The Ask Sales Feedback output Sheet is deliberately excluded.
- Unavailable files remain visible, are recorded as unavailable, and are retried on later runs.

## n8n production assets

All assets are isolated in the Inside Success cloud at `https://insidesuccess.app.n8n.cloud`.

| Asset | ID | Role |
| --- | --- | --- |
| Daily orchestrator | `ua18B5wbsYptLqJX` | Runs at 9 PM Miami, reads the dashboard source registry, and routes only allowlisted sources. |
| Slack collector | `ODCwPMUxJphOSpcy` | Reads only the two approved channels and their threads. It has no Slack write node. |
| Google collector | `RJpxKZjm0f3gfWHS` | Reads Drive metadata, Docs text, and all visible Sheet tabs. It has no Google write node. |
| Analyze and stage | `rNc9rWTBHRSEwM3P` | Redacts snapshots, calls DeepSeek with a strict JSON extraction contract, and stages proposals for humans. |
| Error handler | `dX97Cup1oPeTS1wQ` | Redacts failures and stores them in the dedicated n8n data table. |
| Error data table | `J5Os7jQZCpiCNLxR` | Durable Ask Sales refresh failure queue, separate from Coaching. |

Dedicated credentials:

- `Ask Sales Knowledge Refresh - Dashboard Service`
- `Ask Sales Knowledge Refresh - DeepSeek`
- Moonis-owned Slack credential `Moonis - n8n integration bot`
- Moonis-owned Drive credential `Syed Moonis Haider cred`

No Deo-, Mike-, Rudy-, Tyler-, Bolaji-, or Coaching-owned credential is referenced.

## Dashboard architecture

The protected service route is:

```text
GET/POST /api/ask-sales-faq/admin/knowledge-refresh/ingest
```

It uses a server-only `ASK_SALES_KNOWLEDGE_REFRESH_TOKEN`, validates every payload, rejects non-allowlisted source IDs, removes common secrets and regulated-number patterns, hashes normalized content, and stores additive data in:

- `ask_sales_faq_refresh_sources`
- `ask_sales_faq_refresh_snapshots`
- `ask_sales_faq_refresh_candidates`
- `ask_sales_faq_refresh_releases`
- `ask_sales_faq_refresh_audit`

The admin page is:

```text
/ask-sales-faq/admin/knowledge-refresh
```

It uses the existing exact-email Ask Sales admin check on every page and API request. Anonymous requests redirect to sign-in. Authenticated non-admin and invalid requests receive the same hidden/not-found behavior as the other Ask Sales admin pages.

## Conflict and approval rules

1. Source text is untrusted discovery evidence.
2. The dashboard supplies DeepSeek only a compact set of related governed policies and unresolved blocked topics.
3. DeepSeek extracts candidate rules but cannot approve, reject, or publish them.
4. The dashboard independently recomputes policy overlap and conflict level.
5. Every candidate requires a human decision.
6. Direct or blocked conflicts cannot be approved without an explicit `supersede` or `scoped_coexistence` decision.
7. If a source changes after review, the previous proposal and approval become stale automatically.
8. Optimistic versions prevent two admins from silently overwriting each other's decision.

## Publication boundary

Content approval does not change production. `Prepare release` creates an immutable manifest and records the required compiler, test, diff, deployment, signed-in QA, error-log, and rollback checks.

Direct one-click Git publication is intentionally disabled until a dedicated, repository-scoped GitHub automation identity exists and the end-to-end governed compiler/deployment/rollback path is proven. Reusing a broad personal GitHub token or an unrelated n8n credential is prohibited. Until that final integration is supplied and validated, a prepared manifest must go through the existing reviewed Git release process.

## Current production state

The dashboard implementation was merged in PR [#47](https://github.com/Inside-Success/sales-performance-dashboard/pull/47). Retry-safe snapshot analysis was merged in PR [#48](https://github.com/Inside-Success/sales-performance-dashboard/pull/48), and audit-log backfill for already completed analyses was merged in PR [#49](https://github.com/Inside-Success/sales-performance-dashboard/pull/49). Production deployment `dpl_2KF72Mq7R5iYRkUnGTCd7KDVxVCX` is `READY` on `https://sales-performance-dashboard-rose.vercel.app`.

The five n8n workflows are active and validate with zero runtime errors. The daily orchestrator has only its permanent `Daily 9 PM Miami` trigger; every temporary verification trigger has been removed.

Controlled run `348148` completed successfully. It checked all 43 governed sources:

- 36 of 37 Google Docs and three of four Google Sheets are available.
- One legacy Google Doc (`1GHvm...`) and the All SOPs Sheet (`1geZ...`) return `404` to the Moonis-owned Drive credential. They remain visible, unavailable, and retry automatically every day.
- All 39 accessible Google sources completed collection. The final run recorded 36 unchanged sources and three intentionally changed Sheet snapshot representations.
- All 41 stored source-version snapshots have completed AI analysis; zero snapshots are left in an incomplete-analysis state.
- The current human queue contains 268 `needs_review` proposals and 20 safely `stale` proposals. Nothing in either group is production answer authority.
- The final run's only four isolated errors were the two expected Google `404`s and the two Slack scope failures. There were no Sheet payload errors, unchanged-snapshot errors, DeepSeek truncations, or dashboard runtime errors.

Slack is the only external-access blocker. The existing credential `Moonis - n8n integration bot` is also used by active sales-performance, stats-backup, and transcript workflows, so it was not modified. Both approved channels are private. A new dedicated Moonis-owned Slack **user-token** credential must be installed in n8n with `groups:history`, and that user must be a member of both channels. Slack's `conversations.replies` rules require a user token for public/private channel threads. Once that dedicated credential exists, replace only the Slack collector's credential reference and rerun the controlled Slack check; do not reconnect or broaden the shared production credential.

## Verification gates

- n8n runtime validation: zero errors on all five workflows.
- Dashboard Ask Sales tests, ESLint, TypeScript, and optimized Next.js build must pass before merge.
- Production returns `401` for the ingest route without the service token. Anonymous admin requests redirect to sign-in; authenticated non-admin requests must remain hidden as `404`.
- Controlled Google verification, unavailable-source handling, DeepSeek JSON extraction, retry-safe analysis, unchanged-snapshot idempotence, conflict classification, and admin staging are complete. The Slack portion remains blocked only by the dedicated private-channel user-token credential described above.
