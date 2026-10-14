# Magic Mike admin directory and leadership access — October 14, 2026

## Authorized scope

Owner approved implementation after reviewing Tyler's October 14 leadership-access and admin-panel threads in C0B402VSESY. The directory is a simple list without descriptions, matches the existing dashboard, and includes a link to the separate Mock Call Agent team admin page. External permissions are explicitly outside this scope.

## Implementation

- `/admin`: nine labeled links, clear Open arrows, responsive list, keyboard focus and a new-tab indication for the external link. Homepage Admin button is rendered server-side only for eligible accounts. Return links are present on manager and FAQ admin pages.
- Exact leadership roster: Rudy `rudymawerllc@gmail.com`; Rich `rich.allen@mawercapital.com`; Mike `mike@rudysmarketing.com`; Luke `luke@mawercapital.com`; Thomas `tom@mawercapital.com`; Timothy `timothy.dick@insidesuccess.com`; Fritz `fritz.rollins@insidesuccess.com`; Raul `raul.rios@mawercapital.com`. Also approved: Dagim `dagim.abate@insidesuccess.com`, Syed, Tyler's two existing company accounts and Jawad.
- `approved-admin-emails.ts` supplies exact sign-in exceptions and shared manager permissions. Rudy and Mike's domains are not opened to arbitrary users; Gmail cannot become an approved login domain even through legacy domain configuration. Existing exact-email sign-in grants remain supported.
- `admin-access-policy.ts` preserves REP_SCORING_ADMIN_EMAILS additively and extends the existing FAQ admin list with approved managers. Existing FAQ-only admins keep their original FAQ scope. No environment variable is replaced or edited, including the non-readable FAQ admin secret.
- All manager pages now have server authorization; the four formerly sign-in-only data pages also check before data reads. Both manager chat endpoints reject unsigned/non-admin requests before parsing input, reading data or calling a provider. Existing scorecard/detail gates use the same policy.
- Names are clearer while URLs remain stable: AI Coaching Sales Impact, AI Coaching Rep Usage, AI Coaching Closer Scorecard, AI Coaching Team Insights, Sales Compliance Review, Sales Call Rep No-Shows, Sales FAQ Usage, Sales FAQ Conversations, Mock Call Agent Team Admin.
- FAQ usage/conversation analytics and quality-review exclusions use the same effective admin list. Newly approved admin activity is excluded by the existing default admin filter; Include admin activity continues to expose it. Coaching usage and Sales Impact calculations are unchanged.

## Boundaries

No n8n workflow, source Sheet/Doc, stored report, compliance/scoring policy, model, API credential or external Mock Call Agent setting is changed. No Slack message is sent. No local development server or full backup copy is created. Prior production deployment and Git history preserve rollback without duplicating source data on the laptop.

## Verification before release

- 56 focused tests passed: all approved accounts, exact exceptions, denial of unrelated Gmail/Rudysmarketing accounts, legacy manager/FAQ permissions, company-rep FAQ access, per-page authorization before data reads, and both API authorization paths.
- Additional existing FAQ admin filters/rep-review and Sales Impact factual-answer tests passed.
- Scoped ESLint, git diff --check and full Next.js production webpack build including TypeScript passed.
- Signed-in production UI and deployed access verification will be recorded below after release. Other people's OAuth logins cannot be claimed as tested through the owner's session; exact-email policy checks cover their configuration.

## Rollback

Base main commit before changes: `8396515df0b18b9865fae20fe02e5a45b71a7133`. Prior ready production: `dpl_H1VLBXPvJWkAeJNSBhxf6L41BeYV`. Revert the scoped release commit through GitHub to restore prior page names and permission behavior. No database rollback or environment-secret restoration is needed.
