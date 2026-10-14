# Magic Mike admin UI and navigation follow-up — October 14, 2026

## Authorized scope

Owner approved fixing the oversized top gap, clearer admin/page names, directory order, consistent no-show page styling, and simple navigation. This is presentation-only. Exact-email access rules, calculations, saved data, source Sheets, report generation and workflows remain unchanged.

## Root cause and changes

- The manager return-link nav used `.magic-page`, whose minimum height is almost a viewport. Live before-change measurement: nav 714px, usage heading top 812px in a 778px viewport. The compact nav no longer uses a full-page class.
- Homepage entry and directory heading are **Admin Insights**. Manager and FAQ admin views have **Back to Admin Insights**; the directory returns to Magic Mike home. Admin headers show the brand and profile; normal coaching/report navigation is unchanged.
- Directory order: AI Coaching Rep Usage; AI Coaching Sales Impact; AI Coaching Objection Library; Sales FAQ Chatbot Usage; Sales FAQ Chatbot Conversations; Mock Call Agent Team Admin; Sales Call Rep No-Shows; Sales Compliance Review; AI Coaching Closer Scorecard.
- Updated the corresponding headings and browser titles; URLs stay unchanged.
- No-show page uses existing Magic Mike cards, background, typography and red controls. Its portalled chat gets the same scoped theme. Filters, calculations, history and chat request handling are retained. Redundant cross-page buttons were removed in favor of the common directory return link.
- No-show date selectors and log filters have larger touch targets. The external Mock Call Agent link still opens its separate deployment in a new tab.

## Verification

- Scoped ESLint passed.
- 67 tests passed across 11 suites: leadership/sign-in/admin authorization, FAQ access/analytics/review/filter behavior, and no-show history/pagination/date windows.
- Production build and authenticated desktop/mobile visual verification must be recorded below after release; do not treat a heading-only check as visual acceptance.

## Rollback

Revert only this UI follow-up commit through a new reviewed GitHub change. Preserve the earlier admin access release (PR293) and its documentation (PR294). Git history is the backup; no copied checkout or large local backup was created.
