# Magic Mike FAQ knowledge refresh — November 12, 2026

Status: published and authenticated production-answer-verified. Dashboard PR426 and FAQ PR139 merged; production commit `1461604`, READY deployment `dpl_3vtfakd7DPwsHhSNgXkv2sDMT2F3`.

## Scope and findings

Knowledge-only update from November 11 `d2a26a155b3ebcf74d9381a9` to `f0c7ab7279b325499e75e9f6`: 19 records changed (4 added, 15 amended), 2,619 active records; three duplicate obsolete same-week Call 2 claims superseded. Model, prompts, retrieval algorithms, UI, authorization and Coaching unchanged. Source systems were read-only; no Slack sends.

- HubSpot: applicable notes rather than three contradictory note types; closing only when closed, rejection when not Green Lit, Green Light notes when Green Lit. Preserve accurate status/score and DJ exception. Missing-meeting checks include account, owner, timezone and disconnected calendar; past events may not backfill. Correcting accidental future-call results applies only to the mistaken record.
- Prep audit: Call 1 only, self-booked and after-6-PM-EST exclusions; preserve actual preparation, local contact hours and dispute review before removal.
- SMS: client-local 8 AM–8 PM sending window versus booking-timezone appointment display. Recent incident reports remain, so rollout is not proof of delivery.
- Payments: approved initial $5,000 may use two $2,500 card payments through Tech/Finance; not a reduced minimum or blanket recurring split authorization.
- Onboarding: book Mike follow-up before ending signoff, 10–14 days later; bring ten-day activity/results; Part 2 mock DM now Mike/Raul.
- Training: actual 10 Commandments and Docs vs Reality links, full numbers and November 11 transcripts. Earnings funnel is illustrative, not guaranteed compensation. External platform expectations are not guarantees.
- Closing: Mike's November 12 legal-review follow-up approval is case-specific; no-routine-Call-3 is not an instruction to reject every returning prospect or demand payment before legal review.
- Updated official Island trailer is approved for clients; confidential challenge slides and internal training remain separate.
- Tax: retain Rudy's complete instruction that reps may not promise clients a write-off. Spanish-language rep help does not establish a Spanish-language reality production.

## Source review and limits

All 93 maintained readable source files fetched; seven changed bodies reviewed and 86 unchanged. Twelve Sheet ranges and four folder listings reread. Only a duplicated MC cell/label edit in payment ranges; no new price inferred. Five Slack histories and discovered threads reviewed. Search recovered during this refresh: pagination after November 9 completed, including a bounded second main-channel query after its 20-page cap. This recovered older-thread replies missed by direct history.

Historical Master FAQ pagination gap remains. Two historical Google files and reality-email channel inaccessible; Zoom setup video has no accessible transcript and connector fetch failed; prior Mike audio gap retained. Silent Igor video has no transcript; its explicit Slack instructions supply the knowledge. Individual prospect recordings/peer success anecdotes are not new governing policy. No claim of reading every private message or every recording.

## Validation and release

556 existing FAQ tests plus six new retrieval checks passed; 107 static checks, TypeScript and paired registry validation passed. Isolated review completed: 23 scenarios plus 12 focused reruns, no technical failures, approximately $0.297 API cost. The timing issue surfaced during evaluation and was corrected; all four final affected/variant checks passed. Partial classifications retain missing booking-link or case-specific approval limits. Three authenticated production answers and persisted knowledge hash verified with no technical errors or validation issues. Rollback: revert only this knowledge delta and paired export/receipt; retain unrelated Coaching/main commits and all historical source checkpoints.

Private evidence: `.magic-mike-knowledge-refresh-2026-11-12`. Resume `KNOWLEDGE-CHECKPOINT-2026-11-12.json` (published_verified).

Evaluation found an obsolete same-week Call 2 claim in one of 23 initial answers; the current next-day SOP now supersedes the three duplicate legacy claims. All four final affected/variant follow-up answers passed after governed relationship reconciliation. Source review includes 126 successful thread reads and 1,154 distinct indexed messages after November 9; historical coverage gaps remain.

Nine historical cohort/Friday records now carry the current next-day booking SOP via the existing governing-evidence relationship table. This preserves cohort deadlines and the Friday exception while making the normal booking rule available alongside them; no retrieval algorithm changes.

Final GitHub release check: **562 FAQ tests**, 107 static checks, TypeScript, scoped lint and production build passed. Three live answer latencies: 11.455s, 13.292s, 10.28s. Publication-date receipt is recorded only after these checks. Testing establishes these cases, not universal answer accuracy.
