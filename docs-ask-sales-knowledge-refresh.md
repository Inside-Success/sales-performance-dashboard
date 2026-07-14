# Ask Sales Daily Knowledge Refresh

Date: 2026-07-14

## Purpose

The refresh system checks the approved Ask Sales discovery sources every day, extracts possible policy changes, compares them with the governed V3 registry, and places proposals in an exact-email admin review queue. Discovery content never becomes answer authority automatically.

The live chatbot, Coaching workflows, Magic Mike report generation, and existing dashboard ingest paths are not modified by this system.

## Schedule and sources

- Schedule: daily at 9:00 PM in `America/New_York` (Miami), including daylight-saving changes.
- Slack: read-only access to `C0AUQKNR8CF` and `C09AF0NQJE7` only. Full channel history and thread replies are normalized into deterministic snapshots.
- Google: read-only access to the 37 Docs and four Sheets already present in the governed FAQ source corpus. Every visible Sheet tab is read through the Google Sheets API.
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

It uses the existing exact-email Ask Sales admin check on every page and API request. Non-admin requests receive the same hidden/not-found behavior as the other Ask Sales admin pages.

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

## Verification gates

- n8n runtime validation: zero errors on all five workflows.
- Dashboard Ask Sales tests, ESLint, TypeScript, and optimized Next.js build must pass before merge.
- Production must return `401` for the ingest route without the service token and `404` for the admin page when not signed in as an Ask Sales admin.
- A controlled first refresh run must confirm both Slack channels, sample Docs, every Sheet tab, unavailable-source behavior, DeepSeek JSON extraction, idempotent unchanged snapshots, conflict classification, and admin review without changing the chatbot runtime.
