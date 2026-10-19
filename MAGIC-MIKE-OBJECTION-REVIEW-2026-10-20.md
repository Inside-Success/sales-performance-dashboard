# Isolated objection-first coaching review

## Scope

An admin-only set of ten real closing-stage calls for leadership evaluation.
This is an experiment, not a replacement for live coaching. The selection
contains one or two on-call confirmed payments and the remainder without an
on-call confirmed payment. No later lost-sale conclusion is implied.

Routes:
- `/manager/coaching-review`: numbered list
- `/manager/coaching-review/1` through `/10`: saved review copies

The Admin Insights link uses the existing manager policy. FAQ-only admins are
not promoted. Both the manager layout and server data readers require access.
No new public endpoint, source ingest, AI-on-view, chat, usage event or score
is introduced.

## Content contract

1. Actual objections first, using the finalized nine-category taxonomy.
   Concern, handling quality and resolution are separate.
2. Other call-specific improvements, without repeating objection coaching.
3. “What would Rudy say?” — one source-grounded strategic takeaway, clearly
   labelled as derived coaching rather than a quote.
4. Specific repeatable strengths.

Ordinary questions, contract review and mentioning a spouse/advisor do not
automatically establish an objection. Not-raised categories are compact.
Good handling does not require a closed sale. Recommendations are permitted
only where handling can genuinely improve. Unknown evidence, contradictory
category accounting, invented fill-in fields and missing required sections
must not pass publication.

Evidence excerpts are taken verbatim from the source transcript and displayed
behind explicit “View transcript evidence” controls. The coaching itself stays
visible. Report navigation includes the directory, all reports, section links,
previous/next and the original report.

## Isolation and storage

Use the existing private `prompt_benchmark_runs/outputs` tables with the fixed
run ID `objection-review-2026-10-20`. Reads only select published rows in that
run. The existing production report, usage and coaching-insight reads do not
use these tables.

The publisher validates all ten records before one atomic insert transaction.
It refuses existing run/result IDs rather than overwriting them. It does not
invoke the general database schema initializer or migrate production tables.

The repository is public. Transcripts, generated reports, source packs,
provider receipts and budget ledger stay in private storage. The local
`.private-review/` working folder is ignored. No credentials are committed.

## Evaluation and spend controls

Full transcripts, production coaching safeguards, the finalized taxonomy,
current approved offer context and documented sales principles are supplied.
Historical scripts and statements made on a call do not establish current
approved terms.

The isolated provider gateway is separate from production delivery workflows.
Every paid request is recorded and receives a conservative reservation before
dispatch. The reservation includes both possible gateway attempts; ambiguous
responses retain their reservation and are not automatically retried. The
total reservation ceiling is $40, including pilots and repairs.

Evaluation considers objection accuracy, counterevidence, factual/policy
accuracy, useful specificity, clarity, repetition, outcome accuracy and
rendering. A model's own quality rating is not an independent truth label.
Leadership review remains the acceptance step for any later production
promotion.

## Checks and publication

- Schema/evidence/category consistency and private-read authorization tests.
- Scoped lint, TypeScript and production build.
- Private input dry-run, then explicit offline publication:
  `vite-node --config vitest.config.ts scripts/publish-coaching-review.ts PRIVATE_FILE --publish`
  with server-only DATABASE_URL supplied securely.
- GitHub preview, authenticated list/detail/evidence/navigation checks,
  unauthorized HTTP checks, then production verification.
- Confirm existing admin directory, coaching and FAQ surfaces still work.

## Rollback

Revert this feature commit to remove the routes and directory link. Saved
experiment rows can remain private; no source record or live coaching workflow
needs to be reverted. Production promotion of the experimental prompt requires
separate approval.

## Release evidence

Implementation checks and model evaluation are in progress. Final results,
costs, deployment and verification will be recorded after completion.

