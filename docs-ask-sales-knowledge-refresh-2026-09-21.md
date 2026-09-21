# Ask Sales knowledge refresh — September 21, 2026

## Scope and source coverage

User-requested knowledge-only refresh from the last successful September 16 source checkpoint. Slack MCP and Google Drive reads only: no messages, reactions, source edits, source spreadsheet writes or workflow runs. Manual source review and checkpoints remain separate from the retired automated publisher. The accompanying `KNOWLEDGE-CHECKPOINT-2026-09-21.json` records coverage and limitations; private raw evidence is excluded from Git.

43 accessible registered Google documents/sheets were metadata-checked; five changed sources and the newly announced reality buyer welcome document were read. New roots in four sales channels were paginated, relevant full threads reviewed, and the older master reality FAQ thread revisited for new replies. This does not prove exhaustive coverage of every old Slack thread. Two previously unavailable documents remain excluded. New dated payment totals, personal customer cases, credentials, sales celebrations and peer speculation were not turned into policy.

## Published knowledge changes

- Call 1 pricing: Rudy withdrew the old disqualification exception. Retire the three conflicting inherited exception records.
- HubSpot: both Meeting Status and Cast Score for every call, calendar connection and existing other required fields.
- Pass-off ownership: recipient posts the prospect email in #hubspot-passoff; approximate 15-minute assignment, attend while waiting, report persistent problems to Sales Tech. Existing eligibility/approval rules stay intact.
- Reality buyer welcome: dedicated official template, support address, production handoff; no regular documentary onboarding call. The source has a mismatched mailto hyperlink, so the explicit support address is used.
- Reality: no documentary cohort wording; no separate contract-explanation video, while the required Call 2 package video remains.
- Reality production estimates, tentative Island-only January 10–30, 2027 window, conditional platform plans, and Millionaire Match House age/room expectations.
- Background concerns: Green Light team decides; do not blanket-disqualify or approve Clean and Thriving applicants from a charge description.
- Outbound list: current maximum 75, replacing obsolete 20/20 allocation guidance; daily list restrictions preserved.
- Built for More is DJ/NLCEO; prospect contract copies may be emailed when requested; internal reality FAQ and company Zoom sales recordings are not client handouts.
- Existing booked appointments and opt-outs: attend an already booked call as instructed, without treating this as renewed outreach consent.

## Conflicts deliberately retained

The reality written package still places the documentary interview differently from the mandatory Call 2 video. No new arbitrary benefit decision was made. The reality FAQ says 7–14 filming days while the buyer welcome says 2–3 weeks: show-specific confirmation is required for travel commitments. The regular welcome and Call 2 script disagree on Monday/Wednesday onboarding hours; use the booking link rather than assert either schedule is guaranteed. A product-unspecified deposit discussion and case-specific emergency exceptions were not generalized.

## Protected behavior and release controls

No changes to prompts, model/reasoning effort, retrieval/answer code, UI, auth, coaching, scoring, database schema, environment variables or n8n workflows. Only reviewed knowledge data, paired runtime export, five focused regression tests and documentation. The retired refresh scheduler stays inactive. Do not promote an isolated preview to production. Deploy the reviewed exact Git main commit using existing production configuration. Roll back this knowledge commit and rebuild with production configuration if needed; do not switch the chatbot to the old rigid runtime.

## Verification and release

Published knowledge hash: `0f7a126e1f9fd40f7e749cf9`. Existing 346 tests passed; five added retrieval/scope checks passed, along with static safety, TypeScript and scoped lint. Twelve isolated medium-reasoning Luna answers were manually reviewed: all addressed the intended decision, including appropriate conflict/partial responses. Estimated provider cost $0.07447502; latency 6.5–15.0 seconds. The final export adds an additional source citation to the tested outbound record; answer text and behavior are identical. Paired runtime validator passed. GitHub full CI passed all 351 tests, static safety, TypeScript, lint and production build (run 35590809982); paired FAQ CI passed (35590970670). Hosted isolated preview `dpl_AoeUTuPMdPtnHQdPisg6E1d2AxVb` passed authenticated Ask Sales, Conversations, Usage and Coaching page reads plus a real Luna reality-welcome answer; its test conversation was verified in the isolated database and removed. No production chat was written. The initial automatic preview failed resource provisioning; the existing isolated branch was reused without deleting databases. Production release is verified below. Browser automation timed out twice; no fresh visual-browser inspection is claimed. Automated retrieval checks do not measure real-world accuracy; bounded model answers are reviewed separately. No claim of perfect answers.

## Final production receipt

- Dashboard PR205 merged at `bba32168a67f52ea028cb0da65d3d17bdaefcd77`; paired FAQ PR79 merged at `e32b4254cbe014a99f69a4cb886bf2b8c1e95122`.
- Final dashboard CI `35591500531` passed tests, static guards, TypeScript, lint and production build. Final paired CI `35591352586` passed.
- Fresh production deployment `dpl_Bd8DEiZ9DCbSUsELa3aXaxcdm1QV` is READY on the exact dashboard merge commit. Vercel project target and the `sales-performance-dashboard-rose.vercel.app` alias both point to it. Production environment was used; isolated preview was not promoted.
- Effective exported knowledge hash is `0f7a126e1f9fd40f7e749cf9`; paired export matches, and the admin publication receipt uses this hash and September 21 Miami date. Live hash is inferred from the verified deployed source rather than a fresh authenticated production answer.
- Public production Ask Sales/admin/Coaching requests reached the expected authentication boundary without server errors. Browser automation timed out twice, so no fresh signed-in production chat or visual inspection is claimed. Hosted authenticated pages and the real answer were verified in isolation before release.
- No source documents or Slack messages were written; no production conversation fixture, database migration, credential change or workflow change was performed.

Use `docs-ask-sales-knowledge-checkpoint-2026-09-21.json` in the dashboard repository (or `runtime/KNOWLEDGE-CHECKPOINT-2026-09-21.json` in FAQ) for the next user-requested refresh. The rollout directory retains the original reviewed candidate snapshot as audit history. The newer receipt supersedes its pending-publication status.
