# Magic Mike coaching and manager insights — September 30, 2026

## Authorized scope
Moonis approved rep coaching content/presentation improvements, a simple manager coaching-insights page, bounded model comparisons, and a total testing ceiling of $40. Spend is a ceiling, not a target. Official and self-submitted coaching are included. Current scoring V2, compliance, Ask Sales and intake/recovery contracts remain separate. No historical report regeneration, source-document edits or test notifications.

## Dashboard candidate
- Report outcome first, practical improvement action always visible, explicit Show explanation / Hide explanation control. Keyboard-accessible native disclosure, reduced-motion icon feedback. Flip the `expanded` prop in CoachingReportContent to true to restore all explanations without changing report data.
- Optional versioned reviewed_coaching_v1 enrichment in existing source_payload JSON; schema and source identity validation with legacy fallback. No database migration or mandatory new field.
- Hidden `/manager/coaching-insights`, with the same requireRepScoringAdmin authorization as the existing scorecard. Period (7/30/90 days), report type and rep filters. One call counted once per theme. Official/manual selections stay separate.
- Topic grouping uses saved reviewed blocker/improvement text, without extra AI calls. Counts mean report mentions, including resolved concerns; they are not lost-deal counts or causal proof. Older reports use saved text; coverage is stated. Each theme reveals latest supporting calls. Read failure is shown as unavailable, never a fake zero.
- Existing score, transcript evidence, chat, feedback, report URLs and legacy readers retained.

## Release gate and rollback
Candidate is not proof of production completion. Require type/lint/build, focused grouping/schema/rendering tests, authenticated hosted UI inspection, manager denied-access checks and natural post-release delivery inspection.

Workflow changes must be made against a fresh version using scoped patches, with pre-change exports kept privately. Structured coaching is published only when it agrees with final safety-filtered flat fields; any later safety repair causes a fallback to existing flat output. Do not use structured data to bypass safety deletion.

Dashboard rollback: revert this release against baseline main dc5cf34e0a4acf63644548782a4b008cb042e667, checking subsequent unrelated changes. Workflow rollback restores only changed nodes after version comparison. Preserve delivered reports and receipts; never replay a completed call.

## Verification record
Initial isolated branch: agent/coaching-insights-2026-09-30. Initial TypeScript, scoped ESLint, production webpack build, and six grouping/display tests passed. Additional model/workflow and hosted checks are in progress. No production completion is claimed by this draft record.
