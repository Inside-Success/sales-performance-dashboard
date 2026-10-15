# Magic Mike durable provider recovery — October 15, 2026

## Scope and status

Owner approved the production implementation after the read-only incident investigation. Provider transport/checkpoints and source retry changes are live. All ten incident sources are confirmed delivered; independent database reconciliation found exactly one dashboard report per source. No queued or held completion rows remained at the final recovery check.

## Confirmed causes

- Nine missing calls completed their writer, factual audit and compliance processing, then hit a Cloudflare 524 while making a same-instance public-webhook safety-screen call. The caller's longer HTTP timeout could not extend the proxy deadline. Underlying provider executions could continue to the old 900-second hard limit, and HTTP retries could start overlapping work.
- One additional classifier returned invalid JSON despite an ordinary end-turn response. Its quoted evidence joined two JSON strings with a slash. It was not token truncation.
- The old recovery worker attempted a call once and then held it. Handled pipeline failures could appear as successful n8n executions. Completion must be established from the source-level receipt and actual artifacts.
- The specific reason the underlying provider requests stalled is not proven. This release removes the confirmed proxy/retry failure path and adds durable recovery; it does not claim to prevent every external outage.

## Implementation

1. Internal native provider workflow `X9L4JtDbpkSCflxZ` supports the existing Anthropic and DeepSeek request/result contracts. Official classifier, writer, audit, compliance, safety and repair paths, plus the four manual provider paths, use native Execute Workflow calls. No provider-model replacement or policy/rubric change.
2. `/api/internal/provider-checkpoints` uses the existing ingest authorization. Additive dashboard-owned Postgres tables hold exact-request hashes, ownership leases, normalized successful results and provider health. No prompt/transcript copies are stored in these tables. Raw response duplication is omitted. Completed entries are retained for bounded reuse; old non-running rows are cleaned in batches after 14 days.
3. Atomic request leases prevent concurrent owners. Expired owners cannot overwrite a newer completion. Successful exact-request results are reused; reused stages record zero new token/cost usage while keeping original accounting metadata separately. The normal factual/safety review and report rendering remain active.
4. Provider requests have bounded deadlines (Anthropic 300 seconds; DeepSeek 180 seconds; helper 420 seconds). Ten-minute checkpoint leases exceed that helper deadline. Provider HTTP retries are disabled; source recovery owns retries. After three transient provider failures, a five-minute circuit cooldown permits only one recovery probe. Existing completed results remain available during an outage.
5. The classifier uses Anthropic's JSON-schema output format and validates status/confidence/required string fields before accepting its result. Malformed, empty, truncated or refused responses cannot become successful classifier checkpoints.
6. The recovery worker reads queued sources, selects one due source per pass, claims it conditionally on row/status/attempt, increments the attempt, and passes that attempt to the official recovery entry. Transient faults use increasing delays (initial five minutes, then fifteen minutes/one hour; daily backoff after three recovery attempts). Such jobs remain queued. Auth/refusal/uncertain-write conditions remain held for review rather than blindly repeating writes. Existing alerts call out unconfirmed outcomes; the scheduled crash scanner remains active.
7. Existing source/report duplicate guards, unreviewed-draft audit, reviewed-cache checks, receipt verification and uncertain partial-write holds remain in place. Recovery follows the coaching-only path and does not request numerical rescoring.

## Incident recovery

Before recovery there were ten held source rows and no matching dashboard reports. Eighteen exact archived successful writer/compliance stages were restored into the checkpoint store after checking source, request ID, parsed result and stop reason. They remain unreviewed/limited to their original stage; they do not bypass the current factual or safety audit. Where the exact previous audit request/result could not be independently reconstructed, the audit was rerun.

The first real canary was source `recg2qhkL90AByJx5`, execution `1130040`, dashboard report `7932`. Writer and compliance were reused; the factual audit and safety screen completed. Dashboard receipt, report row, Google document creation/content insertion, compliance append and both Slack delivery nodes succeeded. The signed-in report UI and expandable explanation also worked. The remaining sources are recovered in controlled small batches, with the existing fresh source/report duplicate check on every run.

| Source | Recovery execution | Dashboard report | Final status |
| --- | --- | --- | --- |
| `reciv1NGToIJmvPNN` | `1130102` | [7935](https://sales-performance-dashboard-rose.vercel.app/call/7935) | Delivered |
| `recg2qhkL90AByJx5` | `1130040` | [7932](https://sales-performance-dashboard-rose.vercel.app/call/7932) | Delivered |
| `recOW9YJtnCELbT7L` | `1130104` | [7934](https://sales-performance-dashboard-rose.vercel.app/call/7934) | Delivered |
| `reccwCdHbHV7N2wN4` | `1130181` | [7936](https://sales-performance-dashboard-rose.vercel.app/call/7936) | Delivered |
| `recADXIobL2TD8lL1` | `1130183` | [7937](https://sales-performance-dashboard-rose.vercel.app/call/7937) | Delivered |
| `recYS2pJumS9cb0Fl` | `1130231` | [7939](https://sales-performance-dashboard-rose.vercel.app/call/7939) | Delivered |
| `recBDIkEqXgcgcVn9` | `1130254` | [7940](https://sales-performance-dashboard-rose.vercel.app/call/7940) | Delivered |
| `recX0yiMHAiJkRDrD` | `1130292` | [7941](https://sales-performance-dashboard-rose.vercel.app/call/7941) | Delivered |
| `recUw6UrzeGWLp4pF` | `1130295` | [7943](https://sales-performance-dashboard-rose.vercel.app/call/7943) | Delivered |
| `recN60r4VKKT5b31U` | `1130342` | [7942](https://sales-performance-dashboard-rose.vercel.app/call/7942) | Delivered |

Every recovered execution confirmed document creation/content insertion, Slack top-level/thread delivery, dashboard posting and the final source receipt. Six also appended compliance evidence; the other four correctly produced no append because their preserved compliance results contained zero red flags. All ten dashboard rows independently matched their exact transcript URLs and Airtable report IDs, with one row per source.

New model cost from saved normalized provider usage/pricing: **$2.37043121 recovery**, **$0.01573632 isolated model tests**, **$2.38616753 total (about $2.39)**. This excludes already-incurred outage costs and normal incoming production calls. It is a token/pricing estimate, not an independently reconciled provider invoice. Eighteen old writer/compliance results were reused. Thirty-six newly completed incident stages include required audits/safety and necessary repairs; no factual or safety check was bypassed to save cost. Both real provider-health rows had zero failure streaks at final reconciliation.

## Verification

- Next production webpack build, focused ESLint and TypeScript checks passed.
- Provider/retry graph assertions and the existing 17 crash-recovery assertions passed.
- Live Postgres integration: eight competing claims produced one owner; stale completion was refused; late failure could not replace success; different request hashes stayed separate.
- Isolated provider-health namespace: three simulated transient failures opened the circuit; eight competing probes produced one owner; successful recovery reset the circuit. No real provider health was modified by this test.
- Anthropic and DeepSeek isolated native requests succeeded. Repeating an exact request used the saved result at zero new model cost.
- The exact previously malformed classifier transcript returned valid schema-constrained `scored` output.
- An isolated failure fixture made no model call, persisted a failed checkpoint and stopped with an error. It did not return a success-shaped result.
- The manual provider input mapping succeeded in isolation, without creating a fake self-submitted report. Naturally arriving official execution `1130023` confirmed real report `7933`, document creation, Slack delivery and applicable compliance append through the new native route. This is not a claim that a new human manual submission arrived during the verification window.
- Temporary QA, failure-fixture and incident recovery-runner workflows are deactivated. The regular official/manual workflows, native internal provider, scheduled recovery worker and crash scanner remain active.
- First deployment PR: [#311](https://github.com/Inside-Success/sales-performance-dashboard/pull/311), production merge `d8ef65367b1bc879080e30600adbffa1e7db7c4e`, deployment `dpl_5WCUjKVvkeNQVgDKXWtwRQJ3zyd9` READY. Preview provisioning failed before the app build; the production Git deployment succeeded.
- Final workflow manifests, retry-policy edge cases, live integration tests and recovery evidence are recorded in [#312](https://github.com/Inside-Success/sales-performance-dashboard/pull/312). The final local production build passed. At the post-recovery sample, all 80 completed executions of the new internal provider were successful; deliberate failure tests ran in the separate isolated fixture.

## Safety boundaries and rollback

No edits to company sales source Sheets, intake identity logic, numeric scoring, compliance categories/rules, FAQ models/knowledge, admin allowlists or UI layout. Existing normal recovery delivery still creates the intended report artifacts and notifications.

Published helper graph and surgical cutover manifest are in `scripts/n8n/durable-provider-2026-10-15.json` and `scripts/n8n/coaching-durable-cutover-2026-10-15.json`. Credential references are IDs/names only; no credential values or transcripts belong in Git.

Original targeted configurations are preserved in the root project's private `.codex-backups/magic-mike-durable-recovery-2026-10-15.json.gz` (45,043 bytes), alongside n8n's retained workflow versions. No additional checkout or large transcript backup was created.

For rollback: pause the recovery worker, restore the original affected nodes in official/manual/reliability workflows, restore the worker's original queued selection/claim configuration and remove its added `Select Due Recovery` node, then republish and verify those callers. Only then disable the new helper. Preserve completion receipts and recovered business reports. The additive checkpoint tables can remain unused; do not drop data or undo unrelated subsequent releases. Revert only the scoped dashboard commits if the endpoint itself must be removed.

## Operational limits

An external outage can still delay delivery. Uncertain business writes must be reconciled rather than blindly repeated. The new checkpoint service depends on the dashboard database; if unavailable, processing fails visibly and queues for recovery rather than spending again without a lease. A model response arriving after a hard provider deadline may still incur an upstream charge; atomic leases prevent concurrent application owners but cannot cancel work already accepted by an external provider.
