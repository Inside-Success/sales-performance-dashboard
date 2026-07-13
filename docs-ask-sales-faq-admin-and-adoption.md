# Ask Sales FAQ Admin And Adoption Dashboards

## Purpose

Ask Sales has two admin-only measurement surfaces with intentionally separate responsibilities:

- `/ask-sales-faq/admin` — answer quality, routing, feedback, provider/runtime health, and investigation.
- `/ask-sales-faq/admin/usage` — rep activation, repeat usage, question volume, and per-user adoption.

The existing coaching `/manager/usage` page and its metrics are not changed or reused. Coaching engagement and Ask Sales adoption remain separate datasets and concepts.

## Access

Both Ask Sales admin pages require:

1. A valid dashboard Google session.
2. Ask Sales feature access.
3. Membership in `ASK_SALES_FAQ_ADMIN_EMAILS`.

Normal Ask Sales users cannot access either admin page.

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

## Verification

- TypeScript: `npx tsc --noEmit`
- Scoped ESLint: Ask Sales admin pages, analytics helpers, DB analytics, and tests
- Ask Sales Vitest suite: 181 tests
- Production build: `npm run build`
- Live data query smoke check: quality summary, daily series, recent answers, known users, adoption counts, and daily adoption series all returned successfully.

No local development server is required or permitted for this project.
