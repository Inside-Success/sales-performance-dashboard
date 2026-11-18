# Green Light Letters (rep self-serve page)

Added: 2026-11-18. Requested by Rudy (Slack, 2026-11-16): reps generate their own green light letter instead of asking the greenlight team.

## What it is

`/green-light` lets a signed-in rep create a prospect's Conditional Casting Approval letter:

1. **Call details** - show, the casting call (Zoom recording link or pasted transcript), the prospect's full name, optional focus points (up to 5), and a switch for calls with two different prospects.
2. **Review and edit** - the whole letter is shown. The sections written from the call are outlined and editable in place; the fixed template wording is shown but not typed into. "Ask AI to change it" rewrites only the editable sections.
3. **Download and send** - "Create final letter" builds the designed Google Doc; the rep downloads the PDF and emails it themselves.

Show buttons: Feature Documentary (`normal`), Next Level CEO (`nlceo`), Reality Show (`reality`), Mansion of Money (`mansion`), Entrepreneurs Island (`island`). No show is pre-selected.

## How it is built

The page does **not** generate letters itself. It reuses the editors' Green Light V2 n8n workflow (`TfpAYWYtDpOLWo2M`, repo `Inside-Success/green-light-v2-conditional-approval`), which owns the prompts, the letter templates and the Google Doc design. The editors' own dashboard is separate and unchanged.

| Piece | File |
| --- | --- |
| Page (server, access check) | `src/app/green-light/page.tsx` |
| Form, review, download UI | `src/components/green-light/green-light-generator.tsx` |
| Show list, focus points, Zoom link check | `src/lib/green-light/shows.ts` |
| Letter split into fixed wording and editable sections | `src/lib/green-light/letter-sections.ts` |
| Access, request schemas, workflow calls, activity log | `src/lib/green-light/server.ts` |
| Zoom recording link to transcript | `src/lib/green-light/zoom-call-transcript.ts` |
| Routes | `src/app/api/green-light/{transcript,generate,status,refine,save}/route.ts` |
| Tests | `tests/green-light/` |

- Every route requires a signed-in session (`requireGreenLightUser`). `/api/*` is not covered by `src/proxy.ts`, so this check is the gate.
- The browser never calls n8n. The routes call the workflow's `-start`, `-status`, `-refine` and `-save` webhooks server-side.
- Zoom links: `src/lib/green-light/zoom-call-transcript.ts` reads the transcript the way Zoom's current recording page does (the page's `featureConfigApi` names the transcript endpoint; https zoom.us hosts and same-origin `/nws/recording/` paths only). On 2026-11-18 Zoom's share pages no longer carried a transcript link in the player data the shared `resolveZoomTranscript` helper reads, so that helper (older pages, then the signed-in rep's archived transcript) is kept as the fallback rather than the first step. If neither finds a finished transcript, the rep is told to use Paste transcript. This depends on Zoom's own page, which can change again; pasting always works.
- The home page card (`src/app/page.tsx`, "Green Light Letters") is shown only to people who can use the page (`canUseGreenLight`), so the pilot list and the off switch also hide the card.
- Rep-only fields sent to the workflow: `request_source: "rep"` (tells the AI which show was selected so it does not name a different show the prospect first applied for), `focus_points` (trusted emphasis from the rep; never turned into promises), and on save `folder_group: "reps"` plus `editor_name` = the rep's Google account name. Letters land in Drive `Client's PDFs Green Light Letter / Reps / <rep name>`; the rep's folder is created on first save.
- The page adds its own check: if the written sections name a different show than the one selected, a "Check before sending" note says so.
- `letter-sections.ts` knows the template's fixed marker lines. If a draft does not match (for example after a template change in the workflow), it falls back to one plain text box, so reps are never blocked. When the workflow's letter templates change, re-check `tests/green-light/letter-fixtures.json`.
- No dashboard database table and no usage-tracking events are used, so Magic Mike coaching metrics are unaffected.

## Activity log

Each generate, "Ask AI to change it" and final letter is recorded (rep name and email, prospect, show, Zoom link or transcript, focus points, job id, letter link) by a best-effort POST to the n8n workflow `Green Light V2 - rep activity log` (`BsxB8UWoGcK8onbg`), which writes to the n8n data table `Green Light V2 - rep activity` (`3UmQlavuJVIXqKSI`). The webhook needs the shared secret header. A log failure never affects the rep's letter. A hidden admin page can be built on this table later.

## Settings (Vercel, production)

- `GREEN_LIGHT_LOG_WEBHOOK_URL`, `GREEN_LIGHT_LOG_SECRET` - activity log. If either is missing, logging is skipped.
- `GREEN_LIGHT_LETTERS_PILOT_EMAILS` - optional comma-separated allow-list. Set = only those emails can open the page; unset = every signed-in user.
- `GREEN_LIGHT_LETTERS_DISABLED=true` - turns the page and its routes off for everyone (rollback switch; redeploy to apply).
- `GREEN_LIGHT_N8N_WEBHOOK_BASE` - optional override of the workflow address.

## Rollback

Set `GREEN_LIGHT_LETTERS_DISABLED=true` and redeploy, or remove the home page card. The n8n side is additive (optional fields); the pre-change workflow export is in the green light repo under `n8n/backups/`.
