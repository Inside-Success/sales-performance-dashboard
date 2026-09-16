# Ask Sales admin redesign — September 17, 2026

## Scope and behavior

Two admin-only destinations replace Quality & operations, Rep adoption and Source updates: Conversations and Usage. Full conversation readers preserve authored Markdown and source details, including earlier messages outside the selected range. Search matches retained question/answer text; person, date, issue and review filters work together. Summaries label feedback and technical failures without claiming answer correctness. Usage counts user messages and returning users within inclusive Miami calendar dates. Zero-activity days remain in the chart. Known users come from recent dashboard/call activity plus retained chatbot history, not an authoritative employee roster. Admin accounts are excluded by default with an explicit include switch; unidentified tests are not silently guessed away.

Review notes are separate metadata. Reviewed does not mean resolved. New messages or feedback reopen review. Version checks prevent silent overwrite by concurrent reviewers. The write endpoint checks the existing admin allowlist, same origin, bounded input and optimistic concurrency. No access expansion. Existing rep bookmarks redirect to the shared conversation list. The legacy source page redirects and interactive proposal/release mutation endpoints return authenticated HTTP 410. Service ingestion/history and source checkpoints are retained for future user-requested weekly refreshes.

The published knowledge date is tied to the active hash using `src/lib/ask-sales-faq/admin/knowledge-publication.json`; update it only after a verified knowledge publication. A different hash shows an unknown-date state. A page render or Git build never advances that date.

## Deployment order

Apply additive `migrations/20260917_ask_sales_admin_reviews.sql` to the isolated preview DB, verify, then apply the same idempotent migration to production before merging. Only one new admin metadata table is added. No chatbot/coaching tables, prompts, providers, knowledge records, scoring, auth or runtime configuration change. Build production with production settings; never promote the isolated preview.

The dedicated 9 PM Miami refresh orchestrator `ua18B5wbsYptLqJX` is the scheduled entry point. Its analyzer has only an execute-workflow trigger. Retire the orchestrator schedule by deactivating that workflow after backing it up, without executing it or touching its subworkflows/credentials/data. Verify state after mutation. Final live status and exact release receipts are recorded in the PR and root workspace report; this document describes intended deployment, not evidence of completion.

## Verification and limitations

Isolated SQL smoke verifies full histories, question/answer search, partial/feedback flags, admin exclusion/opt-in, notes, stale-write rejection and reopening after new feedback. Unit checks cover date boundaries, invalid ranges, escaping, access/origin/input rejection, storage errors and rendered error/empty-state distinctions. Existing Ask Sales tests, TypeScript, scoped ESLint and hosted CI/build run before merge. Browser verification uses Chrome work profile only; no local dev server and no paid chatbot calls are needed for this admin-only change.

The legacy nightly AI audit remains retired. Managers can review records, but this does not create automatic correctness grading or repair answers. Deleted conversations are excluded. Notes do not send Slack notifications or publish knowledge.

## Rollback

Revert the scoped code release and rebuild from main with production configuration. Leave the additive metadata table and notes intact. Re-enable the archived scheduled orchestrator only if the user intentionally resumes that automatic workflow; a UI rollback alone is not authorization to restart it.
