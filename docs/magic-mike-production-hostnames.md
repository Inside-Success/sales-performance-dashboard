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

Production retains the existing `AUTH_URL` setting and NextAuth behavior for the previous hostname. The exact branded production origin uses Auth.js directly with the same configuration and company access rules. Its sign-in form uses the same-origin Auth.js endpoint, including the CSRF check. Each origin establishes its own secure session cookie and restores the relative destination after sign-in. No OAuth client ID, secret, or application role change is required.

## Manual reports

Both exact HTTPS origins are allowed to submit. The dashboard still sends the existing `/api/manual-reports/callback` and `/self-report/<publicId>` URLs on the Vercel hostname to n8n. Keep that contract for queued jobs, existing workflow host validation, and report links already sent. The browser opens a just-submitted report on its current hostname. Preview dispatch rules remain explicit and isolated.

## Verification and rollback

Check that both hostnames present valid HTTPS and remain on the same hostname at an existing protected report path. Start a fresh Google sign-in from each path and verify the same report opens after the callback. Verify both manual submissions reach terminal outcomes by exact report ID. Check that the legacy callback remains the workflow destination. A Vercel deployment or a workflow acknowledgment alone does not establish delivery.

For a branded-host-only outage, keep the original hostname and use it to access the app. If the branded DNS or app change must be rolled back, scope the rollback to the branded CNAME/project domain or the dual-host code. Retain the original OAuth URI, existing Vercel hostname, and integration callback. Revert a code change against the current main branch so unrelated releases remain intact.

## Rollout evidence

The exact branded hostname is attached to the production Vercel project. Both OAuth callback URLs were saved and reopened for verification in Google Cloud. Public DNS, authenticated browser checks, and live manual submissions are pending the application release.
