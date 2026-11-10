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


## Direct-link revision — November 10

Mike and Tyler requested one-click destinations instead of category dropdowns. The revision replaces all admin menus with ordinary links in a stable order: Admin Insights plus five Coaching links on row one; three Sales Operations links, two explicitly labelled FAQ links and Mock Calls on row two. At widths below 1024px the same links form a horizontally scrollable strip with a continuation fade. A visible link opens in one tap; off-screen links require a swipe first. Keyboard focus can reach every link, and the active destination is revealed horizontally without scrolling the document vertically.

The ordinary Coaching and Ask Sales FAQ tool links now remain accessible to authorized admins on admin/manager pages. Neither tool is falsely marked active while viewing administration. Server permission filtering, exact destination URLs, external-link protections and disabled admin prefetch are retained. FAQ-only admins still receive only their permitted FAQ destinations plus the authorized directory.

Full desktop navigation uses two 44px rows and separate sticky clearance; compact FAQ-only navigation and the smaller-screen strip keep the prior clearance. Official call details and FAQ conversation side panels now also respect the admin header. Report Review section anchors receive matching clearance. No report content, data, workflows, source permissions or AI stages change. Report-return context and breadcrumb improvements remain separate follow-up work.

The implementation uses a clean branch from current main, including the latest coaching and FAQ releases. Both named chats were checked read-only and were idle; no messages were sent. The direct-link revision is released in [PR415](https://github.com/Inside-Success/sales-performance-dashboard/pull/415), production commit `ff671f98556415864ee7b1100b2bf4686b3935c5`, Vercel deployment `dpl_9fft3GmQSocFZ8yW4JmsALxnY11R` (Ready with the production alias).

Acceptance completed November 11:
- 43 targeted tests across six navigation/header/tool/access suites passed. Standalone TypeScript, scoped ESLint and the production build passed after syncing local dependencies to current main. No dependency manifest or lockfile changed. The broader reliability CI and Vercel preview build also passed before merge.
- Authenticated production displayed all 12 ordinary links and no admin menu buttons. At 1024px, all labels fit within two rows without navbar/document overflow on Admin Insights. The default desktop view also fit.
- Clicking Rep Usage navigated directly and marked only that page active. Keyboard Enter on FAQ Usage navigated correctly. Admin pages retained the Coaching and Ask Sales FAQ tool links, with neither falsely selected.
- At 390px, loading FAQ Usage revealed its active link inside the strip. Horizontal swiping returned to earlier links; at 320px the navbar and upper header fit the available width, and Rep Usage opened with one tap. Temporary viewport overrides were reset.
- On official report9473, after scrolling, the sticky details panel began at208px below the header bottom174px. The desktop admin offset was7rem. FAQ conversation panel/Report Review anchor clearance was code/build checked rather than independently exercised on every detail route.

Limits: FAQ-only and ordinary-rep isolation were regression tested rather than verified by signing into additional accounts. The existing FAQ Usage content has page-level horizontal overflow on narrow screens; the admin navbar itself stays within the viewport. That content layout was not changed in this navigation release. All routes are linked and authorization tested; every destination's business functionality was not re-audited. No defects were found in the verified navigation scope. Report-return context and breadcrumbs remain follow-up work, not part of this completed release.
