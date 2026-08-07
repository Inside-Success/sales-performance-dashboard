# Magic Mike Hidden Pages And Access

Updated: 2026-08-07

Canonical production host: `https://sales-performance-dashboard-rose.vercel.app`

All pages below require Google sign-in. They are intentionally absent from normal rep navigation and use `noindex, nofollow` metadata.

## Coaching manager pages

These pages use the main Magic Mike authentication policy. Tyler is explicitly approved as `tyler@mawercapital.com` and also belongs to the approved `mawercapital.com` domain.

- [Coaching usage analytics](https://sales-performance-dashboard-rose.vercel.app/manager/usage)
- [Sales Impact - 7 days](https://sales-performance-dashboard-rose.vercel.app/manager/sales-correlation?days=7)
- [Sales Impact - 14 days](https://sales-performance-dashboard-rose.vercel.app/manager/sales-correlation?days=14)
- [Sales Impact - 30 days](https://sales-performance-dashboard-rose.vercel.app/manager/sales-correlation?days=30)
- [Sales Impact - 90 days](https://sales-performance-dashboard-rose.vercel.app/manager/sales-correlation?days=90)
- [Compliance review](https://sales-performance-dashboard-rose.vercel.app/manager/compliance)
- [Rep no-show impact](https://sales-performance-dashboard-rose.vercel.app/manager/rep-no-show)
## Coaching rep-scoring admin pages

These pages require both normal Magic Mike sign-in and exact membership in `REP_SCORING_ADMIN_EMAILS`. Production includes Syed and Tyler.

- [Sales call execution review](https://sales-performance-dashboard-rose.vercel.app/manager/rep-scoring)

Individual rep and call pages use `/manager/rep-scoring/rep/[repKey]` and `/manager/rep-scoring/call/[assessmentId]`. Open them from the main scoring table so the opaque key or assessment ID is valid.

## Ask Sales admin pages

These pages require normal Magic Mike sign-in, Ask Sales access, and exact membership in `ASK_SALES_FAQ_ADMIN_EMAILS`. Production includes Syed and Tyler. Unauthorized identities receive a deliberate 404 so the hidden admin surface is not disclosed.

- [Ask Sales quality and operations](https://sales-performance-dashboard-rose.vercel.app/ask-sales-faq/admin)
- [Ask Sales adoption and usage](https://sales-performance-dashboard-rose.vercel.app/ask-sales-faq/admin/usage)
- [Ask Sales knowledge refresh](https://sales-performance-dashboard-rose.vercel.app/ask-sales-faq/admin/knowledge-refresh)

Individual adoption audits use `/ask-sales-faq/admin/usage/[repKey]`. Open them from the adoption table because the key is an HMAC-backed opaque identifier rather than a rep email.

## Sales Impact source behavior

Sales Impact performs a read-only request to the current Google Sheet on every page load. A live read with the required headers, valid sales rows, paid rows, and parseable dates is authoritative even if its size differs from the prior snapshot. The dashboard-owned snapshot is retained only as an availability fallback when the live request fails or returns unusable data. No Magic Mike route writes to the sales Sheet.
