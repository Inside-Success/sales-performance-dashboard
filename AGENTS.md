<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Deployment Rule

Do not start or run a local dev server for this dashboard project unless the user explicitly overrides this rule.

For dashboard/web changes:

1. Make scoped code changes.
2. Run non-server checks such as lint/build when appropriate.
3. Push changes to GitHub.
4. Let Vercel deploy from GitHub and verify the deployment there.

## Current Production Notes

- Dashboard brand is Magic Mike Bot.
- Magic Mike is live on the new multi-stage production workflow `L8Nn7xncA9ZPDdWA`.
- Forward-only scoring V2 is authorized for numeric-only display on matching coaching reports. The coaching writer itself still does not generate the numeric grade. Missing, excluded, invalid or historical scores remain blank; never invent a fallback. Manager reasoning remains restricted. See MAGIC-MIKE-SCORING-FORWARD-2026-09-10.md.
- Official crash recovery now detects both error and crashed executions, reuses exact-match unreviewed drafts through the existing factual audit, and holds terminal stale worker claims before retry. See MAGIC-MIKE-CRASH-RECOVERY-2026-10-09.md; preserve source/report deduplication and do not bypass review.
- Prospect identity is resolved in intake and official coaching from transcript/title evidence, including corroborated nicknames and compound titles with known reps. Assistant/meeting labels are fallbacks, never canonical person evidence. Preserve raw speaker aliases, exact matched manual names, item pairing and duplicate controls. Retain an external device/display label when identity evidence is insufficient. See MAGIC-MIKE-PROSPECT-IDENTITY-2026-10-09.md for versions, tests and scoped rollback.
- Final names must survive unchanged-name handoffs and empty Airtable fields. Recent report outcomes are parsed by semantic labels before duplicate comparison; preserve very old layouts and structured reviewed sections. See MAGIC-MIKE-NAME-OUTCOME-CONTRACT-2026-10-12.md for this scoped repair and rollback.
- Compliance categories and risk values feed manager dashboards, weekly summaries, and Google Sheet views. Be careful with schema or label changes.
- Hidden manager pages are `/manager/usage` and `/manager/sales-correlation?days=7|14|30|90`.
- Additional hidden manager pages include `/manager/compliance` and `/manager/rep-no-show`.
- The admin-only rep performance reviewer is `/manager/rep-scoring`. It reads the isolated Airtable scoring base, is exact-email allowlisted, and must never write to source calls, Slack, or Google content.
- Sales Impact now counts distinct mapped own official report opens, uses complete Miami-date periods, keeps unmatched sales identities separate from zero, and presents paired before/after and non-overlapping subsequent-sales checks. See MAGIC-MIKE-SALES-IMPACT-2026-10-14.md. Its chat must use the same read model and an authenticated session. Do not reintroduce the ten-second engagement threshold on this page.
- `/manager/sales-correlation` reads the company sales Google Sheet through an isolated authenticated, read-only n8n sync. Validated reads are saved in dashboard-owned Postgres snapshots; the page shows refresh freshness and warns after two hours without a successful refresh. Legacy CSV remains a fallback before the first authenticated sync. It must never write to the company sales spreadsheet.
- Official coaching usage, manual self-submitted feedback usage, and compliance feedback must stay separate.
- Report chat uses `gpt-6-luna` through server-only `OPENAI_API_KEY` and requires a signed-in session. Sales-impact and rep-no-show chats still use `deepseek-v4-pro` through `DEEPSEEK_API_KEY`; do not commit keys.
- Report chat is coaching-only and must not answer compliance/legal/red-flag questions.
- Do not run local dev servers for this project unless the user explicitly overrides that rule.

## Admin directory and leadership access (October 14)

- `/admin` is the authorized admin directory, linked from the homepage only for eligible admins. All `/manager/*` views require the shared exact-email manager policy; data pages and chat endpoints also check access before reading data or calling a provider.
- `src/lib/approved-admin-emails.ts` contains the owner-approved leadership roster plus Dagim. Preserve configured manager and FAQ admins additively. FAQ-only legacy admins retain their existing FAQ permissions; they are not promoted to manager access.
- Rudy and Mike have exact-email sign-in exceptions. Never authorize the Gmail domain broadly. Source Sheets, coaching workflows and external Mock Call Agent permissions remain unchanged.
- See MAGIC-MIKE-ADMIN-DIRECTORY-2026-10-14.md for scope, verification and rollback.

- Admin UI follow-up: see MAGIC-MIKE-ADMIN-UI-POLISH-2026-10-14.md. Never use a full-page minimum-height class on the compact directory return nav. The directory is named Admin Insights; its link order and page URLs are deliberately separate.

## Dashboard performance reads (October 15)

- See MAGIC-MIKE-PERFORMANCE-2026-10-15.md. Source Sheets/Airtable remain read-only. Successful snapshots and timestamps must survive failed refreshes; never cache empty failure results or show them as genuine zeros. Preserve auth before all admin reads. Attendance history and score matching remain complete and exact.
