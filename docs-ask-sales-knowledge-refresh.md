# Ask Sales Daily Knowledge Refresh

Date: 2026-07-14

Last updated: 2026-07-21

## 2026-07-21 release progress and governed-check repair

The first three-draft show-catalog release stopped safely before any merge because the Dashboard runtime PR's governed check failed. The FAQ source PR passed. The compiled release content was valid; the dashboard check had two stale test assumptions: one compared the materialized registry version with the frozen base-registry version, and one selected the current-show catalog by changeable display-title wording instead of its stable `decision_key`.

The compatibility repair preserves all publication gates and changes no chatbot answer by itself:

- Runtime and governance tests now treat the version of the fully materialized registry as the deployed knowledge version while preserving the frozen base registry.
- The current-show regression selects the governed catalog by `current-show-source-latest-approved-show-list-1`, so an admin-approved title change cannot make the safety test lose the correct policy.
- Review, correction, batch, conflict-recheck, preview, PR-creation, and final-publication buttons show an in-place spinner and action-specific text while work is running.
- Long-running PR and publish operations refresh their release row automatically. Their progress, safe-stop explanation, retry instruction, and technical detail remain beside the exact release instead of appearing only at the top of the page.
- Release statuses use admin-facing labels such as `PRs created`, `Verifying release`, `Verification stopped`, and `Production verified`.

The repair and the exact immutable three-draft release were each validated with 235/235 Ask Sales tests, 106/106 static safety checks, ESLint with zero warnings, TypeScript, and an optimized Next.js production build. A failed check still prevents every merge and production change; the release is live only when its dashboard row says `Production verified`.

### First production knowledge release completed

Release `kr_5cc0982c-e6f7-41e4-920a-03f1147dbbf0` completed the full governed path on 2026-07-20/21:

- FAQ PR [#42](https://github.com/Inside-Success/faq-chatbot/pull/42) passed its governed check on exact head `21ea6974d0d124b89ed1e9016d9d375100f83ead` and merged as `b2d764753279ce8397f13fa38f5a2fe25053d2b7`.
- Dashboard PR [#66](https://github.com/Inside-Success/sales-performance-dashboard/pull/66) passed governed run `29774511970` on unchanged exact head `eba529754e6cf80ce3ea9ff31cc0a96e03744759` and merged as `a09cd1199be395baa1b9296a94e0b2cff624319f`.
- Publisher execution `370366` succeeded. Vercel production deployment `dpl_Ht8Su23RNguGS1DUMFcVZTJiAwS8` is `READY`, contains dashboard merge `a09cd1199be395baa1b9296a94e0b2cff624319f`, and owns the rose production alias.
- Exact production health reached knowledge version `8c8c677c1209f2d7`, with policy `kr_7ace400fcdf68db9` present and both superseded show-catalog policies inactive. The release row is `production_verified` with no error.
- The three accepted source rows compile into one governed current ISTV show catalog: `Internet Masters TV` is active; `Americas Top Trainers` and `Live Longer` are inactive; list membership still does not prove an episode has aired or is watchable.

No further action is required for this release. Future releases follow the same four visible steps and are complete only at `Production verified`.

## 2026-07-20 reviewer-correction repair

The first correction of an approved draft exposed a usability gap: the admin correctly entered `Builders of America is the correct show name` in the audit note, but did not edit the separate proposed-policy field. The note was preserved correctly while the unresolved AI wording remained the release content. The readiness gate then blocked it later, creating an avoidable review loop.

The review and Approved pages now enforce one clear contract:

- `Final chatbot rule` is the exact proposed knowledge. `Audit note (not the chatbot rule)` records who confirmed it, scope, and reasoning.
- Question wording and `if same / if different` alternatives cannot enter the Approved queue. The same deterministic release-readiness checks now run during acceptance, not only during preview creation.
- Existing red drafts can be corrected in place, closed with `Keep current answer`, or sent for confirmation. Every action is exact-admin, version-checked, audited, and leaves production knowledge unchanged.
- The Approved page states that red drafts never block green drafts. With no selection, the button says `Select a green draft` instead of displaying a confusing zero-count action.
- The governed catalog already contains `Builders of America`, so a source proposal attempting to rename it is a no-change decision: keep the current answer rather than publish a rename unsupported by its Sheet row.

## 2026-07-20 release-readiness repair

The first owner use of `Build test preview` exposed a real gap between content approval and release compilation: older approved drafts could have no stable `decision_key`. The compiler then failed safely with an incomplete-policy error, but the admin page showed only a generic message far above the action. No release row, Git operation, or production knowledge change occurred.

The release boundary now performs and displays a deterministic preflight before a draft can be selected:

- Green `Ready for preview` drafts have current source snapshots, complete human approval lineage, one final decision, source evidence, product scope, and a stable policy identity. A missing identity is derived only from the accepted atomic decision or its single governed conflict.
- Red `Needs correction` drafts cannot be selected. The card explains the exact reason, including combined Sheet rows, abbreviated evidence, unresolved alternatives, unsupported rename/replacement inferences, stale snapshots, or incomplete conflict decisions.
- `Send back for correction` removes the draft's content approval and returns it to the owner-review queue with an audit note. It does not change chatbot knowledge.
- Individually accepted rows from the governed ISTV Offers Sheet are compiled into one replacement for the current approved show catalog. This prevents disconnected per-show facts from leaving the general show-list answer stale. Only the rows the admin selected are applied, and the prior list policy is superseded through the governed release ledger.
- Release creation and candidate state changes are guarded in one fail-closed database statement. A concurrent edit cannot leave a partial preview.
- Preview errors now appear beside the preview action with an actionable explanation. Successful previews open in Release history with a side-by-side current-versus-proposed comparison. The action is single-flight to prevent accidental double submission.

The admin operating order is shown directly on the Approved tab:

1. Select only green drafts.
2. Build the test preview; production is unchanged.
3. Create both release pull requests and wait for their checks.
4. Use `Publish verified release`; treat the change as live only after the release says `Production verified`.

The implementation adds regression coverage for missing decision identities, current/stale approval lineage, combined Sheet rows, unresolved wording, unsupported inferred replacements, apostrophe/name normalization, show-catalog compilation, supersession, and original candidate lineage.

Pre-release verification passed 234/234 Ask Sales tests, 104/104 static safety checks, TypeScript, scoped ESLint with zero warnings, `git diff --check`, and the optimized Next.js production build. A read-only evaluation of the six existing approved drafts found three release-ready atomic show updates and three correctly blocked drafts; it created no release or production change.

## 2026-07-17 Daily Knowledge Inbox replacement

The former conflict-card workflow has been replaced at the review boundary by a simpler Daily Knowledge Inbox. Collection remains read-only, but a Slack candidate must now come from one explicitly delimited root message/thread and a Google candidate from one document section. The analyzer cannot combine unrelated Slack roots into one policy draft.

- Only durable new rules, policy changes, authoritative clarifications, or repeated chatbot knowledge gaps enter the actionable inbox. Routine questions, answers, metrics, coaching, scheduling, and one-off operational conversation are screened outside the actionable lane.
- Rudy, Rich, Mike, Raul, and Madeline are recognized as potential authority signals, never automatic truth. The draft preserves the named speaker and authority basis; unclear, manager-level, contradictory, or scope-ambiguous guidance requires owner confirmation.
- Same-policy comparisons require the same scope, decision/action, and specific subject or policy object. Broad vocabulary overlap cannot create a hard conflict or link a quality case to an unrelated source proposal.
- The admin sees one proposed chatbot answer, the current official answer only when there is a strong same-decision match, compact evidence, and plain actions: accept, edit and accept, keep current, needs confirmation, or ignore. Internal blocked IDs and the legacy multi-conflict interface are not reviewer-facing.
- Acceptance remains a draft decision. `Build test preview` revalidates the approval snapshot, atomicity, evidence, scope, duplicate decision keys, and explicit conflict resolution, then records a current-versus-proposed manifest. It does not publish or change chatbot authority.
- The separate 9:20 PM quality review distinguishes wrong/incomplete answers, wrong policy retrieval, missing repeated knowledge, correct safe routes, non-FAQ questions, and technical failures. A protected maintenance step recomputes old source matches before the audit; it cannot approve or publish.
- The actionable confidence floor is 80%. Lower-confidence or unclear-authority drafts go to owner review instead of ordinary approval.

Final Git publication uses the dedicated repository-scoped `Ask Sales Knowledge Publisher` identity and the two-step exact-admin release path described above. No personal or broadly privileged credential is used by the dashboard.

## Purpose

The refresh system checks the approved Ask Sales discovery sources every day, extracts possible policy changes, compares them with the governed V3 registry, and places proposals in an exact-email admin review queue. Discovery content never becomes answer authority automatically.

The live chatbot, Coaching workflows, Magic Mike report generation, and existing dashboard ingest paths are not modified by this system.

## Schedule and sources

- Schedule: daily at 9:00 PM in `America/New_York` (Miami), including daylight-saving changes.
- Slack: read-only access to `C0AUQKNR8CF` and `C09AF0NQJE7` only. Both are private channels. The dedicated bot credential has only `groups:history`; the collector uses a 48-hour activity overlap and reads replies only for unique changed roots that report replies.
- Google: read-only access to the 37 Docs and four Sheets already present in the governed FAQ source corpus. Every visible Sheet tab is read through the Google Sheets API.
- The high-volume Green Light tracking Sheet is fingerprinted across every visible cell, but row-level operational records are deliberately excluded from AI review. The AI sees tab names, headers, row/cell counts, and full-tab fingerprints. Other large Sheets use bounded head/tail samples plus full-tab fingerprints, so middle-row changes are still detected without oversized requests.
- The Ask Sales Feedback output Sheet is deliberately excluded.
- Unavailable files remain visible, are recorded as unavailable, and are retried on later runs.

## n8n production assets

All assets are isolated in the Inside Success cloud at `https://insidesuccess.app.n8n.cloud`.

| Asset | ID | Role |
| --- | --- | --- |
| Daily orchestrator | `ua18B5wbsYptLqJX` | Runs at 9 PM Miami, reads the dashboard source registry, and routes only allowlisted sources. |
| Slack collector | `ODCwPMUxJphOSpcy` | Reads only the two approved channels and their threads. It has no Slack write node. |
| Google collector | `RJpxKZjm0f3gfWHS` | Reads Drive metadata, Docs text, and all visible Sheet tabs. It has no Google write node. |
| Analyze and stage | `rNc9rWTBHRSEwM3P` | Redacts snapshots, calls DeepSeek with a strict JSON extraction contract, and stages proposals for humans. |
| Error handler | `dX97Cup1oPeTS1wQ` | Redacts failures and stores them in the dedicated n8n data table. |
| Error data table | `J5Os7jQZCpiCNLxR` | Durable Ask Sales refresh failure queue, separate from Coaching. |

Dedicated credentials:

- `Ask Sales Knowledge Refresh - Dashboard Service`
- `Ask Sales Knowledge Refresh - DeepSeek`
- Dedicated Slack credential `Ask Sales Knowledge Refresh - Slack Read Only`
- Moonis-owned Drive credential `Syed Moonis Haider cred`

No Deo-, Mike-, Rudy-, Tyler-, Bolaji-, or Coaching-owned credential is referenced.

The shared `Moonis - n8n integration bot` Slack credential is not referenced by this refresh system and was not changed.

## Dashboard architecture

The protected service route is:

```text
GET/POST /api/ask-sales-faq/admin/knowledge-refresh/ingest
```

It uses a server-only `ASK_SALES_KNOWLEDGE_REFRESH_TOKEN`, validates every payload, rejects non-allowlisted source IDs, removes common secrets and regulated-number patterns, hashes normalized content, and stores additive data in:

- `ask_sales_faq_refresh_sources`
- `ask_sales_faq_refresh_snapshots`
- `ask_sales_faq_refresh_candidates`
- `ask_sales_faq_refresh_releases`
- `ask_sales_faq_refresh_audit`

The admin page is:

```text
/ask-sales-faq/admin/knowledge-refresh
```

It uses the existing exact-email Ask Sales admin check on every page and API request. Anonymous requests redirect to sign-in. Authenticated non-admin and invalid requests receive the same hidden/not-found behavior as the other Ask Sales admin pages.

## Conflict and approval rules

1. Source text is untrusted discovery evidence.
2. The dashboard supplies DeepSeek only a compact set of related governed policies and unresolved blocked topics.
3. DeepSeek extracts candidate rules but cannot approve, reject, or publish them.
4. The dashboard independently recomputes policy overlap and conflict level.
5. Every candidate requires a human decision.
6. Every blocked topic is resolved from its internal ID into a readable topic name, current approved policy (when one exists), governed evidence, and source reference. The internal ID is shown only inside collapsed technical audit details.
7. Direct or blocked conflicts cannot be approved without an explicit `supersede` or `scoped_coexistence` decision and a reviewer note that records authority, scope, and exceptions.
8. A blocked conflict cannot be approved when its registry entry or comparison evidence cannot be resolved. The reviewer must use `needs_owner` or `defer` instead.
9. A blocker that shares only broad wording with the proposal is labeled as a weak automated match rather than a proven conflict, and approval remains unavailable until a policy owner corrects the classification. New analyses require topic-specific overlap before assigning a blocked conflict.
10. If a source changes after review, the previous proposal and approval become stale automatically.
11. Optimistic versions prevent two admins from silently overwriting each other's decision.
12. Bulk review is limited to non-approval dispositions such as defer, needs-owner, duplicate, engineering, or reject. Bulk approval does not exist.

## Backlog and future-noise controls

The initial Google Doc extraction was a baseline scan of source material already accounted for during the V3 build. On 2026-07-15 every preserved baseline proposal was reviewed, then moved out of the actionable queue with an audit note. No proposal was deleted, approved, added to V3, or published. Explicit no-change confirmations are preserved as duplicates.

Future runs use three conservative controls:

1. After the first Google Doc/Sheet snapshot, the dashboard computes a deterministic change-only packet. DeepSeek sees additions, removals, and replacements, not the unchanged full source.
2. The analyzer excludes no-change confirmations, duplicate restatements, daily metrics, coaching schedules, scripts/templates, CRM bookkeeping, internal admin steps, and one-off cases unless they establish a durable reusable compliance or sales-policy boundary.
3. Exact cross-snapshot repeats and explicit no-change results are staged outside the active queue; candidates below 80% AI confidence go to `needs_owner`. Every original record and evidence quote remains auditable.

The admin page now defaults to the actionable Daily Knowledge Inbox and provides server-side search, filters, pagination, visible counts for screened/duplicate/stale records, safe batch dispositions, and individual acceptance only. A current-policy comparison appears only for a strong same-decision match. Weak legacy matches are called unreliable and cannot be accepted. Conflict metadata can be recomputed against the current deployed V3 registry without changing candidate decisions or production knowledge.

## Publication boundary

Content approval does not change production. `Build test preview` creates an immutable manifest and records the required compiler and diff checks. `Create release PRs` is a separate exact-admin action that asks the dedicated n8n publisher to create synchronized FAQ-source and dashboard-runtime pull requests. `Publish verified release` is another separate exact-admin action; it rechecks both exact PR heads, requires both governed checks to succeed, merges only those verified heads, waits for production deployment, and verifies the exact expected knowledge version before recording success.

The repository-scoped GitHub credential remains only in the dedicated Inside Success n8n publisher. It is not available to the dashboard or browser. Single-use, expiring action claims, an allowlisted webhook, immutable release hashes, exact-head verification, and fail-closed deployment checks prevent an approval or preview from bypassing human publication control. Any failed or incomplete check stops safely with production unchanged and can be retried from the same release row; the admin does not need to rebuild the preview or recreate already-valid pull requests.

## Current production state

The dashboard implementation was merged in PR [#47](https://github.com/Inside-Success/sales-performance-dashboard/pull/47). Retry-safe snapshot analysis was merged in PR [#48](https://github.com/Inside-Success/sales-performance-dashboard/pull/48), and audit-log backfill for already completed analyses was merged in PR [#49](https://github.com/Inside-Success/sales-performance-dashboard/pull/49). Production deployment `dpl_2KF72Mq7R5iYRkUnGTCd7KDVxVCX` is `READY` on `https://sales-performance-dashboard-rose.vercel.app`.

The five n8n workflows are active and validate with zero runtime errors. The daily orchestrator has only its permanent `Daily 9 PM Miami` trigger; every temporary verification trigger has been removed.

The scheduled 9 PM Miami execution `351154` completed successfully on 2026-07-15. Both private Slack sources passed collection, analysis, and staging.

Current source state:

- 36 of 37 Google Docs and three of four Google Sheets are available.
- One legacy Google Doc (`1GHvm...`) and the All SOPs Sheet (`1geZ...`) return `404` to the Moonis-owned Drive credential. They remain visible, unavailable, and retry automatically every day.
- All 39 accessible Google sources completed collection. The final run recorded 36 unchanged sources and three intentionally changed Sheet snapshot representations.
- All accessible stored source versions complete analysis or are deterministically marked as having no material change.
- The initial baseline remains preserved in non-production queue states. The default admin view contains only genuinely actionable current Slack/Sheet proposals.
- The two known Google `404` sources remain visible and retry daily. Slack scope, cursor, late-reply, and rate-limit fan-out blockers are resolved.
- Nothing in any queue state is production answer authority.

## Verification gates

- n8n runtime validation: zero errors on all five workflows.
- Dashboard Ask Sales tests, ESLint, TypeScript, and optimized Next.js build must pass before merge.
- Production returns `401` for the ingest route without the service token. Anonymous admin requests redirect to sign-in; authenticated non-admin requests must remain hidden as `404`.
- Controlled Google and Slack verification, unavailable-source handling, DeepSeek JSON extraction, retry-safe analysis, unchanged-snapshot idempotence, delta-only Google analysis, conservative noise screening, conflict classification, and admin staging are complete.
