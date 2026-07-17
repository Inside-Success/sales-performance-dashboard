# Ask Sales Daily Knowledge Refresh

Date: 2026-07-14

Last updated: 2026-07-17

## 2026-07-17 Daily Knowledge Inbox replacement

The former conflict-card workflow has been replaced at the review boundary by a simpler Daily Knowledge Inbox. Collection remains read-only, but a Slack candidate must now come from one explicitly delimited root message/thread and a Google candidate from one document section. The analyzer cannot combine unrelated Slack roots into one policy draft.

- Only durable new rules, policy changes, authoritative clarifications, or repeated chatbot knowledge gaps enter the actionable inbox. Routine questions, answers, metrics, coaching, scheduling, and one-off operational conversation are screened outside the actionable lane.
- Rudy, Rich, Mike, Raul, and Madeline are recognized as potential authority signals, never automatic truth. The draft preserves the named speaker and authority basis; unclear, manager-level, contradictory, or scope-ambiguous guidance requires owner confirmation.
- Same-policy comparisons require the same scope, decision/action, and specific subject or policy object. Broad vocabulary overlap cannot create a hard conflict or link a quality case to an unrelated source proposal.
- The admin sees one proposed chatbot answer, the current official answer only when there is a strong same-decision match, compact evidence, and plain actions: accept, edit and accept, keep current, needs confirmation, or ignore. Internal blocked IDs and the legacy multi-conflict interface are not reviewer-facing.
- Acceptance remains a draft decision. `Build test preview` revalidates the approval snapshot, atomicity, evidence, scope, duplicate decision keys, and explicit conflict resolution, then records a current-versus-proposed manifest. It does not publish or change chatbot authority.
- The separate 9:20 PM quality review distinguishes wrong/incomplete answers, wrong policy retrieval, missing repeated knowledge, correct safe routes, non-FAQ questions, and technical failures. A protected maintenance step recomputes old source matches before the audit; it cannot approve or publish.
- The actionable confidence floor is 80%. Lower-confidence or unclear-authority drafts go to owner review instead of ordinary approval.

Final Git publication remains deliberately blocked until a dedicated repository-scoped GitHub identity exists. A personal or broadly privileged token must not be reused.

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

Content approval does not change production. `Prepare release` creates an immutable manifest and records the required compiler, test, diff, deployment, signed-in QA, error-log, and rollback checks.

Direct one-click Git publication is intentionally disabled until a dedicated, repository-scoped GitHub automation identity exists and the end-to-end governed compiler/deployment/rollback path is proven. Reusing a broad personal GitHub token or an unrelated n8n credential is prohibited. Until that final integration is supplied and validated, a prepared manifest must go through the existing reviewed Git release process.

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
