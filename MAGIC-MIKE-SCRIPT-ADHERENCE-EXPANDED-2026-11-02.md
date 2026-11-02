# Script adherence follow-up — November 2, 2026

## Authorized scope
Improve leadership UI, dedicated rep drilldowns, date-aware requirements, and a larger bounded comparison of Haiku and GPT-6.1 Terra. Full one-week backfill remains deferred. No source-system edits or Slack messages. Preserve coaching, intake and recovery workflows. Total project API ceiling remains $40, including the prior $0.229374 pilot.

## Source correction
Read the full October 27 Mike/Rich/Tyler meeting, Google Doc `1r2A-taelSPepc8txkwUL8wiIKZNK3ocR_os27t-hbXM`, reached through the forwarded Slack message `C0B402VSESY/1793117332.228589`. The Second Brain participant search did not locate it; native Slack exposed the attachment.

At 25:01 Tyler chooses September 29 onwards for the Reality Video 1 comparison, with Mike and Rich agreeing at 29:21–29:30. This is an agreed **reporting cutoff**, not independently proven launch timing. A modified date is not a release date. The UI uses Miami calendar dates and excludes earlier Reality Video 1 observations from the denominator without rewriting their evidence. It does not transfer that cutoff to documentary videos or invent Reality Call 2 requirements.

The meeting also emphasizes misleading call titles, separating Video 1 from the pitch, simple decisions rather than excessive analysis, and showing current behavior. The 60-dial-out policy discussed there is outside this script-adherence change; Zoom recordings cannot establish dialing volume.

## Implementation
- Short overview: actions completed, calls assessed, calls without a score.
- Clickable rep rows with dedicated protected routes, per-rep action follow-up, individual calls, original source links and expandable evidence.
- Date/show/stage filters carried into and back from rep routes.
- Distinguish no-show, internal, outreach/voicemail, insufficient evidence, ineligible checklist and unavailable script.
- Explicit action definition and >=50% rule; unclear and inapplicable actions excluded from completion rates.
- Shared date-aware calculation for summary, rep rows, videos and individual actions.
- Paged call rendering (20 per page). Pilot read remains bounded at 2,000 saved rows and visibly reports truncation if reached; this is not a claim of complete all-company coverage.
- Auth before data on both routes; unavailable reads do not masquerade as zero calls.
- Provider dispatch permits only bounded Haiku or Terra standard-price requests, exact stored request hashes, atomic one-time claims, and separate reservation floors. Validates the whole request batch before claiming any item.
- Terra pricing based on official model documentation: https://developers.openai.com/api/docs/models/gpt-6.1-terra. Standard pricing and 30-minute cache writes only; unsupported billing configurations rejected.

## Evaluation and release status
Completed as a bounded expanded pilot. No expanded results were accepted merely because they passed schema validation. The 30-call cohort excludes the previous 12 and uses Zoom closer membership, distinct meeting UUIDs, and three metadata sampling strata. Titles and stored stages select variety only; models must classify the actual transcript. Results, disagreements, costs and final verification are recorded below.

## Rollback
Revert this scoped PR to restore the prior UI/dispatch. Raw saved results and original pilot receipts are preserved. The source/pilot workflows remain isolated and are deactivated after bounded runs; official coaching is not edited.

## Follow-up verification and corrections
- UI PR355 merged as `41a4edd`; authenticated testing caught a percent-encoded rep route mismatch. PR356 (`ebed48a`) fixed exact name resolution. Live Tara drilldown now works with inherited show filter, call expansion, original transcript link and action evidence. Responsive overview checked at 390px and viewport restored.
- Both models classified the same 30 unseen transcripts: 26 legacy-workspace recordings and four main-workspace recordings, covering 20 reps. This is a deliberately varied bounded sample, not a random estimate of company-wide performance.
- First extraction pass: Haiku 11/14 structurally valid; three held (invalid evidence ID, required-action applicability, checklist shape). Terra 16/16 structurally valid. These are validation rates, NOT measured accuracy.
- Source review corrected an early-decline eligibility mistake, an initial audition with detailed pricing incorrectly treated as Call 2, and outbound voicemail taxonomy. Late disqualification after a substantive audition remains assessable. Network names are not show names. Unsupported Reality Call 2 and later Q&A remain visible without fabricated scripts.
- Fixed checklist/part keys and shared exact evidence-ID definitions prevent missing/extra components and fabricated references. An initial review attempt exceeded the provider's 1,000-enum schema limit; 16 requests across the extraction/review attempts were rejected before generation, safely held and recorded at zero generation cost. Shared schema definitions fixed this without disabling strict output. Unknown transport errors retain budget reservations.
- The final directed review uses the complete transcript plus explicitly recorded source findings. It is a correction pass, not a blind accuracy benchmark. Raw model comparisons and rejected outputs remain in the private audit files.


## Final accepted results and acceptance
- Published 30 additional exact-request, reviewed records atomically after code deployment. Total saved sample is 42. A private before/after comparison verified all original 12 rows were byte-for-byte unchanged after JSON serialization.
- Additional 30: 15 assessed (7 documentary Call 1, 5 reality Call 1, 3 documentary Call 2); 6 insufficient-evidence recordings, 3 early declines/disqualifications, 3 unsupported Reality Call 2, 2 later follow-ups, 1 outbound voicemail recording. All remain visible; no silent exclusions.
- Expanded sample: 194 complete / 262 assessable actions (74%), 68 not complete, 11 not observable and 66 not applicable. Combined sample: 254 / 337 (75%), 19 assessed calls out of 42. These are action-completion figures, not model accuracy or sales-quality ratings.
- One interrupted reality pitch cannot establish the >=50% threshold. It remains Not observable and is excluded from the video denominator. Seven new documentary research actions are intrinsically not observable from transcripts; the remaining three unknown actions concern a resumed audition with unavailable earlier content. No fabricated certainty.
- Video chronology review corrected a review finding that incorrectly combined two distinct segments: a show pitch at 04:15 and a network introduction at 17:22 with live discovery in between. The accepted record credits both. The original finding, provider outputs, correction and final request remain in private receipt/request archives. Another call legitimately played two show-pitch versions; the embedded network tail is not a separate introduction. A newer-video failure did not erase successful older-video playback later in another call.
- API total across pilot phases: **$1.868395**; additional spend beyond previous $0.229374 pilot: **$1.639021**. All requests reconciled; no unresolved reservations. Budget remains $40. Provider receipts and pre-generation rejection accounting are stored privately; not a separate provider invoice audit.
- Haiku remains cheaper, but Terra gave more structurally reliable drafts and avoided unsupported network-as-show labels in this cohort. Terra is the preferred next-stage candidate; neither model's raw outputs were error-free. The accepted results use Terra plus source-directed review. Do not describe this corrected cohort as an independent accuracy benchmark.
- PR355 UI/date policy, PR356 encoded-name fix and PR357 evidence/classification improvements are merged. Production acceptance commit: `3bad87d81fe222acbda9b2851239c8d6b1bd965e`, Vercel READY `dpl_41q64UcNQtujrLJu8GNnNGCkSnWn`.
- 63 scoped tests pass; TypeScript/lint pass; local webpack production build passes. Normal Vercel production build passes. CI adherence gate run `41483970744` passed. The earlier PR355 reliability gate also passed. The existing local Turbopack symlink limitation was not hidden or worked around by starting a local server.
- Authenticated live overview reconciles 42/19/254/337. Date filtering via real keyboard input, stage/show filtering, rep navigation, evidence expansion and 390px responsive layout verified. Inherited filters survive rep navigation. Browser automation's synthetic date fill did not trigger React; actual keyboard input did and the filter recomputed correctly.
- Isolated source workflow `N4p6MUMGBcQyRwtH` and provider pilot `2xX5gVtc1BKlhyG3` are inactive; recent execution lists contain no unfinished own executions. No changes to official coaching/intake/recovery workflows, no Slack sends, no full-week backfill.

## Readiness boundary
This round is complete as an expanded, reviewed pilot and usable leadership dashboard. It is **not** an unattended all-company rollout. Twice-daily scheduling and complete one-week backfill remain off. Before broad processing, evaluate the revised prompts on a fresh untouched cohort and replace the pilot's bounded 2,000-row read with server-side filtering/aggregation and lazy call evidence. The current warning prevents silently presenting a truncated view as complete. Do not use pilot percentages as a company-wide estimate or claim zero false positives.

Private audit artifacts are under `.private-adherence/`: expanded source/transcript cohort, model request and receipt archives, directed findings, exact reviewed manifest, before/after published records and cost summaries. These contain private business evidence and are intentionally excluded from Git. Public code/docs hold aggregate findings and source IDs only.
