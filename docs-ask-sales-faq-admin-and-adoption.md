# Ask Sales FAQ Admin And Adoption Dashboards

## Purpose

Ask Sales has three admin-only surfaces with intentionally separate responsibilities:

- `/ask-sales-faq/admin` — simple production conversation logs for manual quality review on request.
- `/ask-sales-faq/admin/usage` — rep activation, repeat usage, question volume, and per-user adoption.
- `/ask-sales-faq/admin/usage/[repKey]` — a rep-specific, read-only question-and-answer audit reached only from an activated row on the adoption page.
- `/ask-sales-faq/admin/knowledge-refresh` — human approval and governed publication of useful source updates.

The existing coaching `/manager/usage` page and its metrics are not changed or reused. Coaching engagement and Ask Sales adoption remain separate datasets and concepts.

## Access

Every Ask Sales admin page requires:

1. A valid dashboard Google session.
2. Ask Sales feature access.
3. Membership in `ASK_SALES_FAQ_ADMIN_EMAILS`.

Production administrators are `syed.haider@insidesuccess.com` and `tyler@mawercapital.com`. This exact list is intentionally narrower than ordinary company-domain access.

Normal Ask Sales users cannot access any admin page. Rep drill-down URLs use an HMAC-based opaque key derived with the existing server-side `AUTH_SECRET`; the rep email is never placed in the URL. Invalid, stale, non-admin, and unresolvable keys return 404. All admin pages remain unlinked from rep navigation and retain `noindex, nofollow` metadata.

## Quality And Operations

The Quality & Operations page is intentionally a passive log viewer. The retired nightly AI quality audit is inactive and its historical records remain preserved in the database; they are not deleted or presented as a current review queue. When enough production traffic has accumulated, the project owner asks Codex to perform a bounded manual review of the stored logs.

The main page has only four summary counts, a precise attention list, the latest conversations, and collapsible rep feedback. Provider, model, confidence, validation, knowledge-version, pipeline, and latency fields remain available under each row's collapsed **Technical details** section instead of dominating the page.

### Definitions

- **Questions**: saved Ask Sales assistant exchanges in the selected 7, 30, or 90 day window.
- **Grounded answers**: `answer_from_approved_article` or `answer_from_evidence` outcomes.
- **Conversation replies**: natural conversational/rewrite responses stored as `conversation_reply`.
- **Answered**: grounded answers plus conversation replies.
- **Safe routes**: route, abstention, or admin-only outcomes. A safe route is not counted as a runtime failure.
- **Failures**: explicit error classes or technical outcomes such as safe fallback, rate limiting, duplicate-in-progress, authentication/feature blocking, or validation failure.
- **Needs attention**: only a technical failure or an answer with thumbs-down feedback. Safe routes are visible in Recent conversations but are not mislabeled as defects.
- **Recent conversations**: the latest real answered, conversational, and safely routed exchanges.
- **Recent rep feedback**: thumbs-up, thumbs-down, and written comments; collapsed by default.

The counts describe system behavior and are not presented as independently reviewed factual accuracy. Source and technical trace fields remain available for a human reviewer.

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

- TypeScript: `tsc --noEmit` passed.
- Scoped ESLint passed with no warnings or errors.
- Complete Ask Sales Vitest suite: 19 files / 284 tests passed.
- Focused Quality & Operations regression checks: 3/3 passed.
- Ask Sales static safety validator: 107/107 checks passed.
- Next.js 16.2.6 optimized production build passed.
- No local development server ran.
- No Slack, Google, source-refresh, governed knowledge, chat-runtime, authentication, adoption-page, or production-database write was introduced by the simplification.

No local development server is required or permitted for this project.
