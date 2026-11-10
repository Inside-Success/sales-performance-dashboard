# Admin navbar — November 10, 2026

## Behavior

Authorized admins get a compact second row beneath the existing application header throughout Magic Mike. Desktop groups are Coaching, Sales Operations and FAQ, with Admin Insights and the existing external Mock Calls link. Mobile uses one grouped Admin pages menu. The current destination is marked inside its menu; the matching desktop group is highlighted, including on nested report/rep/calibration routes. Menus use the installed Base UI accessibility primitives for keyboard navigation, Escape, outside dismissal and focus restoration. Navigation closes on selection and route changes. Existing sticky coaching filters and call-details panels gain admin-only header clearance; ordinary-rep offsets are unchanged.

The navbar and Admin Insights directory use the same destination registry and server-side permission projection. FAQ-only admins get only FAQ links; signed-out users and regular reps receive no admin destinations. The sign-in header remains hidden. Existing manager layouts and page/API guards remain intact. The prior manager/FAQ Back to Admin Insights strips are removed because the persistent navbar supplies that destination. Local FAQ tabs remain.

## Scope and safety

No changes to access rosters, auth grants, report generation, n8n, knowledge, scoring, Script Adherence processing or source data. No extra AI/API calls. Internal admin links disable eager prefetching to avoid loading manager datasets merely by opening a menu. The external Mock Calls link retains new-tab behavior and its own service authorization.

Implementation reuses a clean checkout on `codex/admin-navbar-2026-11-10`. Other chats were inspected read-only; no messages were sent. FAQ knowledge PR403 and coaching-review PR402 had no overlapping files at the pre-release check. FAQ PR403 landed during implementation and was merged into this branch without conflicts before final checks. No other chat's branch or worktree was modified.

## Validation

Released in [PR404](https://github.com/Inside-Success/sales-performance-dashboard/pull/404), production commit `11e038200fe7f85a057456aaa78dca39048ad876`, Vercel deployment `dpl_Eheb6pPrNvj1RCUXB2fmN1Gr5wog`. GitHub reliability checks and Vercel deployment passed.

- 37 tests across five navigation/header and existing admin page/API authorization suites passed. TypeScript, scoped ESLint and the production build passed. No local development server was used.
- Authenticated production desktop checks confirmed grouped menus, keyboard Down/Enter navigation to Rep Usage, Escape dismissal with focus restored to the trigger, and the current Rep Usage item marked `aria-current=page`.
- FAQ Usage and Rep No-Shows loaded through their menus. The navbar persisted on the regular Coaching page. Existing FAQ local tabs remained and the redundant return strip was absent.
- At 390px and 320px, the grouped mobile menu stayed within the viewport and exposed all 11 destinations. Mobile Rep Usage selection navigated and closed the menu. The viewport override was reset afterward.
- External Mock Calls retains `_blank` and `noopener noreferrer`.

Limits: FAQ-only/nonadmin access was verified through server permission/header tests rather than signing into additional accounts. Nested active-route matching and sticky clearance were regression/code checked; every individual destination and scrolling state was not independently exercised live. The existing Rep Usage data table remains wider than a phone viewport; the new navbar itself fits. No navbar defects were found in the verified scope; this is not a full application health check.

## Rollback

Revert this scoped navbar change while preserving unrelated merged work. There are no migrations or workflow/data changes. Keep the shared registry and projection consistent with both navigation surfaces if adjusting destinations later.
