# Ask Sales candidate rollout

This is the Ask Sales revamp release procedure. See `RELEASE-2026-09-16.md` for acceptance evidence and PR195 for the production deployment receipt. Code tests and successful HTTP calls are not accuracy measurements.

## Coordinated components

- Dashboard: select `ASK_SALES_FAQ_RUNTIME_VERSION=revamp` in staging first, then in the authorized production release. Set `FAQ_REVAMP_PROVIDER=openai` and `FAQ_REVAMP_OPENAI_MODEL=gpt-5.6-luna` for Luna, or `FAQ_REVAMP_PROVIDER=deepseek`. Keep keys server-only. There is no automatic cross-provider fallback.
- FAQ repository: `runtime/revamp-base-registry.json` must match the dashboard base export; `runtime/revamp-admin-approved-releases.json` must match the dashboard candidate ledger. Run both legacy and candidate validators.
- Runtime, admin review, preview, publication manifests and health use the same selected registry. A publication prepared for another base version is rejected. The publisher already reads the manifest's allowed ledger path; no publisher workflow change is required.
- `ask-sales-collector-patches.json` is a generated patch template, not a live-state record. The production receipt identifies applied versions. It expands the Google/Slack guards and disables raw execution-payload persistence on both collectors and their orchestrator/analyzer. Refresh live draft and active versions before applying, reject a different active version or changed guard/settings, preserve unrelated node/settings fields, validate, and explicitly publish. Do not overwrite another person's draft. Retain an exact pre-change rollback snapshot privately.
- Collector payloads are still redacted at source ingestion before database storage and model analysis. Expanded redaction preserves useful policy URLs. Redaction is not a guarantee that all personal information is detected. The new tech channel can contain credentials, so collector persistence settings and ingestion changes must ship before enabling its scan.

## Staging requirements

Use a separate database/branch with test records. Never point evaluation chat/admin requests at production storage: schema preparation, conversation logging, source registration and release operations write to that database. Disable knowledge publication and all outgoing feedback/webhook integrations in staging. Keep auth and exact-admin restrictions enabled. Clear inherited production integration endpoints/secrets from the branch environment.

Verify in staging: login/access denials, one conversation and follow-up, history reload, duplicate request behavior, feedback, technical failure presentation, unanswered-question visibility, source refresh/redaction, version conflict rejection, release preview and matching effective registry. Publisher execution stays disabled until a separately reviewed controlled release. A preview sign-in page proves only that page, not this flow.

## Knowledge review limits

Current reality sales interpretation puts the full documentary in VIP based on the mandatory Call 2 video; the written FAQ discrepancy remains recorded. This does not resolve existing signed contracts. Current HubSpot instructions supersede obsolete Keap navigation only for the specifically evidenced process. Case-specific Slack replies are not universal permissions.

The Slack collector fetches channel history and filters recent edits/replies, including replies on older roots. The manual source review used a checkpoint with overlap and full relevant threads. Neither approach proves exhaustive historical coverage, and newly linked videos are not independently discovered or transcribed. Two new audio announcements had no readable MCP transcript in this review. Periodic linked-source review remains necessary.

## Cutover and rollback

1. Confirm source conflicts, held-out answer quality, privacy, latency and isolated end-to-end checks. Record any failed gate instead of relabeling it passed.
2. Serialize with other Magic Mike dashboard releases. Confirm both Git heads and exact checks, review both PRs and collector patch.
3. Merge/deploy the paired reviewed revisions and apply coordinated collector settings. Set the production-only selector/provider immediately before the fresh production build. Do not promote a preview that uses isolated DB/auth settings. Recheck effective knowledge version and a bounded smoke set.
4. Prefer changing the selector to V5.14 and rebuilding the current code; this retains the new source-ingestion privacy safeguards. If reverting to the old deployment instead, first restore the old collector allowlists/settings from the private rollback snapshot so expanded sources cannot reach old ingestion code. Keep revamp ledgers and diagnostics; do not inject revamp releases into the legacy ledger. Pause knowledge publication during rollback.

No changes to coaching, compliance scoring, CRM source data, or source documents are part of this rollout.
