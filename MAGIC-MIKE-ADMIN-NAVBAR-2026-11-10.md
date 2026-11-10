# Admin navbar — November 10, 2026

## Behavior

Authorized admins get a compact second row beneath the existing application header throughout Magic Mike. Desktop groups are Coaching, Sales Operations and FAQ, with Admin Insights and the existing external Mock Calls link. Mobile uses one grouped Admin pages menu. The current destination is marked inside its menu; the matching desktop group is highlighted, including on nested report/rep/calibration routes. Menus use the installed Base UI accessibility primitives for keyboard navigation, Escape, outside dismissal and focus restoration. Navigation closes on selection and route changes.

The navbar and Admin Insights directory use the same destination registry and server-side permission projection. FAQ-only admins get only FAQ links; signed-out users and regular reps receive no admin destinations. The sign-in header remains hidden. Existing manager layouts and page/API guards remain intact. The prior manager/FAQ Back to Admin Insights strips are removed because the persistent navbar supplies that destination. Local FAQ tabs remain.

## Scope and safety

No changes to access rosters, auth grants, report generation, n8n, knowledge, scoring, Script Adherence processing or source data. No extra AI/API calls. Internal admin links disable eager prefetching to avoid loading manager datasets merely by opening a menu. The external Mock Calls link retains new-tab behavior and its own service authorization.

Implementation reuses a clean checkout on `codex/admin-navbar-2026-11-10`. Other chats were inspected read-only; no messages were sent. FAQ knowledge PR403 and coaching-review PR402 had no overlapping files at the pre-release check. Recheck current main and open changes before merging; do not overwrite another chat's branch or worktree.

## Validation

Permission projection, server-header serialization and route matching have targeted regressions, alongside existing admin page/API authorization tests. TypeScript, scoped lint and production build are checked before release. No local development server is used. Authenticated desktop/mobile navigation and production deployment acceptance are pending.

## Rollback

Revert this scoped navbar change while preserving unrelated merged work. There are no migrations or workflow/data changes. Keep the shared registry and projection consistent with both navigation surfaces if adjusting destinations later.
