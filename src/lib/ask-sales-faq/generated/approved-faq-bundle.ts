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
    id: "current-show-source",
    title: "Current Show Source",
    category: "Offers, Pricing & Packages",
    riskLevel: "high",
    approvedBy: "Syed Moonis Haider",
    approvedAt: "2026-06-30",
    approvalReference: "FAQ Bot - Recommended Answers Pack 1 review status; Luke Gent show-source note shared by user on 2026-06-30",
    lastReviewed: "2026-06-30",
    body: String.raw`## Answer

Use the latest approved show list below when a rep asks what shows we currently do.

The internal maintenance source for show changes is project operations, where new shows are added. Normal reps may not have access to that channel, so the bot should answer from this approved list and route only brand-new, paused, disputed, or missing-show status questions to the current sales/ops owner.

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

## What Reps Must Not Say

- Do not rely on old show lists, old dropdowns, old examples, or public pages as the final source.
- Do not tell reps to check project operations directly if they do not have access.
- Do not promise that a newly mentioned, paused, missing, or disputed show is active unless it is confirmed by the current sales/ops owner.
- Do not treat this list as permanently current after a new approved update supersedes it.

## Route If Unclear

If a rep asks about a show that is not on this list, a show that may have just launched, a show that may be paused, or a show missing from a dropdown/form, route to the current sales/ops owner instead of guessing.`,
  },
  {
    id: "internal-material-sharing-boundaries",
    title: "Internal Material Sharing Boundaries",
    category: "Compliance, Proof & Claims",
    riskLevel: "high",
    approvedBy: "Syed Moonis Haider",
    approvedAt: "2026-06-30",
    approvalReference: "FAQ Bot - Recommended Answers Pack 1 review status; Syed approved internal/confidential material boundary",
    lastReviewed: "2026-06-30",
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

If a prospect or client asks for material that looks internal, route to the source owner/compliance owner before sharing.`,
  },
  {
    id: "istv-nlceo-pricing-and-same-day-discount",
    title: "ISTV, Next Level CEO Pricing, And Same-Day Discount",
    category: "Offers, Pricing & Packages",
    riskLevel: "high",
    approvedBy: "Syed Moonis Haider",
    approvedAt: "2026-06-30",
    approvalReference: "FAQ Bot - Recommended Answers Pack 1 review status; Magic Mike ISTV context pack reviewed by Syed",
    lastReviewed: "2026-06-30",
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

Next Level CEO / Daymond John pricing:

| Package | Price |
| --- | ---: |
| Lite | $10,000 |
| Standard | $15,000 |
| Premium VIP | $20,000 |
| CEO Day upgrade | $5,000 |

Same-day discount:

- The same-day discount applies only to the main ISTV program.
- It applies only on Call 2 when the client closes and pays the initial deposit on that Call-2 closing call.
- It is $2,000 off the main ISTV program.
- It does not apply to Next Level CEO / Daymond John.

## What Reps Can Say

- Use the listed package prices and listed payment plans above.
- For same-day discount, keep the rule tied to Call 2 and initial deposit timing.

## What Reps Must Not Say

- Do not invent payment splits, custom amounts, special discounts, or exception terms.
- Do not apply the same-day discount to Next Level CEO / Daymond John.
- Do not promise a second-show, crossover, VIP-to-VIP, or special discount unless a separate approved article covers that exact case.
- Do not quote old/spare pricing videos as current.

## Pending Or Excluded

The older Standard 3-payment split that totals $21,000 is intentionally not listed here. If someone asks about it, route to the current offer owner before quoting it.

Second-show, crossover, and special-discount rules remain pending Rich/owner confirmation.`,
  },
  {
    id: "payment-plan-and-link-boundaries",
    title: "Payment Plan And Link Boundaries",
    category: "Payments, Refunds & Contracts",
    riskLevel: "high",
    approvedBy: "Syed Moonis Haider",
    approvedAt: "2026-06-30",
    approvalReference: "FAQ Bot - Recommended Answers Pack 1 review status; Magic Mike ISTV context pack reviewed by Syed",
    lastReviewed: "2026-06-30",
    body: String.raw`## Answer

Reps should use only current official payment links and listed payment plans.

Custom amounts, custom payment plans, custom payment links, wire/ACH/invoice exceptions, and other payment exceptions are not rep-approved decisions. They must be routed.

Reps should not collect raw card details directly from clients.

## What Reps Can Say

- "Use the current official payment link and the listed payment plan for that package."
- "If the client needs a custom amount, custom split, wire/ACH, invoice, or payment exception, I need to route that instead of making a promise."

## What Reps Must Not Do

- Do not create custom payment terms.
- Do not create or substitute payment links.
- Do not paste raw card numbers, bank details, payment details, or sensitive client financial information into Slack, the chatbot, notes, or local files.
- Do not tell a client that a wire/ACH/invoice/custom split is allowed unless the current approved route confirms it.

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
    lastReviewed: "2026-06-30",
    body: String.raw`## Answer

Approved platform wording:

- All tiers air on the Inside Success Network app.
- The Inside Success Network app is accessible on Roku, Fire Stick, and Apple TV physical devices.
- This is not the Apple TV streaming app/channel and not the Amazon streaming app.
- VIP / Premium is submitted to one Tier-1 streaming platform: Amazon Prime Video, Apple TV streaming app, or Tubi.
- Tier-1 placement is a platform decision and is not guaranteed.
- ISTV does not work directly with Amazon or Apple. A third party helps with those submissions.

## What Reps Can Say

- "All tiers air on the Inside Success Network app."
- "VIP/Premium includes submission to one Tier-1 platform, but placement is not guaranteed because the platform decides."

## What Reps Must Not Say

- Do not guarantee Amazon, Apple TV streaming app, Tubi, or any other Tier-1 placement.
- Do not say ISTV works directly with Amazon or Apple.
- Do not promise ROI, revenue, leads, fundraising, PR outcomes, platform placement, views, demographics, celebrity outcomes, or guaranteed business results.
- Do not use unsupported public proof, old examples, screenshots, dashboards, or stats decks as proof.

## Route If Asked For Proof Links Or Claims

If the rep needs reviews, press, episode examples, celebrity proof, view language, bad-review responses, scam/pay-to-play objection wording, or approved public proof links, route to the approved proof/source owner until the current proof pack is approved.`,
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
        ["knowledge system", "sales rule", "rule changes"],
        ["watch", "slack channels"],
      ],
    },
    {
      id: "admin-rule-no-raw-slack-auto-approval",
      decision: "admin_only",
      article_id: "current-sales-rule-update-channels",
      reason: "Raw Slack may signal changes, but it cannot bypass article approval.",
      match_any_groups: [
        ["slack post", "raw slack", "slack"],
        ["update the kb", "automatically", "without approval"],
      ],
    },
  ],
  abstainRules: [
    {
      id: "abstain-call-1-pricing-boundary",
      decision: "abstain_unapproved",
      blocked_topic: "call-1-flow",
      reason: "Call 1 pricing/investment boundary is still pending Rich confirmation.",
      match_any_groups: [["call 1"], ["pricing", "investment", "price", "$20,000", "$20000"]],
    },
    {
      id: "abstain-call-2-handoff",
      decision: "abstain_unapproved",
      blocked_topic: "call-2-close-and-license-flow",
      reason: "Exact post-payment/signature handoff steps are not approved.",
      match_any_groups: [["handoff", "welcome", "onboarding"], ["payment", "signature"]],
    },
    {
      id: "abstain-contract-edits",
      decision: "abstain_unapproved",
      blocked_topic: "contracts-edits-and-signature-process",
      reason: "Contract edits, addenda, and legal review handling are not approved for bot answers.",
      match_any: ["edit contract", "contract language", "addendum", "attorney review", "full contract before payment"],
    },
    {
      id: "abstain-outbound-20-percent",
      decision: "abstain_unapproved",
      blocked_topic: "twenty-percent-dial-out-sop",
      reason: "20 percent lead ownership and list limits are pending owner confirmation.",
      match_any_groups: [["20 percent"], ["lead", "leads", "claim", "commenting"]],
    },
    {
      id: "abstain-greenlight",
      decision: "abstain_unapproved",
      blocked_topic: "greenlight-pdf-and-cohort-deadlines",
      reason: "Greenlight caps, cohort deadlines, no-shows, and reapply rules are not approved.",
      match_any: ["greenlight", "approval cap", "reapply", "no show", "no-show", "cohort deadline"],
    },
    {
      id: "abstain-sensitive-qualification",
      decision: "abstain_unapproved",
      blocked_topic: "qualification-and-show-fit-rubric",
      reason: "Sensitive qualification and show-fit questions must route to sales leadership/compliance.",
      match_any: ["criminal history", "automatically disqualified", "cannabis", "adult content", "political business", "firearms", "minors"],
    },
    {
      id: "abstain-sales-tech-routing",
      decision: "abstain_unapproved",
      blocked_topic: "sales-tech-routing-and-support-requests",
      reason: "Sales-tech Slack vs ticket-desk routing is not confirmed.",
      match_any_groups: [["sales-tech", "sales tech"], ["ticket desk", "slack"]],
    },
    {
      id: "abstain-calendar-routing",
      decision: "abstain_unapproved",
      blocked_topic: "calendars-recordings-and-zoom-phone",
      reason: "Calendar/rebooking routing is not approved.",
      match_any_groups: [["calendar"], ["rebooking", "link"]],
    },
    {
      id: "abstain-zoom-phone",
      decision: "abstain_unapproved",
      blocked_topic: "calendars-recordings-and-zoom-phone",
      reason: "Zoom Phone troubleshooting is not approved.",
      match_any: ["zoom phone", "caller id"],
    },
    {
      id: "abstain-opt-out-dnc",
      decision: "abstain_unapproved",
      blocked_topic: "opt-out-dnc-and-security-escalation",
      reason: "Opt-out/DNC behavior is compliance-sensitive and not approved.",
      match_any: ["replied stop", "reply stop", "keep texting", "booked a call"],
    },
    {
      id: "abstain-event-mastermind",
      decision: "abstain_unapproved",
      blocked_topic: "events-mastermind-red-carpet",
      reason: "Event, Mastermind, and red-carpet terms are time-sensitive and pending owner confirmation.",
      match_any: ["mastermind", "red carpet", "event fee", "current event", "red-carpet"],
    },
    {
      id: "abstain-new-rep-onboarding",
      decision: "abstain_unapproved",
      blocked_topic: "new-rep-onboarding-and-final-mock",
      reason: "New-rep onboarding and final mock requirements are not approved for runtime answers.",
      match_any: ["new reps", "final mock", "new rep"],
    },
    {
      id: "abstain-security-privacy-incident",
      decision: "abstain_unapproved",
      blocked_topic: "opt-out-dnc-and-security-escalation",
      reason: "Payment-detail leakage is a security/privacy issue and must route.",
      match_any_groups: [["pasted", "accidentally"], ["payment details", "card details", "client payment"]],
    },
  ],
  routeRules: [
    {
      id: "route-current-show-status",
      decision: "route_from_approved_article",
      article_id: "current-show-source",
      reason:
        "Current show status can drift; answer from the approved list and route newly added, paused, disputed, or missing-show cases to the current sales/ops owner.",
      match_any: ["is love experts active", "currently active", "active right now", "missing from the dropdown", "paused"],
    },
    {
      id: "route-stale-standard-split",
      decision: "route_from_approved_article",
      article_id: "istv-nlceo-pricing-and-same-day-discount",
      reason: "The old Standard 3 x $7,000 split is intentionally excluded from approved terms.",
      match_any: ["3 payments of $7,000", "3 payments of 7000", "standard as 3 payments", "$21,000"],
    },
    {
      id: "route-special-discounts",
      decision: "route_from_approved_article",
      article_id: "istv-nlceo-pricing-and-same-day-discount",
      reason: "Second-show, crossover, and special discounts remain pending Rich/owner confirmation.",
      match_any: ["second-show", "second show", "crossover discount", "special discount"],
    },
    {
      id: "route-refund-exceptions",
      decision: "route_from_approved_article",
      article_id: "refund-rules-by-product",
      reason: "Refund/payment exceptions must route to the current owner.",
      match_any: ["paid but did not sign", "duplicate charge", "card was charged", "charged twice"],
    },
    {
      id: "route-wire-ach",
      decision: "route_from_approved_article",
      article_id: "payment-plan-and-link-boundaries",
      reason: "Wire/ACH/invoice exceptions are not rep-approved direct answers.",
      match_any: ["wire", "ach", "invoice"],
    },
    {
      id: "route-broken-payment-link",
      decision: "route_from_approved_article",
      article_id: "payment-plan-and-link-boundaries",
      reason: "Broken payment links route to the current finance/sales-tech route.",
      match_any: ["payment link is broken", "broken payment link", "link is broken"],
    },
    {
      id: "route-proof-links",
      decision: "route_from_approved_article",
      article_id: "platform-proof-and-claims-boundaries",
      reason: "Public proof links and objection wording need approved source-owner material.",
      match_any: ["public proof", "proof links", "reviews and press", "bad reviews", "scam", "pay to play"],
    },
    {
      id: "route-client-recording-share",
      decision: "route_from_approved_article",
      article_id: "internal-material-sharing-boundaries",
      reason: "External sharing of call recordings needs explicit approval.",
      match_any_groups: [["call recording", "recording"], ["client wants", "send"]],
    },
    {
      id: "route-content-usage-details",
      decision: "route_from_approved_article",
      article_id: "platform-hosting-and-client-license-duration",
      reason: "Detailed content usage rights need legal/contracts-approved wording.",
      match_any: ["upload the full episode", "youtube", "run ads", "clips", "trailer"],
    },
    {
      id: "route-recording-access-issue",
      decision: "route_from_approved_article",
      article_id: "call-recording-storage-and-access",
      reason: "Missing or denied recording access routes to the recording owner.",
      match_any: ["recording link is missing", "do not have access", "access denied", "missing recording link"],
    },
  ],
  answerRules: [
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
        "all shows we do",
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
        "daymond john refund",
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
        "business results",
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
        "same day discount",
        "main istv call 2",
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
        "paste it in slack",
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
        "internal materials",
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
        "stays on istv forever",
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
        "access zoom recordings",
      ],
    },
  ],
};

export const ASK_SALES_FAQ_BUNDLE_META = {
  schemaVersion: 1,
  generatedFrom: "Inside-Success/faq-chatbot@da91baf",
  generatedAt: "2026-07-01",
  approvedArticleCount: APPROVED_FAQ_ARTICLES.length,
};
