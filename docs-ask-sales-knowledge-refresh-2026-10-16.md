# Magic Mike FAQ knowledge refresh — October 16, 2026

Status: candidate; not yet published or a successful checkpoint.

Resumed from the October 14 successful checkpoint (`0492d8d294d53d729bc81946`, 2555 active records), preserving the October 15 retrieval/context release. Candidate `9c1ed0710f4d9b7e08415f1a`, 2563 active records: eight additions and nineteen amendments. Slack and Google sources were read only; no Slack messages or source edits.

## Knowledge changes

- Mandatory Day 1 training acknowledgment, weekday EOD training progress updates and a 10-day onboarding target. These are separate from retired non-DJ Slack sales stats. HubSpot access starts after the final mock is booked; this is not permission to take live calls before passing/approval.
- Call 1 rejection reasons belong in Reject Call Notes; no-shows may leave it blank or N/A with the correct meeting status. Call 2 uses Closing Call Notes. Daily own-call review still requires outbound stats if no Call 1/2, or Day Off when not working; removed one stale No calls summary.
- UK SMS is now enabled through HubSpot/Twilio, superseding US-only guidance. Cache clearing was the documented troubleshooting step. This does not establish universal international Zoom voice access, support for all countries, or universal delivery success.
- Missing Deal owner can prevent payment-link generation; Tech sets the correct owner. Preserve HubSpot-first/emergency fallback, signature and payment checks, and distinct bank/form/currency errors. No blanket bank-failure assumption.
- OnceHub existing-meeting Reschedule workflow, All Meetings for other dates, manual cancelled Meeting Status where needed, Tech-assisted duplicate cleanup and customer communication if calls overrun.
- Rich confirms three daily Green Lights is an average within fifteen weekly, not a hard daily maximum. Qualification and final approval remain required; exceeding the weekly allowance is not automatically authorized.
- Rudy confirms a $20,000 reality sit-down story interview. This supersedes any blanket no-interview-in-Standard interpretation, but does not resolve its duration or equivalence to the full 20–25-minute VIP documentary. Included mini-documentary filming is on site during reality and only on ISTV; preserve individually documented commitments for review and distinct reality-series distribution.
- Rudy's current promotional-disclosure examples distinguish general announcements from endorsements; the clause cannot be removed. Company examples are not replacement contract language or a universal legal-compliance certification.
- Reality between-call preparation email is separate from the post-sale welcome email. Thomas's updated Island/Jungle/Mansion application links are available. Medical-clearance questions point to the approved physical requirements and doctor review, with Mansion an alternative to consider rather than a safety guarantee.
- Season 2 spring/early-summer and 60-day guidance stays provisional. Unofficial Island teaser permission is screen-sharing only, not unapproved distribution. Prize expectations, public testimonials instead of private cast contacts, documentary-to-reality alternatives, current Offers listing and HubSpot outbound SOP are reconciled without promoting peer guesses into policy.

## Source coverage and limits

- Four maintained Slack channels: 175 new root messages and all 597 previously tracked roots revisited. 772 thread reads; 770 successful with pagination exhausted. Two unavailable threads retain previous watermarks.
- Metadata checked for 76 registered sources; 71 accessible Google Docs fetched. Six documents changed, including formatting-only changes. Two newly linked Docs read and added to the source map: the mandatory training acknowledgment and an individualized approval example retained as context, not general policy.
- Twelve bounded Sheet ranges across four workbooks reviewed. Three media-kit slides visually reviewed, without substantive changes. Three video-folder listings unchanged; no claim of retranscribing every historical recording.
- Two previously inaccessible Drive sources still return 404; older unavailable Rudy audio remains unavailable. Thomas's new Typeform links are supported by his announcement, but web extraction could not open their interactive contents; no application was filled/submitted.
- Coverage is the maintained source map and four maintained channels, not every private workspace conversation. Cutoffs are per channel and per thread; arrivals after those reads belong to the next refresh. Individual call reviews, customer details and peer speculation were not published as company policy.

## Verification

Eleven new retrieval/boundary tests cover the refresh. Two older tests were updated because they asserted the now-superseded US-only SMS restriction. The initial local suite had two legacy timing timeouts while other checks ran; no logic change was made for those timeouts. A second local run passed 416/417, with only the legacy ROI test exceeding its unchanged five-second timeout. Release CI remains required; the slow case is also checked separately with a larger invocation-only timeout. Static safety validator: 107/107.

18 isolated GPT-5.6 Luna medium answer checks completed with no provider failures, no retries and estimated API cost $0.1411246. Review: 17 acceptable, one useful between-call email answer with awkward wording linking non-purchase to unconfirmed Green Light approval. The knowledge explicitly separates completed actions and does not say purchase is required for Green Light; no prompt change or exact-question patch was added. This is not a claim of perfect or universal accuracy. The UK response correctly left account-specific international voice access unconfirmed, and the package response preserved the genuine full-documentary discrepancy.

## Release boundaries

Only FAQ knowledge, tests, paired registry and refresh documentation. Model, medium reasoning, prompts, retrieval, runtime, diagnostics, schema, auth, environment, Coaching and n8n remain unchanged. Production baseline `ab5657fb67c0a2cc5e1715bd3f9d0e03420d6b43`, deployment `dpl_2UnHJ2VspTQeiqEZA2ji8LLfyq4i`; preserve its unrelated durable coaching recovery release. A successful checkpoint and admin publication date will only be recorded after authenticated live verification.
