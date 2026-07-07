export type ApprovedFaqArticle = {
  id: string;
  title: string;
  category: string;
  riskLevel: "low" | "high";
  approvedBy: string;
  approvedAt: string;
  approvalReference: string;
  lastReviewed: string;
  body: string;
};

export type AskSalesFaqRule = {
  id: string;
  decision: "answer_from_approved_article" | "route_from_approved_article" | "abstain_unapproved" | "admin_only";
  article_id?: string;
  blocked_topic?: string;
  reason: string;
  match_any?: string[];
  match_all?: string[];
  match_any_groups?: string[][];
};

export const APPROVED_FAQ_ARTICLES: ApprovedFaqArticle[] = [
  {
    id: "americas-top-lawyers-passoff-boundary",
    title: "America's Top Lawyers Passoff Boundary",
    category: "Call Process & Scripts",
    riskLevel: "high",
    approvedBy: "Rich Allen and Mike Wisner",
    approvedAt: "2026-07-07",
    approvalReference: "2026-07-07 Rich/Mike meeting America's Top Lawyers passoff confirmation",
    lastReviewed: "2026-07-07",
    body: String.raw`## Answer

For America's Top Lawyers passoff / dummy-call handling, approved channel access is the control.

- If the rep is in the passoff channel or dummy-call channel, they can take the call because only approved people should be in those channels.
- Brand-new reps generally are not in those channels until approved, but do not hard-code "new rep cannot take it" if they already have approved channel access.
- For America's Top Lawyers, do not play the last part of Video 2 that mentions lawyers.

## What Reps Can Say

- "If you are in the passoff or dummy-call channel for this, that channel access is the approval control."
- "If you are not in the channel or are unsure, do not take it without checking the current passoff owner."
- "For America's Top Lawyers, do not play the final part of Video 2 that mentions lawyers."

## What Reps Must Not Say

- Do not tell a rep to take the call if they are not in the approved passoff/dummy-call channel.
- Do not say all new reps are blocked if the rep already has approved channel access.
- Do not play the lawyer-specific final portion of Video 2.
- Do not use this article as a general dummy-call/passoff SOP for other shows or no-show cases.

## Route If Unclear

Route to the current passoff / dummy-call owner if the rep is not in the channel, channel membership is unclear, the show is not America's Top Lawyers, or the question is about broader dummy-call/no-show/passoff procedure.`,
  },
  {
    id: "call-1-flow",
    title: "Call 1 Flow",
    category: "Call Process & Scripts",
    riskLevel: "high",
    approvedBy: "Rich Allen",
    approvedAt: "2026-07-03",
    approvalReference: "Slack screenshot supplied by user on 2026-07-03: Rich Allen confirmed Call 1 pricing boundary",
    lastReviewed: "2026-07-03",
    body: String.raw`## Answer

Default Call 1 pricing rule:

- Do not discuss pricing, packages, payment plans, discounts, deposits, or license PDFs on Call 1.
- Keep Call 1 focused on fit, qualification, discovery, and the current Call 1 script.
- Save pricing and closing mechanics for Call 2.

Narrow disqualification exception:

- If you are sure the prospect does not have a business and is not financially qualified, you may mention price on Call 1 only to disqualify them.
- Do not use that exception to pitch, close, negotiate, pre-sell, or create urgency on Call 1.
- If you are not sure whether both conditions are true, keep price for Call 2 and route to sales leadership if needed.

## What Reps Can Say

- "Normally, do not bring up price on Call 1. Keep price for Call 2."
- "If they clearly do not have a business and are not financially qualified, you can mention the investment only to disqualify them."
- "If you are unsure, do not quote pricing on Call 1. Route it to sales leadership."

## What reps MUST NOT say

- Do not pitch, close, negotiate, or pre-sell pricing on Call 1.
- Do not discuss payment plans, discounts, deposits, license PDFs, refunds, or contract/payment mechanics on Call 1.
- Do not use the disqualification exception unless both conditions are clear: no business and not financially qualified.
- Do not promise approval, platform results, views, ROI, or business outcomes.
- Do not invent qualification rules for sensitive edge cases.

## Escalation rule

If the pricing boundary is unclear in the moment, route to sales leadership before telling the prospect. Sensitive fit/compliance questions still route to the qualification/compliance owner.

## Pending Or Excluded

Phone-only Call 1s, interrupted calls, silent/off-camera applicants, reschedules, Call 1 after-hours, and sensitive qualification edge cases still need separate approved process wording before the bot gives direct instructions.`,
  },
  {
    id: "call-recording-storage-and-access",
    title: "Call Recording Storage And Access",
    category: "Sales Tech & Support Routing",
    riskLevel: "low",
    approvedBy: "Syed Moonis Haider",
    approvedAt: "2026-06-30",
    approvalReference: "FAQ Bot - Recommended Answers Pack 1 review status; user confirmation in chat on 2026-06-30",
    lastReviewed: "2026-06-30",
    body: String.raw`## Answer

Calls are automatically recorded by Zoom and stored on Zoom servers.

If someone needs access to a recording, they should use the Zoom recording link for that recording.

## What Reps Can Say

- "Calls are automatically recorded by Zoom and stored on Zoom servers."
- "Access is through the Zoom recording link for that recording."

## What Reps Must Not Do

- Do not share recording links externally unless sharing is approved and permissioned.
- Do not paste private recording links into the chatbot.
- Do not assume every rep has access to every recording.

## Route If Unclear

If the recording link is missing, access is denied, or sharing permissions are unclear, route to the current sales-tech/recording owner.`,
  },
  {
    id: "contracts-edits-and-signature-process",
    title: "Contracts, Edits And Signature Process",
    category: "Payments, Refunds & Contracts",
    riskLevel: "high",
    approvedBy: "Rich Allen and Mike Wisner",
    approvedAt: "2026-07-07",
    approvalReference: "2026-07-07 Rich/Mike meeting contract-link and no-edit boundary",
    lastReviewed: "2026-07-07",
    body: String.raw`## Answer

Reps can send the current contract link.

The contract is set. Reps should not edit contract terms, create addenda, rewrite clauses, promise custom language, or interpret legal terms.

If a client asks for contract edits, attorney review, custom language, a special addendum, entity-name changes, wrong amount/show/deliverable links, or legal interpretation, route to Rich / contracts / legal instead of handling it in the bot.

## What Reps Can Say

- "You can send the current contract link."
- "We do not make contract changes on the sales call. If they need something reviewed, route it to Rich / contracts / legal."
- "Do not promise edits or custom terms. Use the current link or route the issue."

## What reps MUST NOT say

- Do not edit or promise edits to contract terms.
- Do not use a nearby-looking contract/payment link when the amount, show, company, or deliverables do not match.
- Do not give legal interpretation of contract clauses.
- Do not promise attorney-review handling, special addenda, wet signatures, entity-name changes, or custom clauses from memory.

## Route If Unclear

Route to Rich / contracts / legal for:

- requested contract edits or addenda;
- attorney review;
- wrong contract amount, package, show, company, or deliverables;
- client asks for the full contract before payment and the current link/process is unclear;
- signature/payment order issues;
- any legal interpretation.`,
  },
  {
    id: "current-show-source",
    title: "Current Show Source",
    category: "Offers, Pricing & Packages",
    riskLevel: "high",
    approvedBy: "Syed Moonis Haider",
    approvedAt: "2026-06-30",
    approvalReference: "FAQ Bot - Recommended Answers Pack 1 review status; Luke Gent show-source note shared by user on 2026-06-30",
    lastReviewed: "2026-07-07",
    body: String.raw`## Answer

Use the latest approved show list below when a rep asks what shows we currently do.

The internal maintenance source for show changes is project operations, where new shows are added. Normal reps may not have access to that channel, so the bot should answer from this approved list and route only brand-new, paused, disputed, or missing-show status questions to the current sales/ops owner.

If a current show is missing from a dropdown or form, route to tech / the current sales-ops owner. Do not tell the rep to choose a placeholder or wrong show and fix it later.

## Latest Approved Show List

- Legacy Makers
- Women in Power
- Operation CEO
- America's Top Lawyers
- America's Best Doctors
- America's Top Trainers
- America's Top Agents
- Kingdom Creators
- Mompreneurs
- Couples of America
- Builders of America
- Legal Titans
- Life Changers
- Project Beauty
- Mindset Masters
- Love Experts
- Live Longer
- Americas Top Contractors
- Blue Collar America
- America's Authors
- America's Top Physicians
- Doctors of America
- Rise of Her
- Made It In America
- Wealth Makers
- Beyond Success
- American Founders
- Leading with Purpose
- Impact Makers TV
- Masters of Innovation

## What Reps Can Say

- "The latest approved show list I have is: Legacy Makers, Women in Power, Operation CEO, America's Top Lawyers, America's Best Doctors, America's Top Trainers, America's Top Agents, Kingdom Creators, Mompreneurs, Couples of America, Builders of America, Legal Titans, Life Changers, Project Beauty, Mindset Masters, Love Experts, Live Longer, Americas Top Contractors, Blue Collar America, America's Authors, America's Top Physicians, Doctors of America, Rise of Her, Made It In America, Wealth Makers, Beyond Success, American Founders, Leading with Purpose, Impact Makers TV, and Masters of Innovation."
- "If a show was just added, paused, missing from a form, or disputed, I need to confirm with the current sales/ops owner before giving a final answer."
- "If the show is missing from the dropdown or form, route it to tech / sales ops. Do not choose a placeholder show."

## What Reps Must Not Say

- Do not rely on old show lists, old dropdowns, old examples, or public pages as the final source.
- Do not tell reps to check project operations directly if they do not have access.
- Do not promise that a newly mentioned, paused, missing, or disputed show is active unless it is confirmed by the current sales/ops owner.
- Do not treat this list as permanently current after a new approved update supersedes it.
- Do not tell reps to choose the wrong show, a placeholder show, or a nearby-looking form value and fix it later.

## Route If Unclear

If a rep asks about a show that is not on this list, a show that may have just launched, a show that may be paused, or a show missing from a dropdown/form, route to the current sales/ops owner or tech instead of guessing.`,
  },
  {
    id: "events-mastermind-red-carpet",
    title: "Events, Mastermind, And Red-Carpet Terms",
    category: "Events & Access",
    riskLevel: "high",
    approvedBy: "Rich Allen and Mike Wisner",
    approvedAt: "2026-07-07",
    approvalReference: "2026-07-07 Rich/Mike meeting Mastermind access and fee confirmation",
    lastReviewed: "2026-07-07",
    body: String.raw`## Answer

Mastermind / red-carpet access is included in all packages under the current meeting-confirmed rule.

There is a $200 non-refundable fee to attend Mastermind. The fee is for food and drinks.

Event dates, venue details, logistics, travel, guest rules, and any current event changes can drift. Route those to the current event/source owner.

## What Reps Can Say

- "Mastermind / red-carpet access is included in all packages under the current rule."
- "There is a $200 non-refundable Mastermind attendance fee for food and drinks."
- "For dates, venue details, guest rules, or current logistics, confirm with the current event/source owner before promising anything."

## What Reps Must Not Say

- Do not quote old event dates, old venue details, old links, or old package/event posts as current.
- Do not waive or change the $200 fee.
- Do not promise travel, guests, venue access, filming access, refundability beyond this fee rule, or current logistics from memory.
- Do not use historical Slack posts or old source links as final answer authority.

## Route If Unclear

Route any time the question is about a specific upcoming event, date, hotel, travel, guest, venue, current event availability, or exception.`,
  },
  {
    id: "internal-material-sharing-boundaries",
    title: "Internal Material Sharing Boundaries",
    category: "Compliance, Proof & Claims",
    riskLevel: "high",
    approvedBy: "Syed Moonis Haider",
    approvedAt: "2026-06-30",
    approvalReference: "FAQ Bot - Recommended Answers Pack 1 review status; Syed approved internal/confidential material boundary",
    lastReviewed: "2026-07-07",
    body: String.raw`## Answer

Reps should not externally share internal materials unless explicitly approved.

This includes:

- internal Slack content
- payment details
- dashboards
- source docs
- confidential notes
- call recordings
- stats decks
- training videos
- internal sales materials

## What Reps Can Say

- "I need to check whether that material is approved to share externally."
- "I can share approved public-facing materials, but not internal docs or recordings unless they are explicitly approved."

## What Reps Must Not Do

- Do not send internal Slack screenshots or source-doc excerpts to prospects or clients.
- Do not share call recordings, private training videos, dashboards, confidential notes, payment details, or stats decks externally unless explicitly approved.
- Do not assume a file is shareable just because a rep can access it internally.

## Route If Unclear

If a prospect or client asks for material that looks internal, route to the source owner/compliance owner before sharing.

If a client wants a call recording, do not send it automatically. Treat call recordings as internal/private material unless external sharing is explicitly approved and permissioned.`,
  },
  {
    id: "istv-nlceo-pricing-and-same-day-discount",
    title: "ISTV, Next Level CEO Pricing, And Same-Day Discount",
    category: "Offers, Pricing & Packages",
    riskLevel: "high",
    approvedBy: "Syed Moonis Haider",
    approvedAt: "2026-06-30",
    approvalReference: "FAQ Bot - Recommended Answers Pack 1 review status; Magic Mike ISTV context pack reviewed by Syed",
    lastReviewed: "2026-07-03",
    body: String.raw`## Answer

Main ISTV program:

| Package | Price | Core deliverables |
| --- | ---: | --- |
| Lite | $12,000 | 12-15 minute episode, no pre-promo views, no Tier-1 submission, ISN app only |
| Standard | $20,000 | 16-20 minute episode, 100,000 pre-promo views, no Tier-1 submission, ISN app only |
| VIP / Premium | $30,000 | 20-25 minute episode, 150,000 pre-promo views, submitted to one Tier-1 platform, ISN app plus Tier-1 streaming app if accepted |

Main ISTV listed payment plans:

| Package | Listed plans |
| --- | --- |
| Lite | 4 x $3,000, 3 x $4,000, or 2 x $6,000 |
| Standard | 4 x $5,000 or 2 x $10,000 |
| VIP / Premium | 4 x $7,500, 3 x $10,000, or 2 x $15,000 |

Next Level CEO / Daymond John pricing and payment options:

| Package | PIF | Listed payment options |
| --- | ---: | --- |
| Lite | $10,000 | $2,500 x 4, $3,600 x 3, or $5,000 x 2 |
| Standard | $15,000 | $4,000 x 4, $5,000 x 3, or $7,500 x 2 |
| Premium VIP | $20,000 | $5,000 x 4, $7,000 x 3, or $10,000 x 2 |
| CEO Day upgrade | $5,000 | PIF only |

Same-day discount:

- The same-day discount applies only to the main ISTV program.
- It is $2,000 off the main ISTV program.
- It applies only from Call 2.
- The client must pay the initial deposit on the same calendar day as that Call 2.
- If Call 2 ends before payment but the client pays later that same calendar day, the same-day discount can still be honored.
- It does not apply to Next Level CEO / Daymond John.
- Do not carry the discount into the next day.

Main ISTV upgrade before filming:

- Main ISTV clients can upgrade before filming.
- After filming, it is too late to upgrade the package.
- If the client received the main ISTV $2,000 same-day discount, that discount carries forward to the upgraded main ISTV package.
- Discounted Standard total is $18,000.
- Discounted VIP/Premium total is $28,000.
- If the client bought discounted Lite at $10,000, the difference is $8,000 to Standard or $18,000 to VIP/Premium.
- Use the proper upgraded contract and payment-difference link through the current sales-tech or finance route. Do not create custom links manually.

## What Reps Can Say

- Use the listed package prices and listed payment plans above.
- For Next Level CEO / Daymond John, use only the listed PIF and split-payment options above.
- For same-day discount, keep the rule tied to main ISTV, Call 2, and same-calendar-day initial deposit payment.
- If a discounted main ISTV Lite client upgrades before filming, carry the $2,000 same-day discount forward to the upgraded main ISTV package and charge only the proper difference.

## What Reps Must Not Say

- Do not invent payment splits, custom amounts, special discounts, or exception terms.
- Do not apply the same-day discount to Next Level CEO / Daymond John.
- Do not promise the same-day discount if payment will happen after that calendar day.
- Do not carry the main ISTV same-day discount into any Next Level CEO / Daymond John package.
- Do not upgrade a client after filming.
- Do not create custom upgrade links or payment splits manually.
- Do not promise a second-show, crossover, VIP-to-VIP, or special discount unless a separate approved article covers that exact case.
- Do not quote old/spare pricing videos as current.

## Pending Or Excluded

The older Standard 3-payment split that totals $21,000 is intentionally not listed here. If someone asks about it, route to the current offer owner before quoting it.

Second-show, crossover, and special-discount rules remain pending Rich/owner confirmation.`,
  },
  {
    id: "main-istv-call-2-cohort-reschedule-rules",
    title: "Main ISTV Call 2 Cohort Reschedule Rules",
    category: "Greenlight, Cohorts & Deadlines",
    riskLevel: "high",
    approvedBy: "Rich Allen and Mike Wisner",
    approvedAt: "2026-07-07",
    approvalReference: "2026-07-07 Rich/Mike meeting plus user correction that cohort rules apply only to main ISTV shows",
    lastReviewed: "2026-07-07",
    body: String.raw`## Answer

For main ISTV shows only, the cohort week runs Monday through Sunday at 11:59 PM Eastern.

Call 2 reschedule rule for main ISTV:

- If Call 2 is rescheduled within the same cohort week, the rep can do it without Rich approval.
- If Call 2 is pushed into the following week / next cohort, it needs Rich approval.
- Exceptions considered for a next-cohort Call 2 are limited to a medical emergency with proof or a bank block / inability to pay with bank proof.
- In the bank-block exception, the contract should still be signed even if payment cannot go through yet.
- Call 1 can be rescheduled to the following week. The strict cohort approval rule is for Call 2.

This rule is not approved for Daymond John or Next Level CEO. Route DJ/NLCEO cohort or reschedule questions to the current sales owner.

## What Reps Can Say

- "For main ISTV, the cohort runs Monday through Sunday at 11:59 PM Eastern."
- "If Call 2 stays in the same cohort week, you can reschedule it without Rich approval."
- "If Call 2 moves to the next week, get Rich approval unless it is a documented medical emergency or bank block."
- "This cohort rule is for main ISTV only. Do not apply it to DJ or Next Level CEO."

## What Reps Must Not Say

- Do not apply the main ISTV cohort rule to Daymond John or Next Level CEO.
- Do not push Call 2 into the next cohort without Rich approval unless the approved proof exception applies.
- Do not create new exception categories beyond medical emergency proof or bank-block proof.
- Do not treat greenlight PDF caps, no-show/reapply rules, or other greenlight deadlines as covered by this article.

## Route If Unclear

Route to Rich / the current sales owner if the question involves DJ/NLCEO, proof quality, next-cohort exceptions, greenlight PDFs, no-shows, reapply timing, or a situation not explicitly covered above.`,
  },
  {
    id: "opt-out-dnc-and-security-escalation",
    title: "Opt-Out, DNC And Security Escalation",
    category: "Sales Tech & Support Routing",
    riskLevel: "high",
    approvedBy: "Rich Allen and Mike Wisner",
    approvedAt: "2026-07-07",
    approvalReference: "2026-07-07 Rich/Mike meeting and read-only SOP Google Doc 1lm6dWmMLUQJ83oegGZrTaA29c-rw4hJfkwTXQ4zx9Q4",
    lastReviewed: "2026-07-07",
    body: String.raw`## Answer

If a prospect, client, or lead says STOP, asks not to be contacted, opts out, or is already on the DNC list, stop normal outreach.

Use the official opt-out / DNC process:

- Send or use the official opt-out form where appropriate.
- Manually log the name, email, and phone in the Do Not Contact Google Sheet when the request is handled manually.
- Update Keap as Do Not Contact and Unsubscribed.
- Post the note in \`ft-opt-outs\`.
- Cancel any pending call if the person opted out before the call.
- Do not keep texting, calling, emailing, or joining the call to wait after a clear opt-out.

If the rep cannot message the person again from that same channel, do the internal DNC steps manually instead of contacting the person again.

Before sales outreach, check the DNC Google Sheet and Keap tags. If the person is on DNC or has Do Not Contact / Unsubscribed / Opted Out tags, do not contact them.

Security/privacy handling stays conservative: do not leave sensitive details in chat, Slack, notes, or local files. Route privacy or security incidents to the current security/compliance owner.

## What Reps Can Say

- "If they opted out or said STOP, do not continue outreach. Follow the DNC process before doing anything else."
- "Cancel the pending call if they opted out before the call."
- "If you cannot message them again to send the form, complete the internal DNC steps manually."
- "Check the DNC sheet and Keap before calling or following up."

## What Reps Must Not Do

- Do not ignore STOP, opt-out, DNC, unsubscribe, or "do not contact me" language.
- Do not keep texting, calling, emailing, or joining a scheduled call after a clear opt-out.
- Do not pull or work leads from Slack before checking DNC and Keap.
- Do not expose client PII, raw recording links, payment details, or account access details in chatbot answers.
- Do not troubleshoot security/privacy incidents beyond approved immediate containment steps.

## Route If Unclear

Route to the current compliance/security/sales-tech owner if:

- the opt-out request is ambiguous;
- a system cannot be updated;
- Keap, the DNC sheet, Sendinblue, or Intercom shows conflicting status;
- a booked person opted out but another team member is still contacting them;
- private payment, account, login, or recording details were exposed.

## Source Notes

The read-only SOP references Keap, the Do Not Contact Google Sheet, Sendinblue, Intercom, Slack \`ft-opt-outs\`, and the official opt-out Typeform. Access links and some automation ownership details were still commented in the source doc, so the bot should not invent exact admin access steps.`,
  },
  {
    id: "payment-plan-and-link-boundaries",
    title: "Payment Plan And Link Boundaries",
    category: "Payments, Refunds & Contracts",
    riskLevel: "high",
    approvedBy: "Syed Moonis Haider",
    approvedAt: "2026-06-30",
    approvalReference: "FAQ Bot - Recommended Answers Pack 1 review status; Magic Mike ISTV context pack reviewed by Syed",
    lastReviewed: "2026-07-07",
    body: String.raw`## Answer

Reps should use only current official payment links and listed payment plans.

Custom amounts, custom payment plans, custom payment links, wire/ACH/invoice exceptions, and other payment exceptions are not rep-approved decisions. They must be routed.

Reps should not collect raw card details directly from clients.

Failed payment boundary:

- Finance initially follows up on failed payments by calling, texting, and emailing a few times.
- If finance cannot get through, the casting manager or sales rep may need to help chase the client.
- Reps should track payment status, but the rep may not be the first person to know a payment failed.
- If the initial payment already went through, a later failed payment should not remove the same-day discount.
- If ACH is pending, do not treat the payment as confirmed until it clears through the current tech/finance process.

## What Reps Can Say

- "Use the current official payment link and the listed payment plan for that package."
- "If the client needs a custom amount, custom split, wire/ACH, invoice, or payment exception, I need to route that instead of making a promise."
- "If a later payment fails after the initial payment was already made, do not remove the same-day discount just because of that later failure."
- "Finance follows up first on failed payments. If they cannot reach the client, the casting manager or rep may need to help chase it."

## What Reps Must Not Do

- Do not create custom payment terms.
- Do not create or substitute payment links.
- Do not paste raw card numbers, bank details, payment details, or sensitive client financial information into Slack, the chatbot, notes, or local files.
- Do not tell a client that a wire/ACH/invoice/custom split is allowed unless the current approved route confirms it.
- Do not post PayMe / payment confirmation while ACH or another payment is still pending.
- Do not remove a same-day discount because a later scheduled payment failed after the initial payment was already made.

## Route If Unclear

Broken payment links, failed payments, card updates, wire/ACH confirmation, invoice requests, custom payment terms, and payment exceptions should be routed to the current finance/sales-tech route. The exact route still needs owner confirmation before the bot should name a specific person or channel.`,
  },
  {
    id: "platform-hosting-and-client-license-duration",
    title: "Platform Hosting And Client License Duration",
    category: "Content Rights & Usage",
    riskLevel: "high",
    approvedBy: "Syed Moonis Haider",
    approvedAt: "2026-06-30",
    approvalReference: "FAQ Bot - Recommended Answers Pack 1 review status; Magic Mike ISTV context pack reviewed by Syed",
    lastReviewed: "2026-06-30",
    body: String.raw`## Answer

The current duration wording is:

- ISTV platform hosting is 5 years.
- The client has lifetime license rights to their own episode/content.

Do not merge those two points. The client's license rights are lifetime, but ISTV platform hosting is not lifetime/permanent.

## What Reps Can Say

- "The episode is hosted on the ISTV platform for 5 years."
- "The client has lifetime license rights to their own episode/content."

## What Reps Must Not Say

- Do not say ISTV platform hosting is lifetime or permanent.
- Do not promise third-party platform availability beyond approved wording.
- Do not answer detailed usage-rights questions unless a separate approved rights article covers the exact use case.

## Route If Asked About Usage Details

Questions about full-episode posting, clips, trailers, ads, embedding, YouTube, third-party platforms, written consent, or product-specific content rights still need legal/contracts-approved wording. Route those instead of guessing.`,
  },
  {
    id: "platform-proof-and-claims-boundaries",
    title: "Platform, Proof, And Claims Boundaries",
    category: "Compliance, Proof & Claims",
    riskLevel: "high",
    approvedBy: "Syed Moonis Haider",
    approvedAt: "2026-06-30",
    approvalReference: "FAQ Bot - Recommended Answers Pack 1 review status; Magic Mike ISTV context pack reviewed by Syed",
    lastReviewed: "2026-07-07",
    body: String.raw`## Answer

Approved platform wording:

- All tiers air on the Inside Success Network app.
- The Inside Success Network app is accessible on Roku, Fire Stick, and Apple TV physical devices.
- This is not the Apple TV streaming app/channel and not the Amazon streaming app.
- VIP / Premium is submitted to one Tier-1 streaming platform: Amazon Prime Video, Apple TV streaming app, or Tubi.
- Tier-1 placement is a platform decision and is not guaranteed.
- ISTV does not work directly with Amazon or Apple. A third party helps with those submissions.
- Clients cannot pay extra to force or guarantee Apple TV streaming-app submission or placement.

Approved scam / bad-review objection boundary:

- Keep it short. Do not go down a long defense path.
- If the prospect truly believes it is a scam, it may not be for them.
- A brief clarification is allowed: many bad search results come from confusion with a separate UK company named Inside Success. Searching \`InsideSuccessTV\` points to the correct ISTV brand context.
- Reps can point to the correct ISTV review context and public proof that is currently approved to share, but must not over-argue or promise outcomes.

Approved value / vendor comparison boundary:

- Avoid perceived-value, vendor comparison, and cheaper-production arguments because they drift into ROI/value guarantees.
- Do not compare the cost of producing a show with another vendor as the reason the client should buy.

## What Reps Can Say

- "All tiers air on the Inside Success Network app."
- "VIP/Premium includes submission to one Tier-1 platform, but placement is not guaranteed because the platform decides."
- "If they are seeing bad reviews, briefly clarify whether they are looking at the separate UK company or ISTV. Search \`InsideSuccessTV\` for the correct brand context."
- "If they still feel this is a scam, this may not be the right fit for them."
- "Do not get into a vendor-cost or ROI comparison. Keep it to the approved platform and fit language."

## What Reps Must Not Say

- Do not guarantee Amazon, Apple TV streaming app, Tubi, or any other Tier-1 placement.
- Do not say a client can pay extra to guarantee Apple TV streaming-app submission or placement.
- Do not say ISTV works directly with Amazon or Apple.
- Do not promise ROI, revenue, leads, fundraising, PR outcomes, platform placement, views, demographics, celebrity outcomes, or guaranteed business results.
- Do not use unsupported public proof, old examples, screenshots, dashboards, or stats decks as proof.
- Do not argue at length with someone calling it a scam.
- Do not claim every bad review is fake or removed.
- Do not use vendor-production cost comparisons to justify the price.

## Route If Asked For Proof Links Or Claims

If the rep needs specific review links, press, episode examples, celebrity proof, view language, or approved public proof links, route to the approved proof/source owner until the current proof pack is approved.`,
  },
  {
    id: "post-sale-handoff-after-close",
    title: "Post-Sale Handoff After Close",
    category: "Call Process & Scripts",
    riskLevel: "high",
    approvedBy: "Rich Allen and Mike Wisner",
    approvedAt: "2026-07-07",
    approvalReference: "2026-07-07 Rich/Mike meeting post-sale handoff confirmation",
    lastReviewed: "2026-07-07",
    body: String.raw`## Answer

After a sale, follow the "How to close a sale" cheat sheet from onboarding.

Confirmed sales-side handoff steps:

- Close the call.
- Take payment.
- Get the contract signed.
- Review the onboarding email with the client.
- Send the onboarding email.
- Book the onboarding call for the next day.
- Confirm payment in the All Payments / PayMe process once payment is actually confirmed.

If waiting on ACH, do not post PayMe / payment confirmation until ACH clears through the current tech/finance process.

The studio executive team handles detailed onboarding-call questions. Reps should avoid overpromising fulfillment details.

## What Reps Can Say

- "After payment and signature, review and send the onboarding email and book the onboarding call for the next day."
- "Only confirm PayMe / All Payments after the payment is actually confirmed."
- "If ACH is pending, wait until it clears through the current tech/finance process."
- "Detailed onboarding questions are handled by the studio executive team on the onboarding call."

## What Reps Must Not Say

- Do not post payment confirmation while ACH or another payment method is still pending.
- Do not promise fulfillment details that belong to the studio executive / onboarding team.
- Do not skip contract signature or onboarding-call booking.
- Do not invent custom post-sale steps beyond the current cheat sheet.

## Route If Unclear

Route to the current sales/ops, finance, tech, or onboarding owner if payment has not cleared, the contract is not signed, ACH is pending, onboarding email details are missing, or the client asks detailed fulfillment questions.`,
  },
  {
    id: "qualification-and-show-fit-rubric",
    title: "Qualification And Show Fit Rubric",
    category: "Qualification & Show Fit",
    riskLevel: "high",
    approvedBy: "Rich Allen and Mike Wisner",
    approvedAt: "2026-07-07",
    approvalReference: "2026-07-07 Rich/Mike meeting qualification and background decisions",
    lastReviewed: "2026-07-07",
    body: String.raw`## Answer

Do not turn qualification into a hard yes/no from one old Slack example. Use these approved boundaries only, then route edge cases.

America's Best Doctors:

- A doctor can qualify even if they work in a hospital and do not own the practice.
- Do not disqualify a doctor just because they are employed by a hospital.
- Nurses do not qualify as doctors for America's Best Doctors.
- Physical therapists / physiotherapists are case-by-case. Route before promising fit.

General qualification:

- Look for a business, practice, platform, or story that can benefit from the episode.
- Consider whether the business or platform is mature enough, whether the story is compelling, whether the person fits the network, and whether they seem likely to be a reasonable client.
- Some legacy/story-led clients can be exceptions, so do not create a blanket "business owner only" rule across every show.

Background and reputation:

- Daymond John / Next Level CEO is stricter: generally reject criminal history except minor issues such as speeding or parking tickets.
- Main ISTV rejects serious red flags such as murder, pedophilia, sex-industry positioning, bank robbery, or gun crime.
- Cannabis and firearms can be acceptable when they are regulated, legal, licensed, and positioned professionally.
- Strong extremist political/religious positioning, racism, sexism, or similar reputational red flags should route and should not be approved by the bot.
- Motivational speakers and personal brands can qualify when they are otherwise a fit and not in a disallowed category.

## What Reps Can Say

- "A doctor does not have to own the practice to be considered for America's Best Doctors."
- "If they are a doctor working in a hospital, do not disqualify them just for that."
- "A nurse is not the same as a doctor for America's Best Doctors."
- "For physical therapists, unusual medical roles, background issues, or reputational red flags, route it before promising fit."

## What reps MUST NOT say

- Do not guarantee acceptance or disqualification for sensitive edge cases unless the approved rubric directly covers the case.
- Do not use another prospect's Slack case as precedent.
- Do not make legal, medical, criminal, licensing, or reputational determinations from memory.
- Do not say America's Best Doctors requires practice ownership.
- Do not apply main ISTV flexibility to Daymond John / Next Level CEO background cases.

## Route If Unclear

Route to sales leadership/compliance when the case involves:

- physical therapists / physiotherapists or unusual medical roles;
- criminal, legal, licensing, reputation, adult/sexual, political, religious, racism/sexism, firearms, cannabis, minors, or other sensitive background concerns;
- uncertainty about whether the applicant has a business/platform/story that fits the show;
- show-specific exceptions not listed above.`,
  },
  {
    id: "refund-rules-by-product",
    title: "Refund Rules By Product",
    category: "Payments, Refunds & Contracts",
    riskLevel: "high",
    approvedBy: "Syed Moonis Haider",
    approvedAt: "2026-06-30",
    approvalReference: "FAQ Bot - Recommended Answers Pack 1 review status; Syed approved context-pack refund split",
    lastReviewed: "2026-06-30",
    body: String.raw`## Answer

Current refund rule by product:

| Product / show type | Current refund rule |
| --- | --- |
| Next Level CEO / Daymond John | 3-day refund window |
| Main ISTV program and other shows | No refund offer and no refunds |

## What Reps Can Say

- "For Next Level CEO / Daymond John, the current refund window is 3 days."
- "For ISTV/main-program shows and other shows, there is no refund offer and no refunds."

## What Reps Must Not Say

- Do not promise a refund, cancellation, payment pause, chargeback outcome, or exception.
- Do not negotiate exceptions from memory or based on another client's case.
- Do not quote contract/legal terms unless the approved contract article covers the exact question.

## Route If Asked About Exceptions

If the question involves a refund exception, cancellation exception, failed-payment proof, duplicate charge, emergency proof, payment pause, paid-but-not-signed case, or contract/legal interpretation, do not answer directly. Route to the current finance/legal/sales owner.`,
  },
  {
    id: "twenty-percent-dial-out-sop",
    title: "20 Percent Dial-Out SOP",
    category: "20 Percent Outbound",
    riskLevel: "high",
    approvedBy: "Rich Allen and Mike Wisner",
    approvedAt: "2026-07-07",
    approvalReference: "2026-07-07 Rich/Mike meeting lead-ownership confirmation",
    lastReviewed: "2026-07-07",
    body: String.raw`## Answer

The 20 percent rule is a commission rule. It does not let reps ignore lead ownership, Keap assignment, or DNC checks.

Before dialing a 20 percent lead:

- Check Keap first.
- If the lead is assigned to another rep, do not dial it.
- Check DNC / opt-out status before contacting.
- Keep Keap notes current.

Lead ownership:

- First booking wins if the same person is booked with two reps or shows.
- A rep has a 30-day ownership window from the time they communicate with the lead and log the communication in Keap.
- Every new contact / logged note refreshes the 30-day window.
- After 31 days without contact, another rep can speak with the lead.

## What Reps Can Say

- "Check Keap before dialing. If another rep owns or is assigned to the lead, do not call it."
- "The ownership window is 30 days from a logged communication in Keap, and each new logged contact refreshes it."
- "After 31 days with no contact, another rep can speak with the lead."
- "If the same person is booked twice, the first booking wins."

## What Reps Must Not Do

- Do not tell reps to call/text outside approved hours.
- Do not bypass DNC/opt-out rules.
- Do not dial leads assigned to another rep.
- Do not claim ownership just by seeing a lead in Slack if Keap and notes do not support it.
- Do not hoard leads or work more leads than can be kept updated properly.

## Route If Unclear

Route to the current 20 percent / sales owner if:

- Keap has conflicting notes or assignments;
- a lead has duplicate records;
- a lead opted out or may be on DNC;
- two reps dispute ownership beyond the first-booking rule;
- the question is about list size, daily limits, or reporting requirements not covered above.`,
  },
];

export const ASK_SALES_FAQ_POLICY_RULES: {
  defaultDecision: {
    decision: "abstain_unapproved";
    reason: string;
  };
  adminOnlyRules: AskSalesFaqRule[];
  abstainRules: AskSalesFaqRule[];
  routeRules: AskSalesFaqRule[];
  answerRules: AskSalesFaqRule[];
} = {
  defaultDecision: {
    decision: "abstain_unapproved",
    reason: "No approved policy rule matched. Do not answer from retrieval alone.",
  },
  adminOnlyRules: [
    {
      id: "admin-rule-update-channel-watch",
      decision: "admin_only",
      article_id: "current-sales-rule-update-channels",
      reason: "Update-channel governance is approved for admin/maintenance use only.",
      match_any_groups: [
        [
          "knowledge system",
          "sales rule",
          "rule changes"
        ],
        [
          "watch",
          "slack channels"
        ]
      ],
    },
    {
      id: "admin-rule-no-raw-slack-auto-approval",
      decision: "admin_only",
      article_id: "current-sales-rule-update-channels",
      reason: "Raw Slack may signal changes, but it cannot bypass article approval.",
      match_any_groups: [
        [
          "slack post",
          "raw slack",
          "slack"
        ],
        [
          "update the kb",
          "automatically",
          "without approval"
        ]
      ],
    },
  ],
  abstainRules: [
    {
      id: "abstain-greenlight",
      decision: "abstain_unapproved",
      blocked_topic: "greenlight-pdf-and-cohort-deadlines",
      reason: "Greenlight caps, PDF timing, no-shows, and reapply rules are not approved. Main ISTV Call 2 cohort reschedules have a separate approved article.",
      match_any_groups: [
        [
          "greenlight",
          "approval cap",
          "reapply",
          "no show",
          "no-show",
          "greenlight pdf",
          "approval pdf",
          "pdf send",
          "approval letter"
        ],
        [
          "cap",
          "approval cap",
          "reapply",
          "no show",
          "no-show",
          "pdf",
          "approval letter",
          "greenlight pdf"
        ]
      ],
    },
    {
      id: "abstain-sales-tech-routing",
      decision: "abstain_unapproved",
      blocked_topic: "sales-tech-routing-and-support-requests",
      reason: "Sales-tech Slack vs ticket-desk routing is not confirmed.",
      match_any_groups: [
        [
          "sales-tech",
          "sales tech"
        ],
        [
          "ticket desk",
          "slack"
        ]
      ],
    },
    {
      id: "abstain-calendar-routing",
      decision: "abstain_unapproved",
      blocked_topic: "calendars-recordings-and-zoom-phone",
      reason: "Calendar/rebooking routing is not approved.",
      match_any_groups: [
        [
          "calendar"
        ],
        [
          "rebooking",
          "link",
          "oncehub"
        ]
      ],
    },
    {
      id: "abstain-zoom-phone",
      decision: "abstain_unapproved",
      blocked_topic: "calendars-recordings-and-zoom-phone",
      reason: "Zoom Phone troubleshooting is not approved.",
      match_any: [
        "zoom phone",
        "caller id"
      ],
    },
    {
      id: "abstain-new-rep-onboarding",
      decision: "abstain_unapproved",
      blocked_topic: "new-rep-onboarding-and-final-mock",
      reason: "New-rep onboarding and final mock requirements are not approved for runtime answers.",
      match_any: [
        "new reps",
        "final mock",
        "new rep"
      ],
    },
  ],
  routeRules: [
    {
      id: "route-current-show-status",
      decision: "route_from_approved_article",
      article_id: "current-show-source",
      reason: "Current show status can drift; answer from the approved list and route newly added, paused, disputed, or missing-show cases to the current sales/ops owner.",
      match_any: [
        "is love experts active",
        "currently active",
        "active right now",
        "missing from the dropdown",
        "missing from dropdown",
        "show dropdown",
        "missing from the form",
        "paused"
      ],
    },
    {
      id: "route-stale-standard-split",
      decision: "route_from_approved_article",
      article_id: "istv-nlceo-pricing-and-same-day-discount",
      reason: "The old Standard 3 x $7,000 split is intentionally excluded from approved terms.",
      match_any: [
        "3 payments of $7,000",
        "3 payments of 7000",
        "standard as 3 payments",
        "$21,000"
      ],
    },
    {
      id: "route-special-discounts",
      decision: "route_from_approved_article",
      article_id: "istv-nlceo-pricing-and-same-day-discount",
      reason: "Second-show, crossover, and special discounts remain pending Rich/owner confirmation.",
      match_any: [
        "second-show",
        "second show",
        "crossover discount",
        "special discount"
      ],
    },
    {
      id: "route-refund-exceptions",
      decision: "route_from_approved_article",
      article_id: "refund-rules-by-product",
      reason: "Refund/payment exceptions must route to the current owner.",
      match_any: [
        "paid but did not sign",
        "duplicate charge",
        "card was charged",
        "charged twice"
      ],
    },
    {
      id: "route-wire-ach",
      decision: "route_from_approved_article",
      article_id: "payment-plan-and-link-boundaries",
      reason: "Wire/ACH/invoice exceptions are not rep-approved direct answers.",
      match_any: [
        "wire",
        "ach",
        "invoice"
      ],
    },
    {
      id: "route-broken-payment-link",
      decision: "route_from_approved_article",
      article_id: "payment-plan-and-link-boundaries",
      reason: "Broken payment links route to the current finance/sales-tech route.",
      match_any: [
        "payment link is broken",
        "broken payment link",
        "link is broken"
      ],
    },
    {
      id: "route-proof-links",
      decision: "route_from_approved_article",
      article_id: "platform-proof-and-claims-boundaries",
      reason: "Specific proof links and shareable proof assets still need the current approved source-owner material.",
      match_any: [
        "public proof",
        "proof links",
        "reviews and press",
        "episode examples",
        "celebrity proof",
        "specific review links",
        "approved public proof links"
      ],
    },
    {
      id: "route-client-recording-share",
      decision: "route_from_approved_article",
      article_id: "internal-material-sharing-boundaries",
      reason: "External sharing of call recordings needs explicit approval.",
      match_any_groups: [
        [
          "call recording",
          "recording"
        ],
        [
          "client wants",
          "send"
        ]
      ],
    },
    {
      id: "route-content-usage-details",
      decision: "route_from_approved_article",
      article_id: "platform-hosting-and-client-license-duration",
      reason: "Detailed content usage rights need legal/contracts-approved wording.",
      match_any: [
        "upload the full episode",
        "youtube",
        "run ads",
        "clips",
        "trailer"
      ],
    },
    {
      id: "route-recording-access-issue",
      decision: "route_from_approved_article",
      article_id: "call-recording-storage-and-access",
      reason: "Missing or denied recording access routes to the recording owner.",
      match_any: [
        "recording link is missing",
        "do not have access",
        "access denied",
        "missing recording link"
      ],
    },
    {
      id: "route-contract-exceptions",
      decision: "route_from_approved_article",
      article_id: "contracts-edits-and-signature-process",
      reason: "Contract edits and legal-review exceptions can use the approved no-edit boundary, but still require routing for the exception.",
      match_any: [
        "edit contract",
        "contract language",
        "addendum",
        "attorney review",
        "full contract before payment",
        "contract link wrong",
        "wrong contract link",
        "entity name",
        "legal review",
        "custom contract"
      ],
    },
    {
      id: "route-dj-nlceo-cohort-scope",
      decision: "route_from_approved_article",
      article_id: "main-istv-call-2-cohort-reschedule-rules",
      reason: "Main ISTV cohort rules are explicitly not approved for Daymond John or Next Level CEO.",
      match_any_groups: [
        [
          "daymond john",
          "next level ceo",
          "dj",
          "nlceo"
        ],
        [
          "cohort",
          "reschedule",
          "next week",
          "same week"
        ]
      ],
    },
  ],
  answerRules: [
    {
      id: "answer-security-privacy-containment",
      decision: "answer_from_approved_article",
      article_id: "opt-out-dnc-and-security-escalation",
      reason: "Approved opt-out/DNC article includes conservative security/privacy containment for exposed sensitive details.",
      match_any_groups: [
        [
          "pasted",
          "accidentally",
          "exposed",
          "shared"
        ],
        [
          "payment details",
          "card details",
          "client payment",
          "sensitive details",
          "account access",
          "recording link"
        ]
      ],
    },
    {
      id: "answer-opt-out-dnc",
      decision: "answer_from_approved_article",
      article_id: "opt-out-dnc-and-security-escalation",
      reason: "Approved opt-out/DNC article covers STOP replies, DNC checks, call cancellation, and immediate privacy/security routing.",
      match_any: [
        "replied stop",
        "reply stop",
        "keep texting",
        "booked a call",
        "opted out",
        "opt out",
        "do not contact",
        "dnc",
        "unsubscribe",
        "ft-opt-outs",
        "stop contacting me"
      ],
    },
    {
      id: "answer-outbound-20-percent",
      decision: "answer_from_approved_article",
      article_id: "twenty-percent-dial-out-sop",
      reason: "Approved 20 percent article covers Keap check, 30-day ownership, first-booking rule, and reassignment boundary.",
      match_any_groups: [
        [
          "20 percent",
          "20%"
        ],
        [
          "lead",
          "leads",
          "claim",
          "ownership",
          "keap",
          "dial",
          "assigned",
          "commenting",
          "booked"
        ]
      ],
    },
    {
      id: "answer-qualification-show-fit",
      decision: "answer_from_approved_article",
      article_id: "qualification-and-show-fit-rubric",
      reason: "Approved qualification article covers doctors/hospital employment, nurses, regulated categories, and route boundaries for sensitive fit cases.",
      match_any: [
        "america's best doctors",
        "americas best doctors",
        "best doctors",
        "doctor work in a hospital",
        "doctor working in a hospital",
        "own the medical practice",
        "own the practice",
        "nurse",
        "physical therapist",
        "physio",
        "criminal history",
        "cannabis",
        "adult content",
        "political business",
        "firearms",
        "motivational speaker",
        "personal brand",
        "background issue",
        "gun crime"
      ],
    },
    {
      id: "answer-contract-link-boundary",
      decision: "answer_from_approved_article",
      article_id: "contracts-edits-and-signature-process",
      reason: "Approved contract article covers sending current contract links and the no-edit boundary.",
      match_any: [
        "send the contract link",
        "send contract link",
        "current contract link",
        "can i send the contract",
        "contract is set",
        "contract terms"
      ],
    },
    {
      id: "answer-main-istv-call-2-cohort",
      decision: "answer_from_approved_article",
      article_id: "main-istv-call-2-cohort-reschedule-rules",
      reason: "Approved main ISTV cohort article covers same-week Call 2 reschedules, next-week approval, and proof exceptions.",
      match_any_groups: [
        [
          "call 2",
          "call two"
        ],
        [
          "cohort",
          "reschedule",
          "next week",
          "same week",
          "medical emergency",
          "bank block",
          "bank proof"
        ]
      ],
    },
    {
      id: "answer-payment-failed-boundary",
      decision: "answer_from_approved_article",
      article_id: "payment-plan-and-link-boundaries",
      reason: "Approved payment article covers failed-payment follow-up boundary and same-day discount carry-forward after initial payment.",
      match_any: [
        "failed payment",
        "payment failed",
        "payment fails",
        "card declined",
        "later payment failed",
        "finance follow up",
        "ach pending",
        "payme confirmation",
        "post payme",
        "all payments"
      ],
    },
    {
      id: "answer-events-mastermind",
      decision: "answer_from_approved_article",
      article_id: "events-mastermind-red-carpet",
      reason: "Approved event article covers package access and the $200 non-refundable Mastermind food/drink fee while routing logistics.",
      match_any: [
        "mastermind",
        "red carpet",
        "event fee",
        "red-carpet",
        "food and drinks",
        "non-refundable fee"
      ],
    },
    {
      id: "answer-post-sale-handoff",
      decision: "answer_from_approved_article",
      article_id: "post-sale-handoff-after-close",
      reason: "Approved post-sale article covers payment, signature, onboarding email, onboarding call, PayMe, and ACH boundary.",
      match_any_groups: [
        [
          "handoff",
          "onboarding",
          "welcome",
          "payme confirmation",
          "post payme",
          "all payments"
        ],
        [
          "payment",
          "signature",
          "contract",
          "close",
          "sale",
          "ach"
        ]
      ],
    },
    {
      id: "answer-americas-top-lawyers-passoff",
      decision: "answer_from_approved_article",
      article_id: "americas-top-lawyers-passoff-boundary",
      reason: "Approved Top Lawyers article covers passoff/dummy-channel approval and Video 2 boundary.",
      match_any: [
        "america's top lawyers",
        "americas top lawyers",
        "top lawyers",
        "lawyer calls",
        "lawyers calls",
        "passoff channel",
        "dummy-call channel",
        "dummy call channel",
        "video 2 lawyers"
      ],
    },
    {
      id: "answer-scam-bad-reviews",
      decision: "answer_from_approved_article",
      article_id: "platform-proof-and-claims-boundaries",
      reason: "Approved platform/proof article covers brief scam/bad-review objection wording and UK name-confusion context.",
      match_any: [
        "bad reviews",
        "scam",
        "pay to play",
        "trustpilot",
        "glassdoor",
        "reddit",
        "inside success uk",
        "insidesuccesstv",
        "inside success tv reviews"
      ],
    },
    {
      id: "answer-vendor-value-boundary",
      decision: "answer_from_approved_article",
      article_id: "platform-proof-and-claims-boundaries",
      reason: "Approved platform/proof article covers vendor/value/ROI comparison boundaries.",
      match_any: [
        "vendor comparison",
        "cheaper production",
        "cost to produce",
        "perceived value",
        "value comparison",
        "roi",
        "leads or roi",
        "business results"
      ],
    },
    {
      id: "answer-apple-tv-extra-boundary",
      decision: "answer_from_approved_article",
      article_id: "platform-proof-and-claims-boundaries",
      reason: "Approved platform/proof article covers no guaranteed Apple TV streaming-app placement or paid extra submission.",
      match_any: [
        "pay extra for apple tv",
        "extra apple tv",
        "apple tv submission",
        "guarantee apple tv",
        "apple tv streaming app"
      ],
    },
    {
      id: "answer-call-1-pricing-boundary",
      decision: "answer_from_approved_article",
      article_id: "call-1-flow",
      reason: "Approved Call 1 article covers the default no-pricing rule and the narrow disqualification exception confirmed by Rich.",
      match_any_groups: [
        [
          "call 1"
        ],
        [
          "pricing",
          "investment",
          "price",
          "cost",
          "$20,000",
          "$20000",
          "payment plan",
          "discount"
        ]
      ],
    },
    {
      id: "answer-current-show-source",
      decision: "answer_from_approved_article",
      article_id: "current-show-source",
      reason: "Approved article answers the latest approved show list and where updates are maintained.",
      match_any: [
        "current active show list",
        "current show list",
        "active show list",
        "where should i check",
        "all tv shows",
        "list of all tv shows",
        "tv shows that we do",
        "shows that we do",
        "what shows do we do",
        "list all shows",
        "all shows we do"
      ],
    },
    {
      id: "answer-refund-split",
      decision: "answer_from_approved_article",
      article_id: "refund-rules-by-product",
      reason: "Approved refund article covers current refund split by product.",
      match_any: [
        "refund window",
        "refund policy",
        "refund rules",
        "refunds",
        "get refunds",
        "istv clients get a refund",
        "clients get a refund",
        "main istv refund",
        "next level ceo refund",
        "daymond john refund"
      ],
    },
    {
      id: "answer-platform-and-claims",
      decision: "answer_from_approved_article",
      article_id: "platform-proof-and-claims-boundaries",
      reason: "Approved platform/proof article covers platform wording and banned claims.",
      match_any: [
        "where do all tiers air",
        "isn app",
        "apple tv",
        "amazon prime",
        "tier-1 placement",
        "tier 1 placement",
        "tier-1 guaranteed",
        "tier 1 guaranteed",
        "placement guaranteed",
        "work directly with amazon",
        "work directly with apple",
        "leads or roi",
        "roi",
        "business results"
      ],
    },
    {
      id: "answer-pricing-and-same-day-discount",
      decision: "answer_from_approved_article",
      article_id: "istv-nlceo-pricing-and-same-day-discount",
      reason: "Approved pricing article covers ISTV, NLCEO, and same-day discount boundaries.",
      match_any: [
        "lite istv",
        "standard istv",
        "premium istv",
        "vip or premium istv",
        "current istv prices",
        "istv prices",
        "istv pricing",
        "current packages and prices",
        "package prices",
        "payment plans",
        "price and payment plans",
        "next level ceo",
        "daymond john",
        "dj",
        "same day discount",
        "upgrade",
        "before filming",
        "after filming"
      ],
    },
    {
      id: "answer-payment-boundaries",
      decision: "answer_from_approved_article",
      article_id: "payment-plan-and-link-boundaries",
      reason: "Approved payment article covers custom-plan/link/card-detail boundaries.",
      match_any: [
        "payment link",
        "official payment link",
        "which payment link",
        "what payment link",
        "payment methods",
        "custom payment plan",
        "custom payment link",
        "different amount",
        "card details",
        "card number",
        "raw card",
        "client card",
        "paste it in slack"
      ],
    },
    {
      id: "answer-internal-materials",
      decision: "answer_from_approved_article",
      article_id: "internal-material-sharing-boundaries",
      reason: "Approved internal-material article covers external sharing boundaries.",
      match_any: [
        "internal slack screenshot",
        "slack screenshot",
        "share internal docs",
        "internal docs",
        "share internal",
        "training video",
        "internal materials"
      ],
    },
    {
      id: "answer-platform-hosting-duration",
      decision: "answer_from_approved_article",
      article_id: "platform-hosting-and-client-license-duration",
      reason: "Approved content-rights article covers platform hosting and license duration.",
      match_any: [
        "hosted on the istv platform",
        "how long is content hosted",
        "content hosted",
        "how long can clients use",
        "use their episode",
        "client use their episode",
        "license rights",
        "license duration",
        "content rights",
        "episode stays on istv forever",
        "stays on istv forever"
      ],
    },
    {
      id: "answer-recording-storage",
      decision: "answer_from_approved_article",
      article_id: "call-recording-storage-and-access",
      reason: "Approved recording article covers automatic Zoom recording and access via recording link.",
      match_any: [
        "recorded automatically",
        "access a call recording",
        "sales calls recorded",
        "call recordings stored",
        "recordings stored",
        "where are call recordings",
        "zoom recordings",
        "access zoom recordings"
      ],
    },
  ],
};

export const ASK_SALES_FAQ_BUNDLE_META = {
  schemaVersion: 1,
  generatedFrom: "Inside-Success/faq-chatbot@cf45873",
  generatedAt: "2026-07-07",
  approvedArticleCount: APPROVED_FAQ_ARTICLES.length,
};
