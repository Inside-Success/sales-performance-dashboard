# Magic Mike Bot / Sales Performance Dashboard

Vercel-hosted dashboard for n8n-generated sales coaching reports.

The app does not read Google Docs after creation. n8n posts the same structured coaching content it already generated into `/api/ingest`, and the dashboard stores one row per scored call.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS and shadcn/ui
- Neon Postgres through `@neondatabase/serverless`

## Local Setup

Codex/project-support note: for this production project, do not start a local dev server on the user's laptop unless the user explicitly overrides this. Make changes, run non-server checks such as lint/build when needed, push to GitHub, and let Vercel deploy from GitHub.

```bash
npm install
cp .env.example .env.local
# Do not run npm run dev in Codex/Claude support sessions unless explicitly approved.
npm run build
```

The app can load without `DATABASE_URL`, but ingest requires both:

```bash
DATABASE_URL="postgres://..."
INGEST_SECRET="long-random-secret"
```

Use `USE_DEMO_DATA=true` locally if you want a sample call without connecting a database.

## Database

Run `scripts/schema.sql` against the Neon database, or let `/api/ingest` create the table on the first successful post.

Primary dedupe key:

```text
airtable_record_id
```

## Ingest API

Endpoint:

```text
POST /api/ingest
Authorization: Bearer <INGEST_SECRET>
Content-Type: application/json
```

The endpoint upserts dashboard rows and returns:

```json
{
  "ok": true,
  "id": 123,
  "airtable_record_id": "rec...",
  "rep_slug": "rep-name"
}
```

## Routes

- `/` global searchable call library
- `/rep/[slug]` rep-scoped call library
- `/call/[id]` full coaching report
- `/submit` manual sales feedback submission
- `/manual-reports` completed manual reports by rep
- `/self-report/[publicId]` manual report status/detail page
- `/manager/usage` hidden manager usage analytics
- `/manager/sales-correlation?days=7|14|30|90` hidden manager sales-impact analytics
- `/api/usage-events` browser usage event ingest
- `/api/report-chat` gated DeepSeek report Q&A
- `/api/sales-analytics-chat` gated DeepSeek sales-impact Q&A
- `/api/report-feedback` Enhanced-report thumbs-up/thumbs-down feedback forwarding to n8n
- `/ask-sales-faq/admin/knowledge-refresh` admin-only daily source review, conflict resolution, and governed release preparation

## Current Behavior Notes

- Dashboard brand is Magic Mike Bot.
- Public dashboard pages use the red Magic Mike redesign from `design_handoff_magic_mike_dashboard`.
- Official report lists include lightweight filtering by client/cast name, meeting title, and meeting date.
- Manual reports are stored separately from official reports in `manual_feedback_reports`.
- Reports created before `2026-06-17T17:14:00.000Z` are tagged `Legacy`; reports created at or after that timestamp are tagged `Enhanced`.
- The feedback widget only renders for `Enhanced` reports. Thumbs-up feedback is anonymous. Thumbs-down feedback requires the rep's name and a required "What was off in this report?" response.
- Enhanced report feedback is forwarded to n8n workflow `Vt1Ze3LiWynk7mao` and stored in the production Google Sheet tabs `Positive Reviews` and `Negative Reviews`.
- Manual reports stuck in `pending` or `processing` for more than 5 minutes are treated as stale/timed out instead of showing an endless generation state.
- `/manager/usage` tracks official and manual usage separately. Usage tracking starts from the deployment that added events; older visits are not backfilled.
- `/manager/sales-correlation` reads the company sales Google Sheet as CSV, validates the read, stores a dashboard-owned last-good snapshot in Postgres, and falls back to that snapshot if the live CSV looks filtered/incomplete or fails. It never writes to the company sales sheet. It is a directional correlation/association page, not causal proof.
- Sales-impact matching canonicalizes known rep-name issues such as suffix `Success` and alias `ollie-mcfarl` -> `ollie-mcfarlane`.
- Report chat sends visible coaching fields and mandatory transcript text to DeepSeek only after the user sends a message. It is coaching-only and must not answer compliance/legal/red-flag questions.
- Sales-impact chat answers only from the current analytics snapshot and must not claim Magic Mike caused sales increases.
- Dashboard ingest and manual report callbacks are additive to the n8n workflows; dashboard failures should not block Slack, Airtable, Google Docs, or workflow continuation.

## Additional Environment Variables

```bash
DEEPSEEK_API_KEY="..."
REPORT_CHAT_ENABLED="true"
REPORT_CHAT_BETA_REP_SLUGS="comma,separated,slugs"
REPORT_CHAT_BETA_REPORT_IDS="comma,separated,ids"
SALES_PERFORMANCE_CSV_URL="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=0"
REPORT_FEEDBACK_WEBHOOK_URL="https://insidesuccess.app.n8n.cloud/webhook/magic-mike-report-feedback"
REPORT_FEEDBACK_WEBHOOK_SECRET="..."
ASK_SALES_KNOWLEDGE_REFRESH_TOKEN="long-random-server-only-secret"
```

`SALES_PERFORMANCE_CSV_URL` is optional because a default read-only Google Sheet CSV URL exists in the app. Sales-impact snapshot protection uses the dashboard `DATABASE_URL` and the `sales_performance_snapshots` table; it never writes to Google Sheets.

Never commit API keys or secrets. Never modify the sales Google Sheet from this app.

`REPORT_FEEDBACK_WEBHOOK_URL` and `REPORT_FEEDBACK_WEBHOOK_SECRET` are required server-side only. They are configured in Vercel Production as of 2026-06-18 and must not be exposed to client code or committed with real values.

## n8n Wiring

The prepared n8n node config is in `docs-n8n-dashboard-ingest.md`.

Do not wire the active n8n workflow until the Vercel deployment URL and `INGEST_SECRET` are final. The dashboard branch must stay additive and use error output handling so Slack, Google Drive, Airtable, and loop continuation remain unchanged.

Enhanced report feedback is a separate active n8n workflow and does not modify the Magic Mike generation workflows. See `docs-n8n-dashboard-ingest.md` for workflow ID, feedback Sheet URL, and verification notes.

Ask Sales knowledge refresh is a separate read-only source-monitoring system. It never writes to Slack or Google and never changes the runtime registry directly. The Google path and admin review queue are live; the Slack collector is safely retrying until a dedicated private-channel user-token credential is connected. See `docs-ask-sales-knowledge-refresh.md` for the source allowlist, workflow IDs, verified run state, human-review rules, and release boundary.
