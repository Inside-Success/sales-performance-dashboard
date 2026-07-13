# Magic Mike product hub and Ask Sales launch

## Product routes

- `/` is the authenticated Magic Mike home hub.
- `/coaching` is the existing coaching-report home experience.
- `/ask-sales-faq` is the Ask Sales FAQ Beta experience.
- The Magic Mike logo returns to the hub from either tool.
- The tool switcher moves directly between Coaching and Ask Sales FAQ.

Existing coaching report, self-submission, manager, and API routes keep their original responsibilities. Coaching back links now return to `/coaching`, not to the product hub.

## Access policy

Google authentication remains the front door for the entire application. The approved company domains are controlled centrally by `AUTH_ALLOWED_DOMAINS`; the code defaults to:

- `insidesuccesstv.com`
- `insidesuccess.com`
- `mawercapital.com`
- `nextlevelceotv.com`

Ask Sales uses this same authenticated company-domain policy. It no longer has a second per-user launch allowlist.

`ASK_SALES_FAQ_ENABLED` remains a server-side emergency switch. It should remain `true` for launch. Turning it off temporarily blocks the Ask Sales UI and APIs without changing authentication or Coaching.

## Admin isolation

The quality/operations page at `/ask-sales-faq/admin` and the rep-adoption page at `/ask-sales-faq/admin/usage` remain separate from rep-facing navigation. They require an exact email in `ASK_SALES_FAQ_ADMIN_EMAILS`. Other authenticated users receive a 404 response, so the application does not disclose the admin surface.

Both admin pages retain `noindex, nofollow` metadata and are not linked from the hub, Coaching, Ask Sales, or the shared tool switcher.

## Release verification

Required release checks:

1. TypeScript and scoped ESLint pass.
2. Ask Sales access, presentation, conversation, and runtime regression tests pass.
3. `next build` succeeds without running a local development server.
4. An unauthenticated request is redirected to `/sign-in` with its intended callback URL.
5. In an approved company session, the hub, Coaching, Ask Sales, and tool switcher work end to end.
6. A non-admin identity cannot render either admin page; admin authorization remains enforced at the page/data boundary.
7. The production deployment is `READY` before the release is announced.
