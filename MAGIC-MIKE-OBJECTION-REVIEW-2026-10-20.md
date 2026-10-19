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
- GitHub build gate, authenticated list/detail/evidence/navigation checks,
  unauthorized HTTP checks, then production verification.
- Confirm existing admin directory, coaching and FAQ surfaces still work.

## Rollback

Revert this feature commit to remove the routes and directory link. Saved
experiment rows can remain private; no source record or live coaching workflow
needs to be reverted. Production promotion of the experimental prompt requires
separate approval.

## Release evidence

- Feature PR: https://github.com/Inside-Success/sales-performance-dashboard/pull/330
- Production commit: `0f96f68`; deployment `dpl_BeJkuwFzohEYYC6SNYiNM1g1WPep`
  reached READY and was assigned the official rose.vercel.app alias.
- CI run 39324874789 passed: 160 tests in 26 files, six workflow static
  verifiers, TypeScript and production build. Nine tests specifically cover
  the new review schema, evidence and authorization boundaries. Scoped lint
  and the local production build also passed.
- Vercel preview provisioning failed before application compilation, as on
  preceding preview deployments. The unchanged production deployment path
  built successfully; no integration or environment settings were changed.
- Ten reports published atomically to the isolated benchmark run: eight
  without an on-call confirmed payment and two with one. No later sales
  outcome is inferred. Two reports correctly identify no actual objections.
- Authenticated official-site checks loaded all ten reports with all four
  sections. Evidence and absent-category disclosures expand; section anchors
  work and the desktop layout has clear separated cards. Next-report navigation
  was verified from report 5 to report 6. Existing coaching home loaded its
  165-rep selector; FAQ loaded its normal interface and chat history; original
  report 8212 retained its existing coaching sections. No paid FAQ question
  or live coaching generation was triggered by these checks.
- Signed-out list and detail requests both returned 307 sign-in redirects,
  without report content. Non-manager rejection is covered by access tests;
  no other person's account was impersonated.
- Model testing used 24 paid requests. Recorded usage-derived cost is
  **$4.9725149**. Conservative reservations including a possible second native
  gateway attempt total **$18.9990086**, below the $40 hard ceiling. This is
  receipt-derived usage accounting, not an independently audited invoice.
- Nine final drafts used Opus 5.5 with Sonnet 5.5 medium review. One used a
  Sonnet 5.5 draft with Opus 5.5 correction. All ten received independent
  source adjudication by Codex. The private run preserves prompts, source
  versions/hashes, receipt ledger and adjudication notes.
- Rejected drafts/reviewer changes included ordinary attorney review treated
  as resistance, duplicated value/cost categories, an incorrect show rename,
  and advice based on garbled transcript fragments. One timed-out HTTP
  response was recovered from its successful saved n8n execution without a
  repeat provider request. Output-cap failures are included in cost.
- Final visual review removed one redundant sentence from review 1 and
  corrected writer provenance for review 3. These bounded changes touched
  only the two isolated benchmark output rows, after full schema validation.

### Acceptance boundary

The reviewed set is ready for Mike and Rich to evaluate. It does not prove
unattended report generation is error-free: the reviewer model also made
incorrect suggestions that were rejected during source adjudication. Do not
promote this prompt or model combination into live report generation solely
because these ten corrected examples look good. Review feedback and a further
held-out evaluation are needed before a separately approved promotion.

No production n8n workflow, original call/report, scoring or usage record,
Google Sheet, authentication policy or FAQ answer generation was changed.

