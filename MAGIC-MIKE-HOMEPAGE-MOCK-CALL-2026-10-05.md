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

Scoped ESLint, `git diff --check`, and a complete local production webpack build (including TypeScript) passed. No local server was started. Authenticated FAQ usage access was verified on the existing production release before publishing. Production starts from October 5 main commit `0a02b79`, preserving the separately restored admin configuration and current FAQ knowledge refresh. Authenticated production UI verification will be recorded after deployment.

## Rollback

Revert the addition to the homepage tools array if required. No data restoration or workflow rollback is needed.

## Source

https://istvoffical.slack.com/archives/C0B402VSESY/p1791207372222169
