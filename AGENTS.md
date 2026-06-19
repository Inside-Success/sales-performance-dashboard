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
- The new production bot intentionally does not emit numeric coaching scores/grades; blank/null score fields are expected and should not be treated as dashboard failures.
- Compliance categories and risk values feed manager dashboards, weekly summaries, and Google Sheet views. Be careful with schema or label changes.
- Hidden manager pages are `/manager/usage` and `/manager/sales-correlation?days=7|14|30|90`.
- Additional hidden manager pages include `/manager/compliance`, `/manager/rep-no-show`, `/manager/prompt-benchmark`, and `/manager/prompt-benchmark/submit`.
- `/manager/sales-correlation` reads the company sales Google Sheet as CSV, validates the live read, and stores only dashboard-owned last-good snapshots in Postgres. It must never write to the company sales spreadsheet.
- Official coaching usage, manual self-submitted feedback usage, and compliance feedback must stay separate.
- Report chat and sales-impact chat use `deepseek-v4-pro` through env var `DEEPSEEK_API_KEY`; do not commit keys.
- Report chat is coaching-only and must not answer compliance/legal/red-flag questions.
- Do not run local dev servers for this project unless the user explicitly overrides that rule.
