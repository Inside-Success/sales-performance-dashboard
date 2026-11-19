# Magic Mike production hostnames

Both hostnames serve the same production deployment of the Vercel `sales-performance-dashboard` project in the Inside Success team. Keep both configured for production with redirects unset.

| Hostname | Purpose |
| --- | --- |
| `magicmike.insidesuccess.ai` | Branded app URL. Cloudflare manages DNS for the parent zone. Use the project-specific Vercel CNAME `7d318e73d7bf727c.vercel-dns-016.com` with proxying disabled. |
| `sales-performance-dashboard-rose.vercel.app` | Existing app URL, saved report links and stable integration delivery origin. |

## Google sign-in

The company Google OAuth client in project `magic-mike-dashboard-auth` retains both exact callback URLs.

- `https://sales-performance-dashboard-rose.vercel.app/api/auth/callback/google`
- `https://magicmike.insidesuccess.ai/api/auth/callback/google`

Production retains the existing `AUTH_URL` setting and NextAuth behavior for the previous hostname. The exact branded production origin uses Auth.js directly with the same configuration and company access rules. Its sign-in form uses the same-origin Auth.js endpoint, including the CSRF check. The protected-page guard uses the original branded request for navigation even though NextAuth still uses the fixed environment URL internally. Each origin establishes its own secure session cookie and restores the relative destination after sign-in. No OAuth client ID, secret, or application role change is required.

## Manual reports

Both exact HTTPS origins are allowed to submit. The dashboard still sends the existing `/api/manual-reports/callback` and `/self-report/<publicId>` URLs on the Vercel hostname to n8n. Keep that contract for queued jobs, existing workflow host validation, and report links already sent. The browser opens a just-submitted report on its current hostname. Preview dispatch rules remain explicit and isolated.

## Verification and rollback

Check that both hostnames present valid HTTPS and remain on the same hostname at an existing protected report path. Start a fresh Google sign-in from each path and verify the same report opens after the callback. Verify both manual submissions reach terminal outcomes by exact report ID. Check that the legacy callback remains the workflow destination. A Vercel deployment or a workflow acknowledgment alone does not establish delivery.

For a branded-host-only outage, keep the original hostname and use it to access the app. If the branded DNS or app change must be rolled back, scope the rollback to the branded CNAME/project domain or the dual-host code. Retain the original OAuth URI, existing Vercel hostname, and integration callback. Revert a code change against the current main branch so unrelated releases remain intact.

## Rollout evidence

The November 19–20, 2026 rollout used [PR #469](https://github.com/Inside-Success/sales-performance-dashboard/pull/469) for dual-host routing and [PR #470](https://github.com/Inside-Success/sales-performance-dashboard/pull/470) for protected links. Both passed the GitHub coaching reliability gate and the Vercel preview build. The first live check surfaced the fixed `AUTH_URL` in the protected-page guard, which PR #470 addresses.

- Cloudflare's authoritative nameservers and a public resolver returned the expected CNAME. Vercel listed both production domains as verified with no hostname redirect. The existing Google Cloud client retained the old callback and saved the new callback.
- The authenticated browser opened existing coaching report `/call/9649` and the same previously completed manual report on both hosts.
- Exact manual intake test records `0264e0868a7742708fb8b871335e8361` (original) and `8459e6b968fc4edd920df9d0d5d305c2` (branded) reached the expected terminal `needs_transcript_paste` state. Each intentionally referenced a nonexistent recording to exercise delivery without generating new coaching or a document. Both fixtures are labeled Domain QA.
- Vercel production deployment `dpl_3ATHfRzbkJf3VrFWjJiCSm2PHbVL` (commit `75969e8`) was Ready with both hostnames assigned. After the deployment, a fresh branded Google sign-in from `/call/9649` returned to the same branded path and showed its coaching content. An authenticated check of the original report link opened the same content at the original hostname. Fresh Google sign-in had also returned to that exact original deep link during rollout.
