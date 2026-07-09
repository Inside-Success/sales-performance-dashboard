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
    "id": "americas-top-lawyers-passoff-boundary",
    "title": "America's Top Lawyers Passoff Boundary",
    "category": "Call Process & Scripts",
    "riskLevel": "high",
    "approvedBy": "Rich Allen and Mike Wisner",
    "approvedAt": "2026-07-07",
    "approvalReference": "2026-07-07 Rich/Mike meeting America's Top Lawyers passoff confirmation",
    "lastReviewed": "2026-07-07",
    "body": "## Answer\n\nFor America's Top Lawyers passoff / dummy-call handling, approved channel access is the control.\n\n- If the rep is in the passoff channel or dummy-call channel, they can take the call because only approved people should be in those channels.\n- Brand-new reps generally are not in those channels until approved, but do not hard-code \"new rep cannot take it\" if they already have approved channel access.\n- For America's Top Lawyers, do not play the last part of Video 2 that mentions lawyers.\n\n## What Reps Can Say\n\n- \"If you are in the passoff or dummy-call channel for this, that channel access is the approval control.\"\n- \"If you are not in the channel or are unsure, do not take it without checking the current passoff owner.\"\n- \"For America's Top Lawyers, do not play the final part of Video 2 that mentions lawyers.\"\n\n## What Reps Must Not Say\n\n- Do not tell a rep to take the call if they are not in the approved passoff/dummy-call channel.\n- Do not say all new reps are blocked if the rep already has approved channel access.\n- Do not play the lawyer-specific final portion of Video 2.\n- Do not use this article as a general dummy-call/passoff SOP for other shows or no-show cases.\n\n## Route If Unclear\n\nRoute to the current passoff / dummy-call owner if the rep is not in the channel, channel membership is unclear, the show is not America's Top Lawyers, or the question is about broader dummy-call/no-show/passoff procedure."
  },
  {
    "id": "call-1-flow",
    "title": "Call 1 Flow",
    "category": "Call Process & Scripts",
    "riskLevel": "high",
    "approvedBy": "Rich Allen",
    "approvedAt": "2026-07-03",
    "approvalReference": "Slack screenshot supplied by user on 2026-07-03: Rich Allen confirmed Call 1 pricing boundary",
    "lastReviewed": "2026-07-03",
    "body": "## Answer\n\nDefault Call 1 pricing rule:\n\n- Do not discuss pricing, packages, payment plans, discounts, deposits, or license PDFs on Call 1.\n- Keep Call 1 focused on fit, qualification, discovery, and the current Call 1 script.\n- Save pricing and closing mechanics for Call 2.\n\nNarrow disqualification exception:\n\n- If you are sure the prospect does not have a business and is not financially qualified, you may mention price on Call 1 only to disqualify them.\n- Do not use that exception to pitch, close, negotiate, pre-sell, or create urgency on Call 1.\n- If you are not sure whether both conditions are true, keep price for Call 2 and route to sales leadership if needed.\n\n## What Reps Can Say\n\n- \"Normally, do not bring up price on Call 1. Keep price for Call 2.\"\n- \"If they clearly do not have a business and are not financially qualified, you can mention the investment only to disqualify them.\"\n- \"If you are unsure, do not quote pricing on Call 1. Route it to sales leadership.\"\n\n## What reps MUST NOT say\n\n- Do not pitch, close, negotiate, or pre-sell pricing on Call 1.\n- Do not discuss payment plans, discounts, deposits, license PDFs, refunds, or contract/payment mechanics on Call 1.\n- Do not use the disqualification exception unless both conditions are clear: no business and not financially qualified.\n- Do not promise approval, platform results, views, ROI, or business outcomes.\n- Do not invent qualification rules for sensitive edge cases.\n\n## Escalation rule\n\nIf the pricing boundary is unclear in the moment, route to sales leadership before telling the prospect. Sensitive fit/compliance questions still route to the qualification/compliance owner.\n\n## Pending Or Excluded\n\nPhone-only Call 1s, interrupted calls, silent/off-camera applicants, reschedules, Call 1 after-hours, and sensitive qualification edge cases still need separate approved process wording before the bot gives direct instructions."
  },
  {
    "id": "call-recording-storage-and-access",
    "title": "Call Recording Storage And Access",
    "category": "Sales Tech & Support Routing",
    "riskLevel": "low",
    "approvedBy": "Syed Moonis Haider",
    "approvedAt": "2026-06-30",
    "approvalReference": "FAQ Bot - Recommended Answers Pack 1 review status; user confirmation in chat on 2026-06-30",
    "lastReviewed": "2026-06-30",
    "body": "## Answer\n\nCalls are automatically recorded by Zoom and stored on Zoom servers.\n\nIf someone needs access to a recording, they should use the Zoom recording link for that recording.\n\n## What Reps Can Say\n\n- \"Calls are automatically recorded by Zoom and stored on Zoom servers.\"\n- \"Access is through the Zoom recording link for that recording.\"\n\n## What Reps Must Not Do\n\n- Do not share recording links externally unless sharing is approved and permissioned.\n- Do not paste private recording links into the chatbot.\n- Do not assume every rep has access to every recording.\n\n## Route If Unclear\n\nIf the recording link is missing, access is denied, or sharing permissions are unclear, route to the current sales-tech/recording owner."
  },
  {
    "id": "contracts-edits-and-signature-process",
    "title": "Contracts, Edits And Signature Process",
    "category": "Payments, Refunds & Contracts",
    "riskLevel": "high",
    "approvedBy": "Rich Allen and Mike Wisner",
    "approvedAt": "2026-07-07",
    "approvalReference": "2026-07-07 Rich/Mike meeting contract-link and no-edit boundary; Madeline Cary Slack reply on sending contracts before Call 2 reviewed 2026-07-09",
    "lastReviewed": "2026-07-09",
    "body": "## Answer\n\nReps can send the current contract link.\n\nReps can send the contract before Call 2, but it is not advised. The normal sales process should still keep contract/payment mechanics for the proper close flow unless leadership approves a specific exception.\n\nThe contract is set. Reps should not edit contract terms, create addenda, rewrite clauses, promise custom language, or interpret legal terms.\n\nIf a client asks for contract edits, attorney review, custom language, a special addendum, entity-name changes, wrong amount/show/deliverable links, or legal interpretation, route to Rich / contracts / legal instead of handling it in the bot.\n\n## What Reps Can Say\n\n- \"You can send the current contract link.\"\n- \"You can send the contract before Call 2, but it is not advised. Keep the normal close flow unless leadership confirms otherwise.\"\n- \"We do not make contract changes on the sales call. If they need something reviewed, route it to Rich / contracts / legal.\"\n- \"Do not promise edits or custom terms. Use the current link or route the issue.\"\n\n## What reps MUST NOT say\n\n- Do not edit or promise edits to contract terms.\n- Do not present early contract sending as the recommended default process.\n- Do not use a nearby-looking contract/payment link when the amount, show, company, or deliverables do not match.\n- Do not give legal interpretation of contract clauses.\n- Do not promise attorney-review handling, special addenda, wet signatures, entity-name changes, or custom clauses from memory.\n\n## Route If Unclear\n\nRoute to Rich / contracts / legal for:\n\n- requested contract edits or addenda;\n- attorney review;\n- wrong contract amount, package, show, company, or deliverables;\n- client asks for the full contract before payment and the current link/process is unclear;\n- signature/payment order issues;\n- any legal interpretation."
  },
  {
    "id": "current-show-source",
    "title": "Current Show Source",
    "category": "Offers, Pricing & Packages",
    "riskLevel": "high",
    "approvedBy": "Syed Moonis Haider",
    "approvedAt": "2026-06-30",
    "approvalReference": "FAQ Bot - Recommended Answers Pack 1 review status; Luke Gent show-source note shared by user on 2026-06-30; Madeline Cary Slack replies in #sales-questions-requests reviewed 2026-07-09",
    "lastReviewed": "2026-07-09",
    "body": "## Answer\n\nUse the latest approved show list below when a rep asks what shows we currently do.\n\nThe internal maintenance source for show changes is project operations, where new shows are added. Normal reps may not have access to that channel, so the bot should answer from this approved list and route only brand-new, paused, disputed, or missing-show status questions to the current sales/ops owner.\n\nIf a current show is missing from a dropdown or form, route to tech / the current sales-ops owner. Do not tell the rep to choose a placeholder or wrong show and fix it later.\n\nAmerica's Authors is on the approved show list, but if a prospect asks for an America's Authors episode and none have aired yet, be transparent: it is a newer show being cast and no episodes have aired yet. If the rep accidentally told the prospect to Google it or offered an episode link, follow up quickly and correct that. For future episode-watching requests, send prospects to the approved site/app/TV viewing paths rather than telling them to Google it.\n\nFor Legacy Makers info/docs, use the current Sales Ops-approved Legacy Makers materials. If the rep is on the Daymond John side, they should only sell Daymond John. If a DJ-side applicant wants an ISTV show such as Legacy Makers, the applicant needs to be passed to an ISTV-assigned rep.\n\n## Latest Approved Show List\n\n- Legacy Makers\n- Women in Power\n- Operation CEO\n- America's Top Lawyers\n- America's Best Doctors\n- America's Top Trainers\n- America's Top Agents\n- Kingdom Creators\n- Mompreneurs\n- Couples of America\n- Builders of America\n- Legal Titans\n- Life Changers\n- Project Beauty\n- Mindset Masters\n- Love Experts\n- Live Longer\n- Americas Top Contractors\n- Blue Collar America\n- America's Authors\n- America's Top Physicians\n- Doctors of America\n- Rise of Her\n- Made It In America\n- Wealth Makers\n- Beyond Success\n- American Founders\n- Leading with Purpose\n- Impact Makers TV\n- Masters of Innovation\n\n## What Reps Can Say\n\n- \"The latest approved show list I have is: Legacy Makers, Women in Power, Operation CEO, America's Top Lawyers, America's Best Doctors, America's Top Trainers, America's Top Agents, Kingdom Creators, Mompreneurs, Couples of America, Builders of America, Legal Titans, Life Changers, Project Beauty, Mindset Masters, Love Experts, Live Longer, Americas Top Contractors, Blue Collar America, America's Authors, America's Top Physicians, Doctors of America, Rise of Her, Made It In America, Wealth Makers, Beyond Success, American Founders, Leading with Purpose, Impact Makers TV, and Masters of Innovation.\"\n- \"If a show was just added, paused, missing from a form, or disputed, I need to confirm with the current sales/ops owner before giving a final answer.\"\n- \"If the show is missing from the dropdown or form, route it to tech / sales ops. Do not choose a placeholder show.\"\n- \"America's Authors is a newer show we are casting for. If no episodes have aired yet, do not pretend there is an episode link; correct the prospect and point them to approved viewing paths for shows with available episodes.\"\n- \"If you are on the DJ side, only sell Daymond John. If the applicant wants an ISTV show, pass them to an ISTV-assigned rep.\"\n\n## What Reps Must Not Say\n\n- Do not rely on old show lists, old dropdowns, old examples, or public pages as the final source.\n- Do not tell reps to check project operations directly if they do not have access.\n- Do not promise that a newly mentioned, paused, missing, or disputed show is active unless it is confirmed by the current sales/ops owner.\n- Do not treat this list as permanently current after a new approved update supersedes it.\n- Do not tell reps to choose the wrong show, a placeholder show, or a nearby-looking form value and fix it later.\n- Do not tell a prospect to Google for an episode when the show is still being cast and no episodes have aired.\n- Do not let DJ-side reps sell ISTV shows directly; pass ISTV-show interest to an ISTV-assigned rep.\n\n## Route If Unclear\n\nIf a rep asks about a show that is not on this list, a show that may have just launched, a show that may be paused, or a show missing from a dropdown/form, route to the current sales/ops owner or tech instead of guessing."
  },
  {
    "id": "events-mastermind-red-carpet",
    "title": "Events, Mastermind, And Red-Carpet Terms",
    "category": "Events & Access",
    "riskLevel": "high",
    "approvedBy": "Rich Allen and Mike Wisner",
    "approvedAt": "2026-07-07",
    "approvalReference": "2026-07-07 Rich/Mike meeting Mastermind access and fee confirmation; Madeline Cary Slack reply on 4-pay/August filming/Mastermind double-check reviewed 2026-07-09",
    "lastReviewed": "2026-07-09",
    "body": "## Answer\n\nMastermind / red-carpet access is included in all packages under the current meeting-confirmed rule.\n\nThere is a $200 non-refundable fee to attend Mastermind. The fee is for food and drinks.\n\nEvent dates, venue details, logistics, travel, guest rules, and any current event changes can drift. Route those to the current event/source owner.\n\nIf a cast member buys on a 4-pay plan and wants to film in August so they can attend Mastermind before the episode is fully PIF, post in the fulfillment hotline to double-check. The Slack guidance said this should be okay, but reps should still confirm through fulfillment before promising the schedule.\n\n## What Reps Can Say\n\n- \"Mastermind / red-carpet access is included in all packages under the current rule.\"\n- \"There is a $200 non-refundable Mastermind attendance fee for food and drinks.\"\n- \"For dates, venue details, guest rules, or current logistics, confirm with the current event/source owner before promising anything.\"\n- \"For a 4-pay client trying to film in August and attend Mastermind before PIF, post in the fulfillment hotline to double-check before promising it.\"\n\n## What Reps Must Not Say\n\n- Do not quote old event dates, old venue details, old links, or old package/event posts as current.\n- Do not waive or change the $200 fee.\n- Do not promise travel, guests, venue access, filming access, refundability beyond this fee rule, or current logistics from memory.\n- Do not use historical Slack posts or old source links as final answer authority.\n- Do not promise a filming/Mastermind schedule exception before fulfillment confirms it.\n\n## Route If Unclear\n\nRoute any time the question is about a specific upcoming event, date, hotel, travel, guest, venue, current event availability, or exception."
  },
  {
    "id": "greenlight-pdf-and-cohort-deadlines",
    "title": "Greenlight PDFs And Cohort Deadlines",
    "category": "Greenlight, Cohorts & Deadlines",
    "riskLevel": "high",
    "approvedBy": "Rich Allen and Syed Moonis Haider",
    "approvedAt": "2026-07-08",
    "approvalReference": "Rich Allen Slack answers supplied by user on 2026-07-08; user-confirmed #greenlight-requests channel; real Slack-question retest clarification reviewed 2026-07-09",
    "lastReviewed": "2026-07-09",
    "body": "## Answer\n\nUse `#greenlight-requests` for greenlight letter requests, urgent greenlight letter sends, same-day greenlight letter requests, greenlight-letter status/escalations, and questions about whether a letter should or should not go out.\n\nIf a Greenlight PDF or tracking sheet shows a failed social check or similar internal status, route the rep's internal process/status question to `#greenlight-requests`. Do not present the internal status explanation to the applicant as the reason unless the current owner confirms what can be shared.\n\nMain ISTV no-show / missed-deadline / rejection / reapply rule:\n\n- If someone no-shows Call 1, no-shows Call 2 after being greenlit, completes Call 2 but does not pay/sign by Sunday 11:59 PM ET, or is rejected/not-fit, the rep should tell them on the front end that they can reapply at some point in the future.\n- The actual minimum is 3 months before they can reapply.\n- If the person claims a serious genuine reason such as a car crash or death in the family and can provide proof, route it to Rich for approval. Do not approve the exception yourself.\n\nGreenlight caps, exact daily/weekly limits, cutoff times, send windows, status definitions, and emergency-stop mechanics can drift. Route those to `#greenlight-requests` instead of quoting old Slack numbers or old sheet/process timing.\n\n## What Reps Can Say\n\n- \"For greenlight letter requests or urgent letter sends, post in `#greenlight-requests`.\"\n- \"If the PDF/status shows a failed social check or unclear internal status, route that internal question to `#greenlight-requests` before telling the applicant anything beyond the approved rejection process.\"\n- \"For main ISTV, if they no-show, miss the Sunday 11:59 PM ET payment/signature deadline, or are rejected/not-fit, tell them they can reapply in the future. The minimum is 3 months.\"\n- \"If they have a genuine documented emergency, route it to Rich for approval.\"\n- \"For current caps, exact send timing, or whether a letter should go out, use `#greenlight-requests`.\"\n\n## What reps MUST NOT say\n\n- Do not promise that an approval PDF/greenlight letter will be sent by a specific time unless the current SOP confirms it.\n- Do not quote old approval caps, old send windows, old PDF timing, or old status definitions as current.\n- Do not tell the applicant an internal social-check reason unless the current owner confirms what can be shared.\n- Do not make deadline exceptions or same-day discount promises without Rich/current owner confirmation.\n- Do not approve a proof exception yourself, even if the reason sounds genuine.\n- Do not apply the main ISTV cohort/deadline/reapply rule to Daymond John / Next Level CEO.\n\n## Route If Unclear\n\nRoute to `#greenlight-requests` when the question involves:\n\n- greenlight-letter requests or urgent sends;\n- current approval caps;\n- exact cutoff/send windows;\n- a letter that may need to be stopped;\n- current letter status;\n- whether a same-day greenlight letter can still go out.\n\nRoute to Rich when the question is a main ISTV proof exception, next-cohort exception, disputed rejection/not-fit decision, or any nonstandard deadline exception.\n\n## Pending Or Excluded\n\nThis article does not approve exact greenlight caps, daily/weekly capacity, PDF send windows, tracking-sheet status definitions, or an automated/manual letter workflow. It only approves the channel route and the Rich-confirmed main ISTV 3-month reapply minimum."
  },
  {
    "id": "internal-material-sharing-boundaries",
    "title": "Internal Material Sharing Boundaries",
    "category": "Compliance, Proof & Claims",
    "riskLevel": "high",
    "approvedBy": "Syed Moonis Haider",
    "approvedAt": "2026-06-30",
    "approvalReference": "FAQ Bot - Recommended Answers Pack 1 review status; Syed approved internal/confidential material boundary; Madeline Cary Slack reply on pre-audition video sharing reviewed 2026-07-09; 2026-07-09 live retest guardrail for recording deletion/vault requests; 2026-07-09 live retest guardrail for internal dashboard access requests",
    "lastReviewed": "2026-07-09",
    "body": "## Answer\n\nReps should not externally share internal materials unless explicitly approved.\n\nThis includes:\n\n- internal Slack content\n- payment details\n- dashboards\n- internal HQ dashboards\n- source docs\n- confidential notes\n- audition recordings\n- call recordings\n- stats decks\n- training videos\n- internal sales materials\n\nIf a prospect asks for the video they received before the audition, do not send that pre-audition video out. If the prospect is looking for an email/video assignment they already received, they should search their email inbox; the rep can resend the pre-call email with the assignment to watch episodes and ask the prospect to check spam.\n\nIf a prospect or applicant asks for an audition recording or call recording to be deleted, vaulted, sent, or handled after they are not a fit, do not send, delete, or vault it yourself. Do not promise deletion or vaulting. Acknowledge the request and route it to the source owner, compliance owner, or current process owner so it can be handled through the approved process.\n\nIf a rep asks whether closers, prospects, or clients have access to an internal HQ dashboard, Rudy dashboard, internal training dashboard, or dashboard shown in a Call 1 video, do not guess access permissions and do not present internal dashboard content as shareable proof. Route dashboard access and approved public talking-point questions to the current dashboard/source owner or sales leadership.\n\n## What Reps Can Say\n\n- \"I need to check whether that material is approved to share externally.\"\n- \"I can share approved public-facing materials, but not internal docs or recordings unless they are explicitly approved.\"\n- \"If this is the pre-audition video, we cannot send that one out. Have them check their inbox/spam, or resend the pre-call email with the episode-watching assignment.\"\n- \"For a recording deletion or vaulting request, do not handle it yourself. Route it to the source owner/compliance owner.\"\n- \"For internal dashboard access or whether dashboard content can be used with prospects, route to the current dashboard/source owner or sales leadership.\"\n\n## What Reps Must Not Do\n\n- Do not send internal Slack screenshots or source-doc excerpts to prospects or clients.\n- Do not share call recordings, private training videos, dashboards, confidential notes, payment details, or stats decks externally unless explicitly approved.\n- Do not assume a file is shareable just because a rep can access it internally.\n- Do not send the pre-audition video out manually.\n- Do not delete, vault, or promise deletion/vaulting for audition recordings or call recordings yourself.\n- Do not assume closers, prospects, or clients have access to internal dashboards unless the current owner confirms it.\n- Do not use internal dashboard screenshots or training-dashboard details as public proof unless explicitly approved.\n\n## Route If Unclear\n\nIf a prospect or client asks for material that looks internal, route to the source owner/compliance owner before sharing.\n\nIf a client wants a call recording, do not send it automatically. Treat call recordings as internal/private material unless external sharing is explicitly approved and permissioned.\n\nIf the request is about deleting, vaulting, or removing an audition/call recording, route it to the source owner/compliance owner or current process owner. Do not take the action yourself from the chatbot answer.\n\nIf the request is about internal dashboard access, approved dashboard talking points, or whether dashboard content can be shown externally, route to the current dashboard/source owner or sales leadership."
  },
  {
    "id": "istv-nlceo-pricing-and-same-day-discount",
    "title": "ISTV, Next Level CEO Pricing, And Same-Day Discount",
    "category": "Offers, Pricing & Packages",
    "riskLevel": "high",
    "approvedBy": "Syed Moonis Haider",
    "approvedAt": "2026-06-30",
    "approvalReference": "FAQ Bot - Recommended Answers Pack 1 review status; Magic Mike ISTV context pack reviewed by Syed; Rich Allen Slack answer supplied by user on 2026-07-08; Madeline Cary Slack replies on DJ timing and license-options doc reviewed 2026-07-09",
    "lastReviewed": "2026-07-09",
    "body": "## Answer\n\nMain ISTV program:\n\n| Package | Price | Core deliverables |\n| --- | ---: | --- |\n| Lite | $12,000 | 12-15 minute episode, no pre-promo views, no Tier-1 submission, ISN app only |\n| Standard | $20,000 | 16-20 minute episode, 100,000 pre-promo views, no Tier-1 submission, ISN app only |\n| VIP / Premium | $30,000 | 20-25 minute episode, 150,000 pre-promo views, submitted to one Tier-1 platform, ISN app plus Tier-1 streaming app if accepted |\n\nMain ISTV listed payment plans:\n\n| Package | Listed plans |\n| --- | --- |\n| Lite | 4 x $3,000, 3 x $4,000, or 2 x $6,000 |\n| Standard | 4 x $5,000 or 2 x $10,000 |\n| VIP / Premium | 4 x $7,500, 3 x $10,000, or 2 x $15,000 |\n\nNext Level CEO / Daymond John pricing and payment options:\n\n| Package | PIF | Listed payment options |\n| --- | ---: | --- |\n| Lite | $10,000 | $2,500 x 4, $3,600 x 3, or $5,000 x 2 |\n| Standard | $15,000 | $4,000 x 4, $5,000 x 3, or $7,500 x 2 |\n| Premium VIP | $20,000 | $5,000 x 4, $7,000 x 3, or $10,000 x 2 |\n| CEO Day upgrade | $5,000 | PIF only |\n\nSame-day discount:\n\n- The same-day discount applies only to the main ISTV program.\n- It is $2,000 off the main ISTV program.\n- It applies only from Call 2.\n- The client must pay the initial deposit on the same calendar day as that Call 2.\n- If Call 2 ends before payment but the client pays later that same calendar day, the same-day discount can still be honored.\n- It does not apply to Next Level CEO / Daymond John.\n- Daymond John / Next Level CEO also has no cohort rule.\n- Do not carry the discount into the next day.\n\nDaymond John / Next Level CEO timing boundary:\n\n- Daymond John / Next Level CEO applicants are not under the main ISTV cohort rule.\n- If a DJ/NLCEO applicant needs to book out a few weeks for Call 2, that can be okay for DJ/NLCEO applicants only, although reps should still prefer to move them forward as soon as possible.\n- If a DJ/NLCEO applicant cannot follow a main ISTV cohort/payment timing expectation, they can continue later only within the DJ/NLCEO no-cohort boundary and without any promised hold, custom date, or custom payment exception unless the current owner confirms it.\n- Do not apply main ISTV reapply/cohort-deadline pressure to DJ/NLCEO applicants.\n- Do not invent custom payment plans, custom split amounts, or unlisted payment links.\n\nLicense Options / reuse license document:\n\n- Reps are advised not to send the License Options document just to compare Lite and Standard advantages.\n- It is better to go over the options on the call with the applicant.\n- The reuse license document can be sent if needed, but it is not advised because it often hurts the sale.\n\nMain ISTV upgrade before filming:\n\n- Main ISTV clients can upgrade before filming.\n- After filming, it is too late to upgrade the package.\n- If the client received the main ISTV $2,000 same-day discount, that discount carries forward to the upgraded main ISTV package.\n- Discounted Standard total is $18,000.\n- Discounted VIP/Premium total is $28,000.\n- If the client bought discounted Lite at $10,000, the difference is $8,000 to Standard or $18,000 to VIP/Premium.\n- Use the proper upgraded contract and payment-difference link through the current sales-tech or finance route. Do not create custom links manually.\n\n## What Reps Can Say\n\n- Use the listed package prices and listed payment plans above.\n- For Next Level CEO / Daymond John, use only the listed PIF and split-payment options above.\n- For Next Level CEO / Daymond John, do not offer a same-day discount and do not use main ISTV cohort rules.\n- For same-day discount, keep the rule tied to main ISTV, Call 2, and same-calendar-day initial deposit payment.\n- If a discounted main ISTV Lite client upgrades before filming, carry the $2,000 same-day discount forward to the upgraded main ISTV package and charge only the proper difference.\n- For Daymond John / Next Level CEO, a few-week Call 2 booking delay can be okay for DJ/NLCEO applicants only, but keep pushing to move them forward as soon as possible.\n- Do not send the License Options document as the default comparison tool. Go over the options on the call; the reuse license document can be sent if needed but is not advised.\n\n## What Reps Must Not Say\n\n- Do not invent payment splits, custom amounts, special discounts, or exception terms.\n- Do not apply the same-day discount to Next Level CEO / Daymond John.\n- Do not apply main ISTV cohort rules to Next Level CEO / Daymond John.\n- Do not promise the same-day discount if payment will happen after that calendar day.\n- Do not carry the main ISTV same-day discount into any Next Level CEO / Daymond John package.\n- Do not tell DJ/NLCEO applicants they must reapply just because they cannot follow a main ISTV cohort deadline.\n- Do not use the License Options/reuse license document as the default way to sell or compare packages.\n- Do not upgrade a client after filming.\n- Do not create custom upgrade links or payment splits manually.\n- Do not promise a second-show, crossover, VIP-to-VIP, or special discount unless a separate approved article covers that exact case.\n- Do not quote old/spare pricing videos as current.\n\n## Pending Or Excluded\n\nThe older Standard 3-payment split that totals $21,000 is intentionally not listed here. If someone asks about it, route to the current offer owner before quoting it.\n\nSecond-show, crossover, and special-discount rules remain pending Rich/owner confirmation."
  },
  {
    "id": "main-istv-call-2-cohort-reschedule-rules",
    "title": "Main ISTV Call 2 Cohort Reschedule Rules",
    "category": "Greenlight, Cohorts & Deadlines",
    "riskLevel": "high",
    "approvedBy": "Rich Allen and Mike Wisner",
    "approvedAt": "2026-07-07",
    "approvalReference": "2026-07-07 Rich/Mike meeting plus user correction that cohort rules apply only to main ISTV shows; Rich Allen Slack answers supplied by user on 2026-07-08",
    "lastReviewed": "2026-07-08",
    "body": "## Answer\n\nFor main ISTV shows only, the cohort week runs Monday through Sunday at 11:59 PM Eastern.\n\nCall 2 reschedule rule for main ISTV:\n\n- If Call 2 is rescheduled within the same cohort week, the rep can do it without Rich approval.\n- If Call 2 is pushed into the following week / next cohort, it needs Rich approval.\n- Exceptions considered for a next-cohort Call 2 are limited to a medical emergency with proof or a bank block / inability to pay with bank proof.\n- In the bank-block exception, the contract should still be signed even if payment cannot go through yet.\n- Call 1 can be rescheduled to the following week. The strict cohort approval rule is for Call 2.\n\nMain ISTV no-show / missed-deadline / rejection / reapply rule:\n\n- If someone no-shows Call 1, no-shows Call 2 after being greenlit, completes Call 2 but does not pay/sign by Sunday 11:59 PM ET, or is rejected/not-fit, tell them on the front end that they can reapply at some point in the future.\n- The actual minimum is 3 months before they can reapply.\n- Serious genuine reasons with proof, such as a car crash or death in the family, should be routed to Rich for approval. Do not approve the exception yourself.\n\nDaymond John / Next Level CEO:\n\n- There is no cohort rule for Daymond John / Next Level CEO.\n- There is no same-day discount for Daymond John / Next Level CEO.\n- Do not apply the main ISTV cohort, deadline, or same-day discount rule to DJ/NLCEO.\n- Route DJ/NLCEO reschedule, no-show, pay/sign, or deadline edge cases to the current DJ/NLCEO relevant Slack channel / sales owner.\n\n## What Reps Can Say\n\n- \"For main ISTV, the cohort runs Monday through Sunday at 11:59 PM Eastern.\"\n- \"If Call 2 stays in the same cohort week, you can reschedule it without Rich approval.\"\n- \"If Call 2 moves to the next week, get Rich approval unless it is a documented medical emergency or bank block.\"\n- \"If a main ISTV prospect no-shows, misses the Sunday 11:59 PM ET deadline, or is rejected/not-fit, tell them they can reapply in the future. The minimum is 3 months.\"\n- \"For Daymond John / Next Level CEO, there is no cohort rule and no same-day discount. Do not apply the main ISTV cohort rule there.\"\n\n## What Reps Must Not Say\n\n- Do not apply the main ISTV cohort rule to Daymond John or Next Level CEO.\n- Do not push Call 2 into the next cohort without Rich approval unless the approved proof exception applies.\n- Do not approve proof exceptions yourself.\n- Do not create new exception categories beyond documented genuine emergencies, medical emergency proof, or bank-block proof.\n- Do not quote exact greenlight PDF caps or send windows from this article.\n\n## Route If Unclear\n\nRoute to Rich / the current sales owner if the question involves proof quality, next-cohort exceptions, a disputed rejection/not-fit decision, or a situation not explicitly covered above.\n\nRoute DJ/NLCEO reschedule, no-show, pay/sign, deadline, or cohort-like questions to the current DJ/NLCEO relevant Slack channel / sales owner because the main ISTV cohort structure does not apply there."
  },
  {
    "id": "opt-out-dnc-and-security-escalation",
    "title": "Opt-Out, DNC And Security Escalation",
    "category": "Sales Tech & Support Routing",
    "riskLevel": "high",
    "approvedBy": "Rich Allen and Mike Wisner",
    "approvedAt": "2026-07-07",
    "approvalReference": "2026-07-07 Rich/Mike meeting and read-only SOP Google Doc 1lm6dWmMLUQJ83oegGZrTaA29c-rw4hJfkwTXQ4zx9Q4",
    "lastReviewed": "2026-07-07",
    "body": "## Answer\n\nIf a prospect, client, or lead says STOP, asks not to be contacted, opts out, or is already on the DNC list, stop normal outreach.\n\nUse the official opt-out / DNC process:\n\n- Send or use the official opt-out form where appropriate.\n- Manually log the name, email, and phone in the Do Not Contact Google Sheet when the request is handled manually.\n- Update Keap as Do Not Contact and Unsubscribed.\n- Post the note in `ft-opt-outs`.\n- Cancel any pending call if the person opted out before the call.\n- Do not keep texting, calling, emailing, or joining the call to wait after a clear opt-out.\n\nIf the rep cannot message the person again from that same channel, do the internal DNC steps manually instead of contacting the person again.\n\nBefore sales outreach, check the DNC Google Sheet and Keap tags. If the person is on DNC or has Do Not Contact / Unsubscribed / Opted Out tags, do not contact them.\n\nSecurity/privacy handling stays conservative: do not leave sensitive details in chat, Slack, notes, or local files. Route privacy or security incidents to the current security/compliance owner.\n\n## What Reps Can Say\n\n- \"If they opted out or said STOP, do not continue outreach. Follow the DNC process before doing anything else.\"\n- \"Cancel the pending call if they opted out before the call.\"\n- \"If you cannot message them again to send the form, complete the internal DNC steps manually.\"\n- \"Check the DNC sheet and Keap before calling or following up.\"\n\n## What Reps Must Not Do\n\n- Do not ignore STOP, opt-out, DNC, unsubscribe, or \"do not contact me\" language.\n- Do not keep texting, calling, emailing, or joining a scheduled call after a clear opt-out.\n- Do not pull or work leads from Slack before checking DNC and Keap.\n- Do not expose client PII, raw recording links, payment details, or account access details in chatbot answers.\n- Do not troubleshoot security/privacy incidents beyond approved immediate containment steps.\n\n## Route If Unclear\n\nRoute to the current compliance/security/sales-tech owner if:\n\n- the opt-out request is ambiguous;\n- a system cannot be updated;\n- Keap, the DNC sheet, Sendinblue, or Intercom shows conflicting status;\n- a booked person opted out but another team member is still contacting them;\n- private payment, account, login, or recording details were exposed.\n\n## Source Notes\n\nThe read-only SOP references Keap, the Do Not Contact Google Sheet, Sendinblue, Intercom, Slack `ft-opt-outs`, and the official opt-out Typeform. Access links and some automation ownership details were still commented in the source doc, so the bot should not invent exact admin access steps."
  },
  {
    "id": "payment-plan-and-link-boundaries",
    "title": "Payment Plan And Link Boundaries",
    "category": "Payments, Refunds & Contracts",
    "riskLevel": "high",
    "approvedBy": "Syed Moonis Haider",
    "approvedAt": "2026-06-30",
    "approvalReference": "FAQ Bot - Recommended Answers Pack 1 review status; Magic Mike ISTV context pack reviewed by Syed; user-confirmed finance/sales-tech routing on 2026-07-08; Rich Allen custom-payment-plan confirmation supplied by user on 2026-07-08",
    "lastReviewed": "2026-07-08",
    "body": "## Answer\n\nReps should use only current official payment links and listed payment plans.\n\nCustom payment plans, custom splits, custom amounts, and custom payment links are not allowed. Reps should not suggest, create, or promise them. Use only the approved listed payment/installment plans from the current spreadsheet/source.\n\nWire/ACH, invoice, failed-payment, duplicate-charge, card-update, payment-status, refund, and billing questions are separate finance/payment operations. Those route to `#sales-finance-requests`, but routing them does not mean a rep can offer a custom payment plan.\n\nReps should not collect raw card details directly from clients.\n\nFailed payment boundary:\n\n- Finance initially follows up on failed payments by calling, texting, and emailing a few times.\n- If finance cannot get through, the casting manager or sales rep may need to help chase the client.\n- Reps should track payment status, but the rep may not be the first person to know a payment failed.\n- If the initial payment already went through, a later failed payment should not remove the same-day discount.\n- If ACH is pending, do not treat the payment as confirmed until it clears through the current tech/finance process.\n\n## What Reps Can Say\n\n- \"Use the current official payment link and the listed payment plan for that package.\"\n- \"No, you cannot offer a custom payment plan. Use only the approved listed plans from the current spreadsheet/source.\"\n- \"Do not create a custom split, custom amount, or custom payment link to save a deal.\"\n- \"For wire/ACH, invoice, failed-payment, duplicate-charge, card-update, payment-status, refund, or billing questions, post in `#sales-finance-requests` before giving payment instructions or promising an outcome.\"\n- \"If the issue is that a payment link, checkout page, form, dropdown, or sales system is not working, post it in `#sales-tech-requests`.\"\n- \"If a later payment fails after the initial payment was already made, do not remove the same-day discount just because of that later failure.\"\n- \"Finance follows up first on failed payments. If they cannot reach the client, the casting manager or rep may need to help chase it.\"\n\n## What Reps Must Not Do\n\n- Do not create, suggest, or promise custom payment terms.\n- Do not route a custom payment plan request as if finance may approve a new plan; the answer is to use only the approved listed plans.\n- Do not create or substitute payment links.\n- Do not paste raw card numbers, bank details, payment details, or sensitive client financial information into Slack, the chatbot, notes, or local files.\n- Do not tell a client that a wire/ACH/invoice/custom split is allowed unless the current approved route confirms it.\n- Do not post PayMe / payment confirmation while ACH or another payment is still pending.\n- Do not remove a same-day discount because a later scheduled payment failed after the initial payment was already made.\n\n## Route If Unclear\n\nUse issue-type routing. Do not tag an individual person as the default; post in the relevant channel so the right owner can reply there.\n\n- Use `#sales-finance-requests` for client billing, failed payments, duplicate charges, card-update/payment-status questions, refunds, wire/ACH, invoices, and finance/payment exceptions.\n- Use `#sales-tech-requests` when the problem is technical: broken payment links, checkout/page errors, Keap/form/dropdown issues, Zoom/call/recording issues, calendar/rebooking tooling, or payment-link mechanics that are not working.\n- Use `#sales-questions-requests` when the issue is a sales-policy approval question rather than a finance or tech execution issue.\n\nFor custom payment plan/custom split/custom amount questions, answer the boundary first: no custom plan; use only the approved listed plans. Use finance routing only when there is a real payment-operation issue to resolve."
  },
  {
    "id": "platform-hosting-and-client-license-duration",
    "title": "Platform Hosting And Client License Duration",
    "category": "Content Rights & Usage",
    "riskLevel": "high",
    "approvedBy": "Syed Moonis Haider",
    "approvedAt": "2026-06-30",
    "approvalReference": "FAQ Bot - Recommended Answers Pack 1 review status; Magic Mike ISTV context pack reviewed by Syed",
    "lastReviewed": "2026-06-30",
    "body": "## Answer\n\nThe current duration wording is:\n\n- ISTV platform hosting is 5 years.\n- The client has lifetime license rights to their own episode/content.\n\nDo not merge those two points. The client's license rights are lifetime, but ISTV platform hosting is not lifetime/permanent.\n\n## What Reps Can Say\n\n- \"The episode is hosted on the ISTV platform for 5 years.\"\n- \"The client has lifetime license rights to their own episode/content.\"\n\n## What Reps Must Not Say\n\n- Do not say ISTV platform hosting is lifetime or permanent.\n- Do not promise third-party platform availability beyond approved wording.\n- Do not answer detailed usage-rights questions unless a separate approved rights article covers the exact use case.\n\n## Route If Asked About Usage Details\n\nQuestions about full-episode posting, clips, trailers, ads, embedding, YouTube, third-party platforms, written consent, or product-specific content rights still need legal/contracts-approved wording. Route those instead of guessing."
  },
  {
    "id": "platform-proof-and-claims-boundaries",
    "title": "Platform, Proof, And Claims Boundaries",
    "category": "Compliance, Proof & Claims",
    "riskLevel": "high",
    "approvedBy": "Syed Moonis Haider",
    "approvedAt": "2026-06-30",
    "approvalReference": "FAQ Bot - Recommended Answers Pack 1 review status; Magic Mike ISTV context pack reviewed by Syed; Madeline Cary Slack reply on VIP conversion page example reviewed 2026-07-09; 2026-07-09 live retest guardrail for media-kit and audience-stat requests",
    "lastReviewed": "2026-07-09",
    "body": "## Answer\n\nApproved platform wording:\n\n- All tiers air on the Inside Success Network app.\n- The Inside Success Network app is accessible on Roku, Fire Stick, and Apple TV physical devices.\n- This is not the Apple TV streaming app/channel and not the Amazon streaming app.\n- VIP / Premium is submitted to one Tier-1 streaming platform: Amazon Prime Video, Apple TV streaming app, or Tubi.\n- Tier-1 placement is a platform decision and is not guaranteed.\n- ISTV does not work directly with Amazon or Apple. A third party helps with those submissions.\n- Clients cannot pay extra to force or guarantee Apple TV streaming-app submission or placement.\n\nApproved scam / bad-review objection boundary:\n\n- Keep it short. Do not go down a long defense path.\n- If the prospect truly believes it is a scam, it may not be for them.\n- A brief clarification is allowed: many bad search results come from confusion with a separate UK company named Inside Success. Searching `InsideSuccessTV` points to the correct ISTV brand context.\n- Reps can point to the correct ISTV review context and public proof that is currently approved to share, but must not over-argue or promise outcomes.\n\nApproved value / vendor comparison boundary:\n\n- Avoid perceived-value, vendor comparison, and cheaper-production arguments because they drift into ROI/value guarantees.\n- Do not compare the cost of producing a show with another vendor as the reason the client should buy.\n\nWebpage/social rebrand examples for the $30K license are proof/example assets. Sales Ops has shared a VIP conversion page example, but the bot does not maintain a full public list of examples. Use only the current Sales Ops-approved example/link and do not invent or imply a broader example library.\n\nOfficial third-party media kits, Nielsen statistics, audience statistics, demographics, rankings, view counts, and current proof decks are proof/claims assets. Do not quote those from memory or from old screenshots. Route requests for current media-kit, Nielsen, audience-stat, demographic, or proof-deck material to the approved proof/source owner.\n\n## What Reps Can Say\n\n- \"All tiers air on the Inside Success Network app.\"\n- \"VIP/Premium includes submission to one Tier-1 platform, but placement is not guaranteed because the platform decides.\"\n- \"If they are seeing bad reviews, briefly clarify whether they are looking at the separate UK company or ISTV. Search `InsideSuccessTV` for the correct brand context.\"\n- \"If they still feel this is a scam, this may not be the right fit for them.\"\n- \"Do not get into a vendor-cost or ROI comparison. Keep it to the approved platform and fit language.\"\n- \"For $30K webpage/social rebrand examples, Sales Ops has a VIP conversion page example. Use the current approved example/link; do not imply we have a full approved list unless Sales Ops confirms it.\"\n- \"For official media kits, Nielsen statistics, audience statistics, demographics, rankings, or proof decks, route to the approved proof/source owner for the current approved material.\"\n\n## What Reps Must Not Say\n\n- Do not guarantee Amazon, Apple TV streaming app, Tubi, or any other Tier-1 placement.\n- Do not say a client can pay extra to guarantee Apple TV streaming-app submission or placement.\n- Do not say ISTV works directly with Amazon or Apple.\n- Do not promise ROI, revenue, leads, fundraising, PR outcomes, platform placement, views, demographics, celebrity outcomes, or guaranteed business results.\n- Do not use unsupported public proof, old examples, screenshots, dashboards, or stats decks as proof.\n- Do not quote media-kit, Nielsen, audience-stat, demographic, ranking, view-count, or proof-deck numbers from memory.\n- Do not argue at length with someone calling it a scam.\n- Do not claim every bad review is fake or removed.\n- Do not use vendor-production cost comparisons to justify the price.\n- Do not create or share an unapproved proof/example list from memory.\n\n## Route If Asked For Proof Links Or Claims\n\nIf the rep needs specific review links, press, episode examples, celebrity proof, media kits, Nielsen statistics, audience statistics, demographics, view language, proof decks, or approved public proof links, route to the approved proof/source owner until the current proof pack is approved."
  },
  {
    "id": "post-sale-handoff-after-close",
    "title": "Post-Sale Handoff After Close",
    "category": "Call Process & Scripts",
    "riskLevel": "high",
    "approvedBy": "Rich Allen and Mike Wisner",
    "approvedAt": "2026-07-07",
    "approvalReference": "2026-07-07 Rich/Mike meeting post-sale handoff confirmation; 2026-07-09 Mike/Rich-approved same-day onboarding answer",
    "lastReviewed": "2026-07-09",
    "body": "## Answer\n\nAfter a sale, follow the \"How to close a sale\" cheat sheet from onboarding.\n\nConfirmed sales-side handoff steps:\n\n- Close the call.\n- Take payment.\n- Get the contract signed.\n- Review the onboarding email with the client.\n- Send the onboarding email.\n- Book the onboarding call for the next day.\n- Confirm payment in the All Payments / PayMe process once payment is actually confirmed.\n\nIf waiting on ACH, do not post PayMe / payment confirmation until ACH clears through the current tech/finance process.\n\nThe studio executive team handles detailed onboarding-call questions. Reps should avoid overpromising fulfillment details.\n\nIf a same-day or short-notice onboarding call has just been booked after a close, the rep does not need to notify anyone separately as long as all required post-sale steps are complete: payment taken, contract signed, onboarding email reviewed and sent, and the onboarding call booked. The onboarding call itself is handled by the studio executive team.\n\n## What Reps Can Say\n\n- \"After payment and signature, review and send the onboarding email and book the onboarding call for the next day.\"\n- \"Only confirm PayMe / All Payments after the payment is actually confirmed.\"\n- \"If ACH is pending, wait until it clears through the current tech/finance process.\"\n- \"Detailed onboarding questions are handled by the studio executive team on the onboarding call.\"\n- \"You do not need to notify anyone separately for a same-day onboarding call booking as long as payment is taken, the contract is signed, the onboarding email is reviewed and sent, and the call is booked. The onboarding call itself is handled by the studio executive team.\"\n\n## What Reps Must Not Say\n\n- Do not post payment confirmation while ACH or another payment method is still pending.\n- Do not promise fulfillment details that belong to the studio executive / onboarding team.\n- Do not skip contract signature or onboarding-call booking.\n- Do not invent custom post-sale steps beyond the current cheat sheet.\n- Do not skip or gloss over required post-sale steps before treating a same-day onboarding booking as handled.\n\n## Route If Unclear\n\nRoute to the current sales/ops, finance, tech, or onboarding owner if payment has not cleared, the contract is not signed, ACH is pending, onboarding email details are missing, or the client asks detailed fulfillment questions."
  },
  {
    "id": "qualification-and-show-fit-rubric",
    "title": "Qualification And Show Fit Rubric",
    "category": "Qualification & Show Fit",
    "riskLevel": "high",
    "approvedBy": "Rich Allen and Mike Wisner",
    "approvedAt": "2026-07-07",
    "approvalReference": "2026-07-07 Rich/Mike meeting qualification and background decisions; Madeline Cary Slack replies on minors, dispensaries, and hemp/business-fit examples reviewed 2026-07-09",
    "lastReviewed": "2026-07-09",
    "body": "## Answer\n\nDo not turn qualification into a hard yes/no from one old Slack example. Use these approved boundaries only, then route edge cases.\n\nAmerica's Best Doctors:\n\n- A doctor can qualify even if they work in a hospital and do not own the practice.\n- Do not disqualify a doctor just because they are employed by a hospital.\n- Nurses do not qualify as doctors for America's Best Doctors.\n- Physical therapists / physiotherapists are case-by-case. Route before promising fit.\n\nGeneral qualification:\n\n- Look for a business, practice, platform, or story that can benefit from the episode.\n- Consider whether the business or platform is mature enough, whether the story is compelling, whether the person fits the network, and whether they seem likely to be a reasonable client.\n- Some legacy/story-led clients can be exceptions, so do not create a blanket \"business owner only\" rule across every show.\n- Minors can be considered when a parent/guardian is present and okay with the call. If parent/guardian permission or legal consent is unclear, route before proceeding.\n\nBackground and reputation:\n\n- Daymond John / Next Level CEO is stricter: generally reject criminal history except minor issues such as speeding or parking tickets.\n- Main ISTV rejects serious red flags such as murder, pedophilia, sex-industry positioning, bank robbery, or gun crime.\n- Cannabis and firearms can be acceptable when they are regulated, legal, licensed, and positioned professionally. This includes hemp and dispensary businesses only when they meet the same regulated, legal, licensed, and professional-positioning boundary.\n- Strong extremist political/religious positioning, racism, sexism, or similar reputational red flags should route and should not be approved by the bot.\n- Motivational speakers and personal brands can qualify when they are otherwise a fit and not in a disallowed category.\n\n## What Reps Can Say\n\n- \"A doctor does not have to own the practice to be considered for America's Best Doctors.\"\n- \"If they are a doctor working in a hospital, do not disqualify them just for that.\"\n- \"A nurse is not the same as a doctor for America's Best Doctors.\"\n- \"For physical therapists, unusual medical roles, background issues, or reputational red flags, route it before promising fit.\"\n- \"A minor can be okay if the parent/guardian is present and okay with it. If consent is unclear, route it.\"\n- \"A legal, regulated, licensed, professionally positioned cannabis/hemp/dispensary business can be a fit, but do not guarantee acceptance if there are licensing, legal, or reputation concerns.\"\n\n## What reps MUST NOT say\n\n- Do not guarantee acceptance or disqualification for sensitive edge cases unless the approved rubric directly covers the case.\n- Do not use another prospect's Slack case as precedent.\n- Do not make legal, medical, criminal, licensing, or reputational determinations from memory.\n- Do not say America's Best Doctors requires practice ownership.\n- Do not apply main ISTV flexibility to Daymond John / Next Level CEO background cases.\n- Do not proceed with a minor if parent/guardian permission is unclear.\n\n## Route If Unclear\n\nRoute to sales leadership/compliance when the case involves:\n\n- physical therapists / physiotherapists or unusual medical roles;\n- criminal, legal, licensing, reputation, adult/sexual, political, religious, racism/sexism, firearms, cannabis / hemp / dispensary / dispensaries, minors, or other sensitive background concerns;\n- uncertainty about whether the applicant has a business/platform/story that fits the show;\n- show-specific exceptions not listed above."
  },
  {
    "id": "refund-rules-by-product",
    "title": "Refund Rules By Product",
    "category": "Payments, Refunds & Contracts",
    "riskLevel": "high",
    "approvedBy": "Syed Moonis Haider",
    "approvedAt": "2026-06-30",
    "approvalReference": "FAQ Bot - Recommended Answers Pack 1 review status; Syed approved context-pack refund split; user-confirmed finance routing on 2026-07-08",
    "lastReviewed": "2026-07-08",
    "body": "## Answer\n\nCurrent refund rule by product:\n\n| Product / show type | Current refund rule |\n| --- | --- |\n| Next Level CEO / Daymond John | 3-day refund window |\n| Main ISTV program and other shows | No refund offer and no refunds |\n\n## What Reps Can Say\n\n- \"For Next Level CEO / Daymond John, the current refund window is 3 days.\"\n- \"For ISTV/main-program shows and other shows, there is no refund offer and no refunds.\"\n\n## What Reps Must Not Say\n\n- Do not promise a refund, cancellation, payment pause, chargeback outcome, or exception.\n- Do not negotiate exceptions from memory or based on another client's case.\n- Do not quote contract/legal terms unless the approved contract article covers the exact question.\n\n## Route If Asked About Exceptions\n\nIf the question involves a refund exception, cancellation exception, failed-payment proof, duplicate charge, emergency proof, payment pause, or paid-but-not-signed case, do not promise an outcome. Route finance/payment cases in `#sales-finance-requests`.\n\nIf the question is really about contract wording, legal interpretation, or a requested contract change, route to Rich / contracts / legal instead of treating it as a finance-only question."
  },
  {
    "id": "sales-tech-routing-and-support-requests",
    "title": "Sales-Tech Routing And Support Requests",
    "category": "Sales Tech & Support Routing",
    "riskLevel": "high",
    "approvedBy": "Syed Moonis Haider",
    "approvedAt": "2026-07-08",
    "approvalReference": "User confirmation in chat, 2026-07-08: route by issue type; sales-tech issues go to #sales-tech-requests",
    "lastReviewed": "2026-07-08",
    "body": "## Answer\n\nUse issue-type routing. Do not tag one default person; post in the relevant Slack channel and the right owner will reply there.\n\nSales-tech issues go to `#sales-tech-requests`.\n\nUse `#sales-tech-requests` for calls, Zoom, Zoom Phone, Keap, forms, missing dropdowns, recordings, calendar/rebooking tooling, passoff/double-booking tooling, checkout/page errors, broken payment links, and other sales-system issues.\n\nUse `#sales-finance-requests` for finance/client billing issues such as failed payments, duplicate charges, payment status, card updates, wire/ACH, invoices, refunds, billing questions, and payment-operation exceptions that are not requests for a custom payment plan, custom split, custom amount, or custom link.\n\nUse `#sales-questions-requests` for sales-policy or approval questions that are not mainly finance or tech execution.\n\nUse `#greenlight-requests` for greenlight letter requests, urgent greenlight letter sends, and greenlight-letter status/escalation requests.\n\n## What Reps Can Say\n\n- \"For sales-tech issues like Zoom, Keap, call tools, dropdown/forms, recordings, calendars, or broken payment-link mechanics, post in `#sales-tech-requests`.\"\n- \"For client billing, failed payment, duplicate charge, wire/ACH, invoice, refund, card-update, or finance exception questions, post in `#sales-finance-requests`.\"\n- \"For sales-policy approval questions, use `#sales-questions-requests`.\"\n- \"For greenlight letter requests, use `#greenlight-requests`.\"\n\n## What reps MUST NOT say\n\n- Do not send sensitive payment, card, bank, client PII, raw recording links, or CRM URLs into chatbot answers.\n- Do not tell reps to DM one individual person as the default route.\n- Do not route custom payment plan, custom split, custom amount, custom link, or custom payment-term requests as if finance may approve a new option; those are not allowed unless they are already listed in the approved payment source.\n- Do not put raw card numbers, bank details, private recording links, passwords, tokens, or private client data into Slack, the chatbot, notes, or local files.\n- Do not give exact troubleshooting steps, edit system records, change calendars, or create payment links unless a separate approved SOP covers that exact action.\n\n## Route If Unclear\n\nIf the rep is asking for exact steps rather than routing, send them to the relevant channel instead of inventing the steps:\n\n- `#sales-tech-requests` for tech/tooling steps.\n- `#sales-finance-requests` for money/payment/billing steps.\n- `#sales-questions-requests` for policy approval.\n- `#greenlight-requests` for greenlight letters.\n\nInclude enough non-sensitive context for the channel to help: show/product, client name if appropriate, rep name, what happened, what link/tool failed, deadline/urgency, and screenshots only if they do not expose private payment or login details.\n\n## Pending Or Excluded\n\nThis article confirms channel routing only. It does not approve a full troubleshooting decision tree, coverage hours, ticket-desk replacement policy, calendar-link matrix, Zoom Phone fix steps, Keap data changes, payment-link creation, or sensitive-data handling beyond the red lines above."
  },
  {
    "id": "twenty-percent-dial-out-sop",
    "title": "20 Percent Dial-Out SOP",
    "category": "20 Percent Outbound",
    "riskLevel": "high",
    "approvedBy": "Rich Allen and Mike Wisner",
    "approvedAt": "2026-07-07",
    "approvalReference": "2026-07-07 Rich/Mike meeting lead-ownership confirmation",
    "lastReviewed": "2026-07-07",
    "body": "## Answer\n\nThe 20 percent rule is a commission rule. It does not let reps ignore lead ownership, Keap assignment, or DNC checks.\n\nBefore dialing a 20 percent lead:\n\n- Check Keap first.\n- If the lead is assigned to another rep, do not dial it.\n- Check DNC / opt-out status before contacting.\n- Keep Keap notes current.\n\nLead ownership:\n\n- First booking wins if the same person is booked with two reps or shows.\n- A rep has a 30-day ownership window from the time they communicate with the lead and log the communication in Keap.\n- Every new contact / logged note refreshes the 30-day window.\n- After 31 days without contact, another rep can speak with the lead.\n\n## What Reps Can Say\n\n- \"Check Keap before dialing. If another rep owns or is assigned to the lead, do not call it.\"\n- \"The ownership window is 30 days from a logged communication in Keap, and each new logged contact refreshes it.\"\n- \"After 31 days with no contact, another rep can speak with the lead.\"\n- \"If the same person is booked twice, the first booking wins.\"\n\n## What Reps Must Not Do\n\n- Do not tell reps to call/text outside approved hours.\n- Do not bypass DNC/opt-out rules.\n- Do not dial leads assigned to another rep.\n- Do not claim ownership just by seeing a lead in Slack if Keap and notes do not support it.\n- Do not hoard leads or work more leads than can be kept updated properly.\n\n## Route If Unclear\n\nRoute to the current 20 percent / sales owner if:\n\n- Keap has conflicting notes or assignments;\n- a lead has duplicate records;\n- a lead opted out or may be on DNC;\n- two reps dispute ownership beyond the first-booking rule;\n- the question is about list size, daily limits, or reporting requirements not covered above."
  }
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
  "defaultDecision": {
    "decision": "abstain_unapproved",
    "reason": "No approved policy rule matched. Do not answer from retrieval alone."
  },
  "adminOnlyRules": [
    {
      "id": "admin-rule-update-channel-watch",
      "decision": "admin_only",
      "article_id": "current-sales-rule-update-channels",
      "reason": "Update-channel governance is approved for admin/maintenance use only.",
      "match_any_groups": [
        [
          "knowledge system",
          "sales rule",
          "rule changes"
        ],
        [
          "watch",
          "slack channels"
        ]
      ]
    },
    {
      "id": "admin-rule-no-raw-slack-auto-approval",
      "decision": "admin_only",
      "article_id": "current-sales-rule-update-channels",
      "reason": "Raw Slack may signal changes, but it cannot bypass article approval.",
      "match_any_groups": [
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
      ]
    }
  ],
  "abstainRules": [
    {
      "id": "abstain-new-rep-onboarding",
      "decision": "abstain_unapproved",
      "blocked_topic": "new-rep-onboarding-and-final-mock",
      "reason": "New-rep onboarding and final mock requirements are not approved for runtime answers.",
      "match_any": [
        "new reps",
        "final mock",
        "new rep"
      ]
    },
    {
      "id": "abstain-account-specific-commission-tier",
      "decision": "abstain_unapproved",
      "blocked_topic": "commission-tier-and-leaderboard",
      "reason": "Live individual commission tier, leaderboard, and payout data are not available in Ask Sales FAQ.",
      "match_any_groups": [
        [
          "commission",
          "commission tier",
          "leaderboard",
          "bill.com",
          "bill com",
          "payout"
        ],
        [
          "my",
          "am i",
          "this month",
          "what tier",
          "which tier",
          "where am i",
          "rank"
        ]
      ]
    }
  ],
  "routeRules": [
    {
      "id": "route-greenlight-letter-requests",
      "decision": "route_from_approved_article",
      "article_id": "greenlight-pdf-and-cohort-deadlines",
      "reason": "Greenlight letter status, failed checks, stop/send uncertainty, and unresolved escalation questions route to #greenlight-requests.",
      "match_any_groups": [
        [
          "greenlight",
          "green light",
          "approval letter",
          "approval pdf"
        ],
        [
          "status",
          "failed",
          "fail",
          "why",
          "should not go out",
          "stop the letter",
          "letter sent by",
          "approval letter sent by"
        ]
      ]
    },
    {
      "id": "route-greenlight-live-ops",
      "decision": "route_from_approved_article",
      "article_id": "greenlight-pdf-and-cohort-deadlines",
      "reason": "Greenlight caps, exact send windows, letter status, and emergency-stop mechanics route to #greenlight-requests.",
      "match_any": [
        "greenlight approval cap",
        "current greenlight approval cap",
        "approval cap",
        "greenlight cap",
        "greenlight count",
        "greenlights per day",
        "daily greenlight",
        "greenlight pdf timing",
        "pdf send",
        "pdf timing",
        "send window",
        "cutoff time",
        "approval pdf",
        "approval letter status",
        "letter status",
        "emergency stop",
        "should not go out",
        "stop the letter",
        "greenlight sent by",
        "letter sent by",
        "approval letter sent by"
      ]
    },
    {
      "id": "route-main-istv-proof-exception",
      "decision": "route_from_approved_article",
      "article_id": "greenlight-pdf-and-cohort-deadlines",
      "reason": "Main ISTV genuine-reason or proof exceptions require Rich approval.",
      "match_any_groups": [
        [
          "proof",
          "car crash",
          "death in family",
          "death in the family",
          "genuine reason",
          "serious reason",
          "family emergency",
          "emergency",
          "out of town"
        ],
        [
          "deadline",
          "no show",
          "no-show",
          "reapply",
          "missed",
          "cohort",
          "exception"
        ]
      ]
    },
    {
      "id": "route-sales-tech-channel-question",
      "decision": "route_from_approved_article",
      "article_id": "sales-tech-routing-and-support-requests",
      "reason": "Approved sales-tech article gives the channel route, not exact troubleshooting steps.",
      "match_any_groups": [
        [
          "where do i post",
          "where should i post",
          "which channel",
          "what channel",
          "who do i ask",
          "who should i ask"
        ],
        [
          "zoom",
          "keap",
          "calendar",
          "recording",
          "dropdown",
          "sales-tooling",
          "sales tooling",
          "sales-system",
          "sales system"
        ]
      ]
    },
    {
      "id": "route-sales-tech-exact-steps",
      "decision": "route_from_approved_article",
      "article_id": "sales-tech-routing-and-support-requests",
      "reason": "Approved sales-tech article gives the channel route, not exact troubleshooting steps.",
      "match_any": [
        "which calendar link",
        "calendar link",
        "rebooking link",
        "oncehub",
        "zoom phone",
        "caller id",
        "exact steps fix",
        "what exact steps",
        "sales-tech issue",
        "sales tech issue",
        "tech issue"
      ]
    },
    {
      "id": "route-current-show-status",
      "decision": "route_from_approved_article",
      "article_id": "current-show-source",
      "reason": "Current show status can drift; answer from the approved list and route newly added, paused, disputed, or missing-show cases to the current sales/ops owner.",
      "match_any": [
        "is love experts active",
        "currently active",
        "active right now",
        "missing from the dropdown",
        "missing from dropdown",
        "show dropdown",
        "missing from the form",
        "paused"
      ]
    },
    {
      "id": "route-stale-standard-split",
      "decision": "route_from_approved_article",
      "article_id": "istv-nlceo-pricing-and-same-day-discount",
      "reason": "The old Standard 3 x $7,000 split is intentionally excluded from approved terms.",
      "match_any": [
        "3 payments of $7,000",
        "3 payments of 7000",
        "standard as 3 payments",
        "$21,000"
      ]
    },
    {
      "id": "route-special-discounts",
      "decision": "route_from_approved_article",
      "article_id": "istv-nlceo-pricing-and-same-day-discount",
      "reason": "Second-show, crossover, and special discounts remain pending Rich/owner confirmation.",
      "match_any": [
        "second-show",
        "second show",
        "crossover discount",
        "special discount"
      ]
    },
    {
      "id": "route-refund-exceptions",
      "decision": "route_from_approved_article",
      "article_id": "refund-rules-by-product",
      "reason": "Refund/payment exceptions must route through #sales-finance-requests unless the issue is legal/contract-specific.",
      "match_any": [
        "paid but did not sign",
        "paid but not signed"
      ]
    },
    {
      "id": "route-duplicate-charge",
      "decision": "route_from_approved_article",
      "article_id": "payment-plan-and-link-boundaries",
      "reason": "Duplicate-charge and charged-twice cases route through #sales-finance-requests.",
      "match_any": [
        "duplicate charge",
        "card was charged",
        "charged twice",
        "charged two times",
        "double charged"
      ]
    },
    {
      "id": "route-wire-ach",
      "decision": "route_from_approved_article",
      "article_id": "payment-plan-and-link-boundaries",
      "reason": "Wire/ACH/invoice/payment exceptions route through #sales-finance-requests.",
      "match_any": [
        "wire",
        "ach",
        "invoice"
      ]
    },
    {
      "id": "route-broken-payment-link",
      "decision": "route_from_approved_article",
      "article_id": "payment-plan-and-link-boundaries",
      "reason": "Broken payment-link mechanics route through #sales-tech-requests.",
      "match_any": [
        "payment link is broken",
        "broken payment link",
        "link is broken"
      ]
    },
    {
      "id": "route-proof-links",
      "decision": "route_from_approved_article",
      "article_id": "platform-proof-and-claims-boundaries",
      "reason": "Specific proof links and shareable proof assets still need the current approved source-owner material.",
      "match_any": [
        "public proof",
        "proof links",
        "reviews and press",
        "episode examples",
        "celebrity proof",
        "specific review links",
        "approved public proof links"
      ]
    },
    {
      "id": "route-media-kit-audience-stats",
      "decision": "route_from_approved_article",
      "article_id": "platform-proof-and-claims-boundaries",
      "reason": "Official media kits, Nielsen statistics, audience statistics, demographics, and proof decks need the current approved proof/source owner material.",
      "match_any": [
        "media kit",
        "third-party media kit",
        "third party media kit",
        "nielsen",
        "audience statistics",
        "audience stats",
        "audience data",
        "demographics",
        "proof deck",
        "stats deck"
      ]
    },
    {
      "id": "route-refund-reschedule-force-majeure",
      "decision": "route_from_approved_article",
      "article_id": "refund-rules-by-product",
      "reason": "Refund, rescheduling, cancellation, force-majeure, travel-restriction, illness, or production-disruption exceptions require finance/contracts/current-owner routing before reps promise an outcome.",
      "match_any_groups": [
        [
          "refund",
          "reschedule",
          "rescheduling",
          "cancellation",
          "policy"
        ],
        [
          "pandemic",
          "lockdown",
          "travel restriction",
          "serious illness",
          "production disruption",
          "outside their control",
          "force majeure",
          "exception"
        ]
      ]
    },
    {
      "id": "route-client-recording-share",
      "decision": "route_from_approved_article",
      "article_id": "internal-material-sharing-boundaries",
      "reason": "External sharing of call recordings needs explicit approval.",
      "match_any_groups": [
        [
          "call recording",
          "recording"
        ],
        [
          "client wants",
          "send"
        ]
      ]
    },
    {
      "id": "route-client-recording-delete-vault",
      "decision": "route_from_approved_article",
      "article_id": "internal-material-sharing-boundaries",
      "reason": "Recording deletion, vaulting, or external-sharing requests need the source owner or compliance-approved process.",
      "match_any_groups": [
        [
          "audition recording",
          "call recording",
          "recording"
        ],
        [
          "delete",
          "deleted",
          "vault",
          "vaulted",
          "send it to her",
          "send it to them",
          "can't send",
          "cannot send"
        ]
      ]
    },
    {
      "id": "route-internal-dashboard-access",
      "decision": "route_from_approved_article",
      "article_id": "internal-material-sharing-boundaries",
      "reason": "Internal HQ/dashboard access and dashboard-proof questions need the current dashboard/source owner or sales leadership.",
      "match_any_groups": [
        [
          "hq dashboard",
          "rudy dashboard",
          "dashboard that rudy shows",
          "internal dashboard",
          "training dashboard"
        ],
        [
          "closers have access",
          "have access",
          "access to",
          "authors are interested",
          "extra training",
          "potential introductions",
          "events"
        ]
      ]
    },
    {
      "id": "route-content-usage-details",
      "decision": "route_from_approved_article",
      "article_id": "platform-hosting-and-client-license-duration",
      "reason": "Detailed content usage rights need legal/contracts-approved wording.",
      "match_any": [
        "upload the full episode",
        "youtube",
        "run ads",
        "clips",
        "trailer"
      ]
    },
    {
      "id": "route-recording-access-issue",
      "decision": "route_from_approved_article",
      "article_id": "call-recording-storage-and-access",
      "reason": "Missing or denied recording access routes to the recording owner.",
      "match_any": [
        "recording link is missing",
        "do not have access",
        "access denied",
        "missing recording link"
      ]
    },
    {
      "id": "route-contract-exceptions",
      "decision": "route_from_approved_article",
      "article_id": "contracts-edits-and-signature-process",
      "reason": "Contract edits and legal-review exceptions can use the approved no-edit boundary, but still require routing for the exception.",
      "match_any": [
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
      ]
    },
    {
      "id": "route-dj-nlceo-cohort-scope",
      "decision": "route_from_approved_article",
      "article_id": "main-istv-call-2-cohort-reschedule-rules",
      "reason": "Daymond John / Next Level CEO has no cohort rule and no same-day discount; route DJ/NLCEO edge cases to the current DJ/NLCEO channel or sales owner.",
      "match_any_groups": [
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
          "same week",
          "deadline",
          "no show",
          "no-show",
          "pay/sign",
          "pay and sign"
        ]
      ]
    },
    {
      "id": "route-dj-nlceo-payment-timing-exception",
      "decision": "route_from_approved_article",
      "article_id": "istv-nlceo-pricing-and-same-day-discount",
      "reason": "Daymond John / Next Level CEO first-payment timing exceptions need current owner confirmation before reps promise a future payment date or hold.",
      "match_any_groups": [
        [
          "daymond john",
          "next level ceo",
          "dj",
          "nlceo"
        ],
        [
          "initial payment",
          "first payment",
          "payment timing",
          "future payment date",
          "specific future payment date",
          "few weeks",
          "need a few weeks",
          "needs a few weeks",
          "delay first payment",
          "delay the first payment",
          "need time to get initial deposit",
          "needs time to get initial deposit"
        ]
      ]
    },
    {
      "id": "route-payment-timing-or-hold-boundary",
      "decision": "route_from_approved_article",
      "article_id": "istv-nlceo-pricing-and-same-day-discount",
      "reason": "Payment timing, funds-unavailable, hold, and product-specific cohort/payment boundaries need the approved pricing/cohort guidance; answer conditionally if the product is unclear and route promises or exceptions.",
      "match_any_groups": [
        [
          "ability to find",
          "payment holding",
          "pmt holding",
          "holding them back",
          "2.5k",
          "$2,500",
          "$2500"
        ],
        [
          "call 2",
          "greenlit",
          "greenlit a candidate",
          "approved to move forward",
          "close",
          "opportunity",
          "payment",
          "deposit",
          "pay/sign",
          "pay and sign",
          "continue later"
        ]
      ]
    }
  ],
  "answerRules": [
    {
      "id": "answer-greenlight-letter-routing",
      "decision": "answer_from_approved_article",
      "article_id": "greenlight-pdf-and-cohort-deadlines",
      "reason": "Approved greenlight article confirms #greenlight-requests for greenlight letter requests and urgent sends.",
      "match_any": [
        "greenlight letter request",
        "greenlight requests",
        "#greenlight-requests",
        "urgent greenlight letter",
        "greenlight letter urgent",
        "greenlight letter urgently",
        "needs a greenlight letter",
        "where should they ask for a greenlight letter",
        "send a greenlight letter",
        "same-day greenlight letter",
        "same day greenlight letter",
        "where do i post greenlight"
      ]
    },
    {
      "id": "answer-main-istv-reapply-minimum",
      "decision": "answer_from_approved_article",
      "article_id": "greenlight-pdf-and-cohort-deadlines",
      "reason": "Rich confirmed the main ISTV reapply minimum after no-show, missed deadline, rejection, or not-fit outcome.",
      "match_any": [
        "reapply after a no-show",
        "reapply after no-show",
        "reapply after no show",
        "missed cohort deadline",
        "missed the cohort deadline",
        "missed deadline",
        "misses the deadline",
        "no-show call 1",
        "no show call 1",
        "no-show call 2",
        "no show call 2",
        "does not pay/sign",
        "does not pay and sign",
        "sunday 11:59",
        "rejected/not-fit",
        "rejected not fit",
        "not-fit"
      ]
    },
    {
      "id": "answer-sales-tech-routing",
      "decision": "answer_from_approved_article",
      "article_id": "sales-tech-routing-and-support-requests",
      "reason": "Approved sales-tech article confirms issue-type routing across sales-tech, finance, sales questions, and greenlight requests.",
      "match_any_groups": [
        [
          "sales-tech",
          "sales tech",
          "sales tech requests",
          "support request",
          "technical request"
        ],
        [
          "ticket desk",
          "slack",
          "where should",
          "which channel",
          "go to"
        ]
      ]
    },
    {
      "id": "answer-security-privacy-containment",
      "decision": "answer_from_approved_article",
      "article_id": "opt-out-dnc-and-security-escalation",
      "reason": "Approved opt-out/DNC article includes conservative security/privacy containment for exposed sensitive details.",
      "match_any_groups": [
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
      ]
    },
    {
      "id": "answer-opt-out-dnc",
      "decision": "answer_from_approved_article",
      "article_id": "opt-out-dnc-and-security-escalation",
      "reason": "Approved opt-out/DNC article covers STOP replies, DNC checks, call cancellation, and immediate privacy/security routing.",
      "match_any": [
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
      ]
    },
    {
      "id": "answer-outbound-20-percent",
      "decision": "answer_from_approved_article",
      "article_id": "twenty-percent-dial-out-sop",
      "reason": "Approved 20 percent article covers Keap check, 30-day ownership, first-booking rule, and reassignment boundary.",
      "match_any_groups": [
        [
          "20 percent",
          "20%",
          "30-day ownership",
          "30 day ownership",
          "31 days",
          "31 day",
          "lead ownership",
          "ownership window",
          "another rep call",
          "another rep can call",
          "another rep speak",
          "another rep can speak",
          "first booking"
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
          "booked",
          "contact",
          "logged",
          "call",
          "speak"
        ]
      ]
    },
    {
      "id": "answer-qualification-show-fit",
      "decision": "answer_from_approved_article",
      "article_id": "qualification-and-show-fit-rubric",
      "reason": "Approved qualification article covers doctors/hospital employment, nurses, regulated categories, and route boundaries for sensitive fit cases.",
      "match_any": [
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
        "dispensary",
        "dispensaries",
        "marijuana",
        "weed business",
        "adult content",
        "political business",
        "firearms",
        "prison",
        "jail",
        "fraud",
        "felony",
        "organized fraud",
        "bail bonds",
        "bounty hunter",
        "motivational speaker",
        "personal brand",
        "background issue",
        "gun crime",
        "hemp",
        "hemp business",
        "11 years old",
        "minor with parent",
        "mum is in the background"
      ]
    },
    {
      "id": "answer-contract-link-boundary",
      "decision": "answer_from_approved_article",
      "article_id": "contracts-edits-and-signature-process",
      "reason": "Approved contract article covers sending current contract links and the no-edit boundary.",
      "match_any": [
        "send the contract link",
        "send contract link",
        "current contract link",
        "can i send the contract",
        "contract is set",
        "contract terms",
        "contract before call 2",
        "send a contract before call 2",
        "send contract before call 2"
      ]
    },
    {
      "id": "answer-main-istv-call-2-cohort",
      "decision": "answer_from_approved_article",
      "article_id": "main-istv-call-2-cohort-reschedule-rules",
      "reason": "Approved main ISTV cohort article covers same-week Call 2 reschedules, next-week approval, and proof exceptions.",
      "match_any_groups": [
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
      ]
    },
    {
      "id": "answer-payment-failed-boundary",
      "decision": "answer_from_approved_article",
      "article_id": "payment-plan-and-link-boundaries",
      "reason": "Approved payment article covers failed-payment follow-up boundary and same-day discount carry-forward after initial payment.",
      "match_any": [
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
      ]
    },
    {
      "id": "answer-events-mastermind",
      "decision": "answer_from_approved_article",
      "article_id": "events-mastermind-red-carpet",
      "reason": "Approved event article covers package access and the $200 non-refundable Mastermind food/drink fee while routing logistics.",
      "match_any": [
        "mastermind",
        "red carpet",
        "event fee",
        "red-carpet",
        "food and drinks",
        "non-refundable fee"
      ]
    },
    {
      "id": "answer-post-sale-handoff",
      "decision": "answer_from_approved_article",
      "article_id": "post-sale-handoff-after-close",
      "reason": "Approved post-sale article covers payment, signature, onboarding email, onboarding call, PayMe, and ACH boundary.",
      "match_any_groups": [
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
      ]
    },
    {
      "id": "answer-americas-top-lawyers-passoff",
      "decision": "answer_from_approved_article",
      "article_id": "americas-top-lawyers-passoff-boundary",
      "reason": "Approved Top Lawyers article covers passoff/dummy-channel approval and Video 2 boundary.",
      "match_any": [
        "america's top lawyers",
        "americas top lawyers",
        "top lawyers",
        "lawyer calls",
        "lawyers calls",
        "passoff channel",
        "dummy-call channel",
        "dummy call channel",
        "video 2 lawyers"
      ]
    },
    {
      "id": "answer-scam-bad-reviews",
      "decision": "answer_from_approved_article",
      "article_id": "platform-proof-and-claims-boundaries",
      "reason": "Approved platform/proof article covers brief scam/bad-review objection wording and UK name-confusion context.",
      "match_any": [
        "bad reviews",
        "scam",
        "pay to play",
        "trustpilot",
        "glassdoor",
        "reddit",
        "inside success uk",
        "insidesuccesstv",
        "inside success tv reviews"
      ]
    },
    {
      "id": "answer-vendor-value-boundary",
      "decision": "answer_from_approved_article",
      "article_id": "platform-proof-and-claims-boundaries",
      "reason": "Approved platform/proof article covers vendor/value/ROI comparison boundaries.",
      "match_any": [
        "vendor comparison",
        "cheaper production",
        "cost to produce",
        "perceived value",
        "value comparison",
        "roi",
        "leads or roi",
        "business results"
      ]
    },
    {
      "id": "answer-apple-tv-extra-boundary",
      "decision": "answer_from_approved_article",
      "article_id": "platform-proof-and-claims-boundaries",
      "reason": "Approved platform/proof article covers no guaranteed Apple TV streaming-app placement or paid extra submission.",
      "match_any": [
        "pay extra for apple tv",
        "extra apple tv",
        "apple tv submission",
        "guarantee apple tv",
        "apple tv streaming app"
      ]
    },
    {
      "id": "answer-call-1-pricing-boundary",
      "decision": "answer_from_approved_article",
      "article_id": "call-1-flow",
      "reason": "Approved Call 1 article covers the default no-pricing rule and the narrow disqualification exception confirmed by Rich.",
      "match_any_groups": [
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
      ]
    },
    {
      "id": "answer-current-show-source",
      "decision": "answer_from_approved_article",
      "article_id": "current-show-source",
      "reason": "Approved article answers the latest approved show list and where updates are maintained.",
      "match_any": [
        "current active show list",
        "current show list",
        "active show list",
        "where should i check",
        "all tv shows",
        "list of all tv shows",
        "tv shows that we do",
        "shows that we do",
        "shows we offer",
        "list of shows we offer",
        "shows we currently offer",
        "shows we have",
        "list of shows we have",
        "what shows do we do",
        "list all shows",
        "all shows we do",
        "america's authors episode",
        "americas authors episode",
        "legacy makers docs",
        "docs for legacy makers"
      ]
    },
    {
      "id": "answer-refund-split",
      "decision": "answer_from_approved_article",
      "article_id": "refund-rules-by-product",
      "reason": "Approved refund article covers current refund split by product.",
      "match_any": [
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
      ]
    },
    {
      "id": "answer-platform-and-claims",
      "decision": "answer_from_approved_article",
      "article_id": "platform-proof-and-claims-boundaries",
      "reason": "Approved platform/proof article covers platform wording and banned claims.",
      "match_any": [
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
      ]
    },
    {
      "id": "answer-pricing-and-same-day-discount",
      "decision": "answer_from_approved_article",
      "article_id": "istv-nlceo-pricing-and-same-day-discount",
      "reason": "Approved pricing article covers ISTV, NLCEO, and same-day discount boundaries.",
      "match_any": [
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
      ]
    },
    {
      "id": "answer-payment-boundaries",
      "decision": "answer_from_approved_article",
      "article_id": "payment-plan-and-link-boundaries",
      "reason": "Approved payment article covers custom-plan/link/card-detail boundaries.",
      "match_any": [
        "payment link",
        "official payment link",
        "which payment link",
        "what payment link",
        "payment methods",
        "custom payment plan",
        "custom payment plans",
        "custom plan",
        "custom plans",
        "custom installment",
        "custom installments",
        "custom split",
        "custom splits",
        "custom amount",
        "custom amounts",
        "custom payment link",
        "custom payment terms",
        "custom terms",
        "different split",
        "different payment split",
        "different payment plan",
        "different installment",
        "different amount",
        "card details",
        "card number",
        "raw card",
        "client card",
        "paste it in slack"
      ]
    },
    {
      "id": "answer-internal-materials",
      "decision": "answer_from_approved_article",
      "article_id": "internal-material-sharing-boundaries",
      "reason": "Approved internal-material article covers external sharing boundaries.",
      "match_any": [
        "internal slack screenshot",
        "slack screenshot",
        "share internal docs",
        "internal docs",
        "share internal",
        "training video",
        "internal materials"
      ]
    },
    {
      "id": "answer-platform-hosting-duration",
      "decision": "answer_from_approved_article",
      "article_id": "platform-hosting-and-client-license-duration",
      "reason": "Approved content-rights article covers platform hosting and license duration.",
      "match_any": [
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
      ]
    },
    {
      "id": "answer-recording-storage",
      "decision": "answer_from_approved_article",
      "article_id": "call-recording-storage-and-access",
      "reason": "Approved recording article covers automatic Zoom recording and access via recording link.",
      "match_any": [
        "recorded automatically",
        "access a call recording",
        "sales calls recorded",
        "call recordings stored",
        "recordings stored",
        "where are call recordings",
        "zoom recordings",
        "access zoom recordings"
      ]
    },
    {
      "id": "answer-americas-authors-episode-availability",
      "decision": "answer_from_approved_article",
      "article_id": "current-show-source",
      "reason": "Madeline-confirmed guidance covers America's Authors episode availability and how to correct an accidental episode-link promise.",
      "match_any_groups": [
        [
          "america's authors",
          "americas authors"
        ],
        [
          "episode",
          "episodes",
          "aired",
          "watch",
          "google"
        ]
      ]
    },
    {
      "id": "answer-legacy-makers-dj-passoff",
      "decision": "answer_from_approved_article",
      "article_id": "current-show-source",
      "reason": "Madeline-confirmed guidance covers Legacy Makers info requests and the DJ-side passoff boundary.",
      "match_any_groups": [
        [
          "legacy makers",
          "legacymakers"
        ],
        [
          "docs",
          "info",
          "information",
          "daymond john",
          "dj side",
          "sell"
        ]
      ]
    },
    {
      "id": "answer-pre-audition-video-sharing",
      "decision": "answer_from_approved_article",
      "article_id": "internal-material-sharing-boundaries",
      "reason": "Madeline-confirmed guidance says pre-audition videos cannot be sent out manually.",
      "match_any_groups": [
        [
          "pre-audition video",
          "pre audition video",
          "video before her audition",
          "video before audition",
          "before her audition",
          "receives before her audition"
        ],
        [
          "send",
          "send over",
          "find",
          "get that video",
          "get the video"
        ]
      ]
    },
    {
      "id": "answer-rebrand-examples",
      "decision": "answer_from_approved_article",
      "article_id": "platform-proof-and-claims-boundaries",
      "reason": "Madeline-confirmed guidance says Sales Ops has a VIP conversion page example, but the bot should not invent a full proof/example library.",
      "match_any_groups": [
        [
          "rebrand examples",
          "webpage and social rebrand",
          "social rebrand",
          "conversion page example"
        ],
        [
          "$30k",
          "30k",
          "vip",
          "license"
        ]
      ]
    },
    {
      "id": "answer-license-options-document",
      "decision": "answer_from_approved_article",
      "article_id": "istv-nlceo-pricing-and-same-day-discount",
      "reason": "Madeline-confirmed guidance says the License Options document/reuse license doc is not advised as the default comparison tool.",
      "match_any_groups": [
        [
          "license options document",
          "license options doc",
          "reuse license doc",
          "reuse license document"
        ],
        [
          "send",
          "allowed",
          "compare",
          "lite",
          "standard"
        ]
      ]
    },
    {
      "id": "answer-dj-nlceo-book-out-timing",
      "decision": "answer_from_approved_article",
      "article_id": "istv-nlceo-pricing-and-same-day-discount",
      "reason": "Madeline-confirmed guidance says DJ/NLCEO applicants are not under the main ISTV cohort rule and can book Call 2 out a few weeks if needed.",
      "match_any_groups": [
        [
          "daymond john",
          "next level ceo",
          "dj",
          "nlceo"
        ],
        [
          "book out a few weeks",
          "funds unavail",
          "funds unavailable",
          "aug 15",
          "august 15",
          "need until august",
          "few weeks for call2",
          "few weeks for call 2"
        ]
      ]
    },
    {
      "id": "answer-four-pay-mastermind-filming",
      "decision": "answer_from_approved_article",
      "article_id": "events-mastermind-red-carpet",
      "reason": "Madeline-confirmed guidance says 4-pay/August filming/Mastermind timing should be posted in fulfillment hotline to double-check.",
      "match_any_groups": [
        [
          "4-pay",
          "4 pay",
          "four pay",
          "payment plan"
        ],
        [
          "film in august",
          "filming in august",
          "mastermind",
          "not pif",
          "episode won't be pif"
        ]
      ]
    },
    {
      "id": "answer-short-notice-onboarding",
      "decision": "answer_from_approved_article",
      "article_id": "post-sale-handoff-after-close",
      "reason": "Mike/Rich-approved guidance says same-day onboarding bookings do not require separate notification when required post-sale steps are complete.",
      "match_any": [
        "short notice onboarding",
        "same day onboarding",
        "onboarding today"
      ]
    }
  ]
};

export const ASK_SALES_FAQ_BUNDLE_META = {
  schemaVersion: 1,
  generatedFrom: "Inside-Success/faq-chatbot@same-day-onboarding-approval-2026-07-09",
  generatedAt: "2026-07-09",
  approvedArticleCount: APPROVED_FAQ_ARTICLES.length,
};
