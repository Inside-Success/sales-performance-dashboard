# Coaching and manager insights — September 30, 2026

## Authorized scope and boundaries
User approved coaching/report UI, richer non-repetitive feedback, manager coaching insights under the existing exact scorecard email access, official and self-submitted parity, model testing, and a hard total testing ceiling of $40. Preserve normal ISTV, Next Level CEO and reality-show handling. Disputed reality/compliance terms remain deferred. Do not regenerate historical reports, edit source documents, send test Slack messages, change scorecard scoring or alter intake/recovery routing.

## Implementation
- Optional `reviewed_coaching_v1` in existing source payload storage. Outcome, supported improvements, strengths, buyer concerns, agreed next steps all come from the reviewed analysis. Existing flat fields remain compatible with report chat and delivery.
- A final safety repair invalidates the structured view whenever it changes the published core report fields. Dashboard then uses the repaired legacy fields. Matching source identity is required; malformed enrichment cannot break an existing report.
- Outcome first; concrete improvement actions visible with clearly labeled Show/Hide explanation controls. Existing red/white styling retained. Change `expanded={false}` to true in CoachingReportContent for the requested simple presentation rollback.
- Hidden `/manager/coaching-insights`: date, rep and official/self-submitted filters, counts of calls mentioning buyer-concern and coaching themes, expandable evidence examples linking to reports. It is guarded by requireRepScoringAdmin before data access. No new database tables, migrations or AI calls.
- Counts describe available completed reports and theme mentions, including resolved concerns. They are not loss counts or a definitive diagnosis of rep error. Older reports use saved text and simple theme matching; current records use structured observations.
- Existing writer + factual reviewer retained. No extra AI node. Supported optional actions are no longer automatically hidden behind material actions or cut down to one. A reviewer may narrow an existing point whose core action is supported but wording overstates it, with strict index/evidence validation. Unsupported core premises are still rejected. No minimum point quota.
- Surgical n8n transforms in scripts/coaching-insights/patches.cjs. Private fresh original node bodies, published workflow exports, transcript fixtures, paid receipts and replay outputs are outside Git in `.magic-mike-coaching-insights-2026-09-30` in the parent workspace.

## Verification before release
- TypeScript, scoped ESLint, production Next build.
- 66 regression tests: report chat/transcript routes, evidence links, presentation, offer contexts, manual timeout, scoring lookup/matching, structured identity/fallback and manager grouping.
- Eleven real transcript replays: nine official across normal ISTV, Next Level CEO, reality and unknown context, plus both available recent self-submitted executions. Final reviewed improvement counts: official 2,3,1,3,4,4,1,1,1; manual 2,3. Full official/manual finalizers and future document rendering run offline without business writes.
- Sonnet 5 and 5.5, Opus 5.5 and DeepSeek V4 Pro candidates tested. High-reasoning writer at 8,500 tokens truncated several outputs. Medium-reasoning Sonnet 5.5 writer completed the selected sample. Higher review reasoning retained useful refinements while rejecting contradicted omissions. Opus higher cost/truncation and cheap-checker truncations do not justify replacement on this evidence.
- GPT comparison unavailable: the locally retrieved environment did not supply a usable API key. Empty-key auth failures are not evidence that production report chat is broken. Production credentials were not modified.
- Prompt cache reuse measured directly with provider cache-read usage; example writer+review approximately $0.167 versus saved production $0.241. This is coaching pair cost, not the complete pipeline or an invoice. Provider usage-based test spend must be reconciled in final release notes; do not use a stale concurrent ledger total.
- Git-triggered preview hit existing provisioning failure; a CLI preview built successfully. Preview Google sign-in is intentionally unavailable. Signed-in browser verification is a release gate with rollback ready, not implied by preview READY.

## Rollback
Revert this dashboard PR to restore prior report presentation and remove the new manager route. Restore only the changed original n8n node fields from the private baseline files and publish the restored versions; preserve unrelated changes and connections. Do not replace the whole live parent graph or replay deliveries. Structured data is optional; older readers ignore it. No database rollback required.

## Still deferred
Reality/compliance policy clarification and historical false-flag changes remain pending. Specialist scorecard V3 and Ask Sales FAQ are separate scopes. Adoption lift and sales outcomes require observation after release; neither is proven by UI or transcript tests. A fresh naturally arriving production call is distinct from an offline real-transcript replay.
