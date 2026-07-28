# Ask Sales V5.12 production-log head-to-head

## Result

V5.12 is **not approved for direct production replacement**. It answered more often, but at least 12 responses contained a high-confidence material answer error and 9 additional source-answerable responses were routed.

## Complete-population comparison

- Population: 134 stored production responses across 87 anonymous conversations.
- V3: 61 answers, 72 routes, 1 conversation reply.
- V5.12: 70 answers, 11 partial answers, 52 routes, 1 conversation reply.
- V3 route -> V5.12 answer/partial: 35.
- V3 answer -> V5.12 route: 15.
- V5.12 runtime: 283 provider-stage attempts; 5 failed attempts recovered; zero provider-failure-only outputs.
- Mean latency: V3 18511 ms; V5.12 16721 ms. P90: V3 26600 ms; V5.12 27236 ms.

## Release blocker

The dominant defect is not missing knowledge. A correct source record is often present, but the runtime applies it to the wrong relationship. Confirmed examples include material-leverage -> onboarding attendance, daily-stats -> agent switch, urgent greenlight -> scheduling extension, Call 1 no-show -> reapply wait, and general studio address -> SAG-specific production metadata.

This is precisely why the raw answer-rate increase is not a safe promotion signal. A confident wrong operational answer can affect a salesperson's real decision; V3's safe route is preferable in those cases.

## Recommendation

Keep production V3 unchanged. Do not repair individual benchmark questions. The next candidate must enforce exact requested-relationship and workflow-stage compatibility after retrieval and before answer projection, preserve follow-up objects, and route when that compatibility cannot be proved. Then rerun this exact frozen population plus a later untouched production slice.

## Verification

- Complete replay: 134/134 responses across 87 conversations; zero provider-failure-only outputs.
- Isolation validation: 15/15 passed.
- Static Ask Sales validation: 107/107 passed.
- Model-backed entailment file: 21/21 passed on the isolated rerun with a realistic 10-second test timeout. The first full-suite run recorded one 5-second timing timeout in this file; it was not an assertion failure.
- TypeScript, scoped ESLint, and the Next.js production build passed.
- No production selector, deployment, database row, Slack item, n8n workflow, or Vercel alias changed.
