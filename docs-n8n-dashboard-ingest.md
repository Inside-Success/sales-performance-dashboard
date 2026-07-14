# n8n Dashboard Ingest Node

Current note - 2026-05-31:

- The dashboard ingest branch is already live in the production `Sales performance bot`.
- Keep this file as a reference for the original node shape and safety rules.
- Do not reapply this as a new node without checking the live workflow first.
- Dashboard-side additions since this file was first written include hidden usage analytics, hidden sales-impact analytics, and DeepSeek chat APIs; those do not require changes to this ingest node.
- Dashboard-side additions on 2026-06-18 include the public red Magic Mike redesign, `Legacy`/`Enhanced` report tagging, and an Enhanced-only report feedback API.
- The 2026-07-14 Ask Sales daily knowledge refresh uses five new isolated workflows and dedicated credentials. It does not modify this coaching/report ingest workflow. See `docs-ask-sales-knowledge-refresh.md`.

This file is the prepared n8n change. Do not apply it to the active workflow until the dashboard is deployed and these values exist:

- `DASHBOARD_INGEST_URL`: `https://<vercel-domain>/api/ingest`
- `INGEST_SECRET`: same value configured in the Vercel app

## Safe Insertion Point

Add one HTTP Request node named `Post to Dashboard` after `Insert Doc Content` succeeds. It should be a parallel sibling to `Update Scorecard PDF Link`.

Do not place it before the Drive-folder verification path, `Create Coaching Doc`, `Parse Doc Response`, or `Insert Doc Content`.

The live performance workflow's current Slack/report label for the improvement section is `What I'd Polish`, backed by the `what_id_polish` field. The dashboard stores that value in its existing `biggest_fix` column for compatibility, but renders it as `What I'd Polish`.

## Node Shape

```json
{
  "name": "Post to Dashboard",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.4,
  "position": [9460, 6460],
  "parameters": {
    "method": "POST",
    "url": "https://<vercel-domain>/api/ingest",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "Bearer <INGEST_SECRET>"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "contentType": "raw",
    "rawContentType": "application/json",
    "body": "={{ JSON.stringify({ airtable_record_id: $('Build PDF HTML').first().json.airtable_record_id, scorecard_key: $('If').item.json['Scorecard Key'] || $('If').item.json['Source Airtable Record ID'] || $('If').item.json['Meeting ID'], rep_name: $('If').item.json['Sales Rep'], rep_email: $('If').item.json['Sales Rep Email'], client_name: $('If').item.json['Client Name'], call_date: $('If').item.json['Date/Time'], meeting_id: $('If').item.json['Meeting ID'], meeting_title: $('If').item.json['Title Of Meeting'], meeting_link: $('If').item.json['Zoom Url'], transcript_link: $('If').item.json['Transcript Doc'], google_doc_id: $('Parse Doc Response').first().json.id, google_doc_link: $('Parse Doc Response').first().json.webViewLink || $('Parse Doc Response').first().json.alternateLink || '', call_status: 'scored', one_line_verdict: $('Performance Agent').first().json.output.airtable.scorecard_record.one_line_verdict, biggest_strength: $('Performance Agent').first().json.output.airtable.scorecard_record.biggest_strength, what_id_polish: $('Performance Agent').first().json.output.airtable.scorecard_record.what_id_polish, biggest_fix: $('Performance Agent').first().json.output.airtable.scorecard_record.what_id_polish, coaching_tip: $('Performance Agent').first().json.output.airtable.scorecard_record.coaching_tip, rudys_note: $('Performance Agent').first().json.output.airtable.scorecard_record.rudys_note, what_went_well: $('Performance Agent').first().json.output.airtable.scorecard_record.what_went_well, what_to_improve: $('Performance Agent').first().json.output.airtable.scorecard_record.what_to_improve, why_no_close: $('Performance Agent').first().json.output.airtable.scorecard_record.why_no_close, what_made_this_close_work: $('Performance Agent').first().json.output.airtable.scorecard_record.what_made_this_close_work, objections_surfaced: $('Performance Agent').first().json.output.airtable.scorecard_record.objections_surfaced }) }}",
    "options": {
      "response": {
        "response": {
          "responseFormat": "json",
          "fullResponse": false,
          "neverError": false
        }
      }
    }
  },
  "onError": "continueErrorOutput"
}
```

## Connections

`Insert Doc Content` success output should connect to both:

- `Update Scorecard PDF Link`
- `Post to Dashboard`

`Post to Dashboard` error output should connect to a Set node named `Set: dashboard_failed`, then to existing `Build Ops Alert`.

Suggested `Set: dashboard_failed` fields:

- `status`: `dashboard_failed`
- `reason`: `Dashboard ingest failed`
- `error_details`: `={{ $json.error?.message || $json.message || JSON.stringify($json).slice(0, 1000) }}`
- `source_airtable_record_id`: `={{ $('Build PDF HTML').first().json.airtable_record_id }}`

## Safety Notes

- Keep Slack, Airtable scorecard creation, Google Drive doc creation, stale-folder self-heal, and loop continuation unchanged.
- Use the HTTP Request node error output so an ingest failure alerts ops without stopping the working workflow.
- Run one real call after deployment and verify Slack, Drive, Airtable, and dashboard all succeed.

## Enhanced Report Feedback Webhook

Dashboard endpoint:

```text
POST /api/report-feedback
```

Dashboard-side rules:

- Only reports with `created_at >= 2026-06-17T17:14:00.000Z` are eligible.
- Eligible reports are labeled `Enhanced`; older reports are labeled `Legacy`.
- Thumbs-up sends anonymous positive feedback.
- Thumbs-down requires `respondent_name` and `comment`.
- The dashboard API re-fetches the report from the database and rejects Legacy feedback before forwarding to n8n.

Vercel env vars:

```bash
REPORT_FEEDBACK_WEBHOOK_URL="https://insidesuccess.app.n8n.cloud/webhook/magic-mike-report-feedback"
REPORT_FEEDBACK_WEBHOOK_SECRET="..."
```

Production n8n shape:

1. Active workflow `Vt1Ze3LiWynk7mao` named `Magic Mike Report Feedback Collector - Production - 2026-06-18`.
2. Webhook `POST /magic-mike-report-feedback` with `responseMode: onReceived` for fast UI response.
3. Code node validates `x-report-feedback-secret`, normalizes the body, and chooses the target range by `rating`.
4. HTTP Request node appends through the Google Sheets API using the regular `googleSheetsOAuth2Api` credential `tyler@insidesuccesstv.com`.
5. `positive` appends to Google Sheet tab `Positive Reviews`.
6. `negative` appends to Google Sheet tab `Negative Reviews`.

Recommended feedback sheet columns:

- Positive Reviews: `Submitted At`, `Rating`, `Report Type`, `Report ID`, `Report Version`, `Report Created At`, `Rep Name`, `Client Name`, `Page URL`
- Negative Reviews: all positive columns plus `Respondent Name`, `What Was Off In This Report`

Current implementation note, 2026-06-18:

- A local workbook template with the two tabs was successfully exported to `/tmp/magic-mike-feedback-sheet/output/magic-mike-report-feedback.xlsx`.
- Google Drive MCP native Sheet import still timed out, so n8n created the production feedback Sheet with the regular Google Sheets OAuth credential.
- Production feedback Sheet: `https://docs.google.com/spreadsheets/d/18X-s1SeF1PjGSwov2M11ND93Gj9GJf9x0EmXexk8GuU/edit`
- Tabs are `Positive Reviews` and `Negative Reviews`; headers were seeded through the Google Sheets API.
- Temporary setup workflow `qKvsoydrGEla3iNp` is inactive.
- Temporary verification-row cleanup workflow `ppQYrFd6yjQISGDa` is inactive.
- MCP partial workflow updates/activation can validate successfully but applying still fails with n8n API `request/body must NOT have additional properties`; direct n8n API activation/deactivation was used for the temporary and production workflows.
- Verification posts succeeded on workflow executions `250501` and `250502`; they appended to row 2 of each feedback tab and were then removed by the cleanup workflow.
- Vercel Production env vars `REPORT_FEEDBACK_WEBHOOK_URL` and `REPORT_FEEDBACK_WEBHOOK_SECRET` are configured.
