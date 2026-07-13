# Ask Sales FAQ Admin And Adoption Dashboards

## Purpose

Ask Sales has two admin-only measurement surfaces with intentionally separate responsibilities:

- `/ask-sales-faq/admin` — answer quality, routing, feedback, provider/runtime health, and investigation.
- `/ask-sales-faq/admin/usage` — rep activation, repeat usage, question volume, and per-user adoption.
- `/ask-sales-faq/admin/usage/[repKey]` — a rep-specific, read-only question-and-answer audit reached only from an activated row on the adoption page.

The existing coaching `/manager/usage` page and its metrics are not changed or reused. Coaching engagement and Ask Sales adoption remain separate datasets and concepts.

## Access

Every Ask Sales admin page requires:

1. A valid dashboard Google session.
2. Ask Sales feature access.
3. Membership in `ASK_SALES_FAQ_ADMIN_EMAILS`.

Normal Ask Sales users cannot access any admin page. Rep drill-down URLs use an HMAC-based opaque key derived with the existing server-side `AUTH_SECRET`; the rep email is never placed in the URL. Invalid, stale, non-admin, and unresolvable keys return 404. All admin pages remain unlinked from rep navigation and retain `noindex, nofollow` metadata.

## Quality And Operations Definitions

- **Questions**: saved Ask Sales assistant exchanges in the selected 7, 30, or 90 day window.
- **Grounded answers**: `answer_from_approved_article` or `answer_from_evidence` outcomes.
- **Conversation replies**: natural conversational/rewrite responses stored as `conversation_reply`.
- **Safe routes**: route, abstention, or admin-only outcomes. A safe route is not counted as a runtime failure.
- **Failures**: explicit error classes or technical outcomes such as safe fallback, rate limiting, duplicate-in-progress, authentication/feature blocking, or validation failure.
- **Investigation queue**: negative feedback, safe routes, coverage boundaries, and runtime failures. Successful V3 evidence answers are not automatically treated as misses.
- **Grounded rate**: observed answer mode, not a claim of independently reviewed factual accuracy.
- **Confidence**: displayed on the normalized 0–100 scale and not presented as factual accuracy.

New miss creation follows the same state-based rule as the dashboard. Direct approved/evidence answers and normal conversation replies do not create miss rows.

## Rep Adoption Population

The known-user population combines:

- signed-in identities captured by `dashboard_usage_events`;
- stored rep emails from `performance_calls`;
- identities already present in Ask Sales conversations.

Ask Sales admin accounts are excluded from adoption totals. This captures signed-in dashboard users who have never used Ask Sales while preserving users who first appear through Ask Sales. The page clearly labels this as the strongest available dashboard identity population, not a guarantee that every row is an eligible sales rep.

## Adoption Definitions

- **Activated**: submitted at least one Ask Sales question.
- **Active 7d / 30d**: submitted a question within the respective window.
- **Returning**: used Ask Sales on two or more distinct calendar days.
- **Not activated**: known dashboard/rep identity with no saved Ask Sales question.
- **Question volume**: saved user-role Ask Sales messages.
- **Grounded / routed / failed**: assistant outcomes in the selected reporting window.

## Per-Rep Question And Answer Review

Activated rows expose a **View Q&A** action. The drill-down defaults to all retained Ask Sales history and also supports 7-, 30-, and 90-day windows. Results are newest-first and paginated in bounded pages of 25.

Each retained assistant exchange is paired with the latest preceding user question in the same conversation and shows:

- the redacted question and answer already stored in Neon;
- date, outcome, safe-route reason, and runtime error class;
- source label/review date, source mode, confidence, and selected policy count;
- provider/model, total latency, V3 validation verdict, pipeline/knowledge version, and stored V3 stage timings when available;
- the latest submitted feedback and comment;
- archived/deleted conversation state without removing the retained admin audit record.

The implementation adds no table, migration, API mutation, or background job. It reuses the existing indexed Ask Sales messages, conversations, and feedback tables. It does not change the chat route, V3 runtime, governed knowledge bundle, authentication policy, Coaching `/manager/usage`, Slack, Google Sheets, or n8n.

## Verification

- TypeScript: `npx tsc --noEmit`
- Scoped ESLint: Ask Sales admin pages, rep-key/cursor helpers, DB analytics, validator, and tests
- Ask Sales Vitest suite: 192 tests
- Independent Ask Sales safety validator: 94/94 checks
- TypeScript: passed
- Production build: `npm run build`
- Live read-only data smoke check: 195 known non-admin users and seven activated users were available at the checked point in time; a selected retained exchange returned a paired question, answer, and V3 stage timings through the new query without exposing identity in command output.

No local development server is required or permitted for this project.
