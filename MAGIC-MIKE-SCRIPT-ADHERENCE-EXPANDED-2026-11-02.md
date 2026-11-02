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
- Distinguish no-show, internal, incomplete recording, ineligible checklist and unavailable script.
- Explicit action definition and >=50% rule; unclear and inapplicable actions excluded from completion rates.
- Shared date-aware calculation for summary, rep rows, videos and individual actions.
- Paged call rendering (20 per page). Pilot read remains bounded at 2,000 saved rows and visibly reports truncation if reached; this is not a claim of complete all-company coverage.
- Auth before data on both routes; unavailable reads do not masquerade as zero calls.
- Provider dispatch permits only bounded Haiku or Terra standard-price requests, exact stored request hashes, atomic one-time claims, and separate reservation floors. Validates the whole request batch before claiming any item.
- Terra pricing based on official model documentation: https://developers.openai.com/api/docs/models/gpt-6.1-terra. Standard pricing and 30-minute cache writes only; unsupported billing configurations rejected.

## Evaluation and release status
In progress. No expanded results are accepted merely because they pass schema validation. The 30-call cohort excludes the previous 12 and uses Zoom closer membership, distinct meeting UUIDs, and three metadata sampling strata. Titles and stored stages select variety only; models must classify the actual transcript. Results, disagreements, costs and final verification will be recorded here before completion.

## Rollback
Revert this scoped PR to restore the prior UI/dispatch. Raw saved results and original pilot receipts are preserved. The source/pilot workflows remain isolated and are deactivated after bounded runs; official coaching is not edited.

## Follow-up verification and corrections
- UI PR355 merged as `41a4edd`; authenticated testing caught a percent-encoded rep route mismatch. PR356 (`ebed48a`) fixed exact name resolution. Live Tara drilldown now works with inherited show filter, call expansion, original transcript link and action evidence. Responsive overview checked at 390px and viewport restored.
- Both models classified the same 30 unseen transcripts: 26 legacy-workspace recordings and four main-workspace recordings, covering 20 reps. This is a deliberately varied bounded sample, not a random estimate of company-wide performance.
- First extraction pass: Haiku 11/14 structurally valid; three held (invalid evidence ID, required-action applicability, checklist shape). Terra 16/16 structurally valid. These are validation rates, NOT measured accuracy.
- Source review corrected an early-decline eligibility mistake, an initial audition with detailed pricing incorrectly treated as Call 2, and outbound voicemail taxonomy. Late disqualification after a substantive audition remains assessable. Network names are not show names. Unsupported Reality Call 2 and later Q&A remain visible without fabricated scripts.
- Fixed checklist/part keys and shared exact evidence-ID definitions prevent missing/extra components and fabricated references. An initial review attempt exceeded the provider's 1,000-enum schema limit; all 15 requests were rejected before generation, safely held and recorded at zero generation cost. Shared schema definitions fixed this without disabling strict output. Unknown transport errors retain budget reservations.
- The final directed review uses the complete transcript plus explicitly recorded source findings. It is a correction pass, not a blind accuracy benchmark. Raw model comparisons and rejected outputs remain in the private audit files.
