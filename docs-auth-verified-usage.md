# Magic Mike Google Auth + Verified Usage

Updated: 2026-06-19

Magic Mike is live production. Do not run a local dev server for this dashboard unless the user explicitly overrides that rule.

## Production Auth

The dashboard uses Auth.js with Google OAuth only.

Required Vercel Production env vars:

- `AUTH_URL=https://sales-performance-dashboard-rose.vercel.app`
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_ALLOWED_DOMAINS=insidesuccesstv.com,insidesuccess.com,mawercapital.com`

Only Google accounts from the allowed domains can sign in. Human dashboard pages are protected through `src/proxy.ts`; `/api/*` routes remain public so n8n/webhook/API traffic is not blocked.

## Verified Usage Rules

New usage events are still written to `dashboard_usage_events`, but signed-in traffic now also stores:

- `viewer_email`
- `viewer_name`
- `viewer_domain`
- `viewer_rep_slug`
- `viewer_rep_name`
- `viewer_is_mapped`
- `engagement_seconds`

Viewer mapping is conservative:

1. Match by exact lowercased `performance_calls.rep_email`.
2. If email does not map, match by exact normalized Google display name against `performance_calls.rep_name`.
3. If the match is missing or ambiguous, keep the event as signed-in but unmapped.

Rep usage and sales-impact metrics use mapped verified users only. Managers/admins can sign in, but if they do not map to a rep, their activity stays out of rep-level metrics.

## Engagement Definition

`report_detail_viewed` records an open.

`report_engaged` records real report engagement only after 10 seconds of visible, focused reading time.

`report_active_time` records the final visible reading duration when available.

Sales impact uses verified official `report_engaged` events plus official report link clicks. Legacy anonymous events, quick opens, self-submitted feedback, and compliance signals are excluded from sales-impact usage scoring.

## Supplemental Chat Usage

Ask Magic Mike report-chat usage is tracked as a supplemental signal only:

- `chat_opened`
- `chat_question_sent`
- `chat_answer_received`
- `chat_error`

These events use the same signed-in viewer mapping as other usage events and include safe context such as report type, report ID/public ID, question length, and whether a starter prompt was used. They do not store the question text.

`/manager/usage` shows chat usage at the bottom of the page as a low-priority section. Chat activity does not count toward verified engagement, first-read reporting, or sales-impact usage scoring.

## Legacy Data

Old anonymous rows are not deleted. They remain in the usage database with `viewer_email = null` and appear only in the Legacy Anonymous Usage panel on `/manager/usage`.

The current verified rep table on `/manager/usage` is viewer-rep based and includes own-report vs other-report engagement.
