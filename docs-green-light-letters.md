# Green Light Letters (rep self-serve page)

Added: 2026-11-18. Requested by Rudy (Slack, 2026-11-16): reps generate their own green light letter instead of asking the greenlight team.

## What it is

`/green-light` lets a signed-in rep create a prospect's Conditional Casting Approval letter:

1. **Call details** - show, the casting call (Zoom recording link or pasted transcript), the prospect's full name, optional focus points (any length; a pasted qualifying survey is fine), and a switch for calls with two different prospects. With no Zoom link and no transcript, the letter is written from the focus points alone (see "Without a transcript").
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
| Trace log (dashboard database) | `src/lib/green-light/trace-store.ts` |
| Zoom recording link to transcript | `src/lib/green-light/zoom-call-transcript.ts` |
| Routes | `src/app/api/green-light/{transcript,generate,status,refine,save}/route.ts` |
| Admin-only trace lookup | `src/app/api/green-light/trace/route.ts` |
| Tests | `tests/green-light/` (inputs and access, letter splitting, Zoom, the trace log, refresh behaviour, and `page-access.test.ts`: the page and every route open for a signed-in rep who is on no admin list) |

- Every route requires a signed-in session (`requireGreenLightUser`). `/api/*` is not covered by `src/proxy.ts`, so this check is the gate.
- The browser never calls n8n. The routes call the workflow's `-start`, `-status`, `-refine` and `-save` webhooks server-side.
- Zoom links: `src/lib/green-light/zoom-call-transcript.ts` reads the transcript the way Zoom's current recording page does (the page's `featureConfigApi` names the transcript endpoint; https zoom.us hosts and same-origin `/nws/recording/` paths only). On 2026-11-18 Zoom's share pages no longer carried a transcript link in the player data the shared `resolveZoomTranscript` helper reads, so that helper (older pages, then the signed-in rep's archived transcript) is kept as the fallback rather than the first step. If neither finds a finished transcript, the rep is told to use Paste transcript. This depends on Zoom's own page, which can change again; pasting always works.
- The home page card (`src/app/page.tsx`, "Green Light Letters") is shown only to people who can use the page (`canUseGreenLight`), so the pilot list and the off switch also hide the card.
- Rep-only fields sent to the workflow: `request_source: "rep"` (tells the AI which show was selected so it does not name a different show the prospect first applied for), `focus_points` (the lines of the Focus points box: up to five short lines are trusted emphasis exactly as before, anything longer is passed whole as context; never turned into promises), `transcript_mode: "none"` (no call transcript: write from the focus points alone), and on save `folder_group: "reps"` plus `editor_name` = the rep's Google account name. Letters land in Drive `Client's PDFs Green Light Letter / Reps / <rep name>`; the rep's folder is created on first save.
- The page adds its own check: if the written sections name a different show than the one selected, a "Check before sending" note says so.
- `letter-sections.ts` knows the template's fixed marker lines. If a draft does not match (for example after a template change in the workflow), it falls back to one plain text box, so reps are never blocked. When the workflow's letter templates change, re-check `tests/green-light/letter-fixtures.json`.
- No usage-tracking events are used and no existing dashboard table is read or written, so Magic Mike coaching metrics are unaffected. The only database use is the page's own trace table (see "Trace log").
- Refresh (since 2026-11-19): a refresh on the Call details screen starts with a clean form, nothing typed there is kept in the browser. A letter on the Review screen (and its Download step) survives a refresh, with the rep's edits and the details it was made from; it is kept in `sessionStorage` only while the review screen is showing. Going back with "Change call details" and then refreshing starts clean and drops that letter. "Start a new letter" clears everything.

## Without a transcript (since 2026-11-19)

Tyler's Loom to the reps says a letter can be generated before Zoom has a transcript, from context typed into the Focus points box. So:

- The box is labelled "Focus points" (Optional) with the sub-line "If transcript unavailable, add relevant context here" and the grey text "Add the gist of the business or paste their qualifying survey (Typeform) answers". It has no length limit a rep would meet (`GREEN_LIGHT_MAX_FOCUS_TEXT_LENGTH` only stops a runaway paste) and nothing is cut: `focusPointLines` sends every non-empty line.
- When the active call field (Zoom link or pasted transcript) is empty, Generate sends `input_type: "focus_points"` with an empty transcript, and the generate route adds `transcript_mode: "none"` for the workflow. Nothing else switches this mode on.
- Minimum: `greenLightMinContextWords` - 8 real words for Reality Show, Mansion of Money and Entrepreneurs Island, 15 for Feature Documentary and Next Level CEO (`countContextWords`; a lone dash or slash is not a word). The numbers come from test letters at each length: below them letters were filler or misread the notes; at and above them nothing is refused. The AI is never the gate. The request schema and the workflow enforce the same numbers.
- Not allowed without a transcript: two prospects on one call (the form says so and sends nothing).
- A Zoom link whose transcript is not ready never falls back silently. If the box has enough in it, the message tells the rep to clear the link and generate again.
- Review screen: a large banner with Tyler's exact words, "Be extra careful when reviewing if not using a transcript", shown only for these letters (`Draft.noTranscript`), and the helper line says the outlined sections were written from the focus points.
- "Ask AI to change it" on these letters sends the focus points as `source_notes`; `refineFactSource` passes them to the workflow as the only fact source, with the same limits the letter was written under (no added facts, never budget or investment, no form or season names).
- From short focus points the AI now and then leaves one section empty and the workflow rejects the letter ("... paragraph is missing"). For these letters only, the page asks again silently, up to three tries.
- The activity log records these letters with `input_type` `focus_points`.

What to expect: the four-paragraph letters stay close to what was typed. The five-act story letters written from a two-sentence gist read well but include narrative the AI inferred to connect the acts, so they need the most careful review. Workflow side, rules and test numbers: `n8n/WORKFLOW_CHANGELOG.md` (2026-11-19) in the workflow repo.

## Launch

Opened to every signed-in user on 2026-11-18 (the pilot allow-list was removed and the home card shows for everyone). Before opening it was tested on the live site with real recordings: Zoom link and pasted transcript, AI change, manual edit, final letter and PDF for Mansion of Money and Feature Documentary, plus the offline and headless-browser checks listed in the pull requests (#460, #461, #462).

## Activity log

Each generate, "Ask AI to change it" and final letter is recorded (rep name and email, prospect, show, Zoom link / transcript / focus points only, the start of the focus points, job id, letter link) by a best-effort POST to the n8n workflow `Green Light V2 - rep activity log` (`BsxB8UWoGcK8onbg`), which writes to the n8n data table `Green Light V2 - rep activity` (`3UmQlavuJVIXqKSI`). The webhook needs the shared secret header. A log failure never affects the rep's letter. A hidden admin page can be built on this table later.

## Trace log (since 2026-11-19)

So that any letter can be traced later (what the rep gave, what the AI wrote, what the rep changed, what was sent), every step is also written to the dashboard's own Postgres database, table `green_light_letter_trace`. n8n keeps its execution history for well under a day and the activity log above only keeps the start of the focus points, so neither can answer that question.

- The table belongs to this page only. `src/lib/green-light/trace-store.ts` creates it on first use (`create table if not exists`, same pattern as the other dashboard stores) and only ever adds rows. Nothing else in the dashboard reads or writes it.
- One row per step, linked by the letter's `job_id`:

| `event` | Written by | What it holds |
| --- | --- | --- |
| `zoom` | transcript route | the Zoom link asked for and whether Zoom had a transcript (`detail.outcome`, `detail.transcript_chars`) |
| `generate` | generate route | rep, prospect, show, `input_type`, the Zoom link, the whole focus points box, the whole transcript used |
| `start_failed` | generate route | the same inputs when the workflow could not start, with the error |
| `draft` | status route | the letter exactly as the AI wrote it (`letter_text`, plus `sections` by name) and its warnings; written once per letter |
| `failed` | status route | the error when generation failed (each silent retry has its own job id and row) |
| `refine` / `refine_failed` | refine route | what the rep asked, the letter before (the rep's own edits included) and after, or the error |
| `save` / `save_failed` | save route | the final text exactly as sent to the Google Doc, the Doc link and title, or the error |

- Writing is best effort and happens after the response has been sent (`after()`), with a 12 second limit. A database problem is logged to the server log (`Green light trace not saved`) and never slows down, changes or blocks a letter. If `DATABASE_URL` is missing the trace is simply skipped.
- What a rep typed and then edited by hand is the difference between the `draft` (or last `refine`) row and the `save` row.
- Looking a letter up: `/api/green-light/trace` (signed in as a Magic Mike admin, `isMagicMikeAdmin`; everyone else gets "Not found"). It is read-only and not linked from anywhere. With no parameters it lists the latest activity without the long text; `?prospect=`, `?rep=`, `?doc=` (Google Doc link or title) and `?limit=` filter the list; `?job_id=v2_...` shows everything about one letter as plain text; add `&format=json` for the raw rows. There is no delete: the log is meant to be complete.
- The rows contain prospect details, call transcripts and pasted survey answers (which can include what a prospect said they can invest). Treat the table and the lookup as internal.
- Tests: `tests/green-light/trace-log.test.ts` runs the real routes and the real SQL against an in-process Postgres.

## Settings (Vercel, production)

- `GREEN_LIGHT_LOG_WEBHOOK_URL`, `GREEN_LIGHT_LOG_SECRET` - activity log. If either is missing, logging is skipped.
- `GREEN_LIGHT_LETTERS_PILOT_EMAILS` - optional comma-separated allow-list. Set = only those emails can open the page; unset = every signed-in user.
- `GREEN_LIGHT_LETTERS_DISABLED=true` - turns the page and its routes off for everyone (rollback switch; redeploy to apply).
- `GREEN_LIGHT_N8N_WEBHOOK_BASE` - optional override of the workflow address.
- `DATABASE_URL` - the dashboard database (already set for the rest of Magic Mike); the trace log uses it.

## Rollback

Set `GREEN_LIGHT_LETTERS_DISABLED=true` and redeploy, or remove the home page card. The trace table is additive and can be left in place; removing the `recordGreenLightTrace` calls stops writing to it. The n8n side is additive (optional fields); the pre-change workflow export is in the green light repo under `n8n/backups/`.
