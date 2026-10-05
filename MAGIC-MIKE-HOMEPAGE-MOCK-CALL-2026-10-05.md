# Homepage Mock Call Agent link — October 5, 2026

## Scope

Owner authorized adding a third homepage card following Tyler's October 5 sales-operations thread and the supplied placement image.

- Existing first row: AI Coach and FAQ Bot.
- Second row: Mock Call Agent beneath AI Coach, with the same width and styling.
- Destination: https://mockcallagent.insidesuccess.ai/
- Normal same-tab navigation. Mock Call Agent remains separately deployed and uses its own sign-in.
- Existing two-column grid places the third card in the first column of the second row. The existing mobile breakpoint stacks all three cards.
- Existing whole-card links, Open arrow, hover, focus and reduced-motion styling are reused.

Only the homepage tools array changes. No report, workflow, prompt, API, authentication, environment setting or database behavior is changed.

## Verification

Scoped ESLint, `git diff --check`, and a complete local production webpack build (including TypeScript) passed. No local server was started. Authenticated FAQ usage access was verified on the existing production release before publishing. Production starts from October 5 main commit `0a02b79`, preserving the separately restored admin configuration and current FAQ knowledge refresh.

## Production receipt

- Implementation PR: https://github.com/Inside-Success/sales-performance-dashboard/pull/262
- Merged commit: `7aa26b3431dafc0e316559d56c14ad2e3cf221e4`.
- Production deployment: `dpl_8xHQ9psEyK65522sJ6NSv57ch4Mw`, READY.
- Deployment URL: https://sales-performance-dashboard-ib43tqmnt-admin-insidesuccess.vercel.app
- Public homepage: https://sales-performance-dashboard-rose.vercel.app/
- Explicit public alias assignment succeeded; the existing automatic-production-assignment setting was not changed.
- Preview failed before build with `Resource provisioning failed`; the GitHub-triggered production build succeeded.

Authenticated live Chrome verification:

- Three homepage links have their intended destinations.
- Desktop card rectangles: AI Coach and FAQ Bot share the first row; Mock Call Agent has the same width and x-position as AI Coach, on the second row.
- Mobile checks at requested 390px and 320px widths: single-column card stacking; document scroll width equals client width, with no horizontal overflow. Mobile screenshot inspected; longer labels wrap on narrow screens.
- Keyboard Tab reaches Mock Call Agent in visual order; the existing red 2px focus outline is visible.
- Clicking Mock Call Agent opens its separate roleplay setup dashboard in the same tab. Browser Back returns to Magic Mike.
- Clicking the original cards opens Coaching (rep selector loaded) and FAQ (chat/history loaded).
- FAQ admin usage and manager scorecard remain accessible with populated data.
- Official coaching report 7340 loads its current sections and source links.
- The restored default browser viewport was reinstated after responsive checks.
- Exact-deployment error log scan covering the preceding 10 minutes returned no error logs.

No roleplay was started and no report was submitted/regenerated. These checks verify the homepage addition and surrounding navigation/access; they are not a new audit of every workflow or the external agent's voice generation.

## Rollback

Revert the addition to the homepage tools array if required. No data restoration or workflow rollback is needed.

## Source

https://istvoffical.slack.com/archives/C0B402VSESY/p1791207372222169
