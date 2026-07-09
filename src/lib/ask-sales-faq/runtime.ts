import type {
  AskSalesFaqChatMessage,
  AskSalesFaqOutcome,
  AskSalesFaqResponse,
  AskSalesFaqRuntimeMetadata,
  AskSalesFaqStructuredAnswer,
} from "@/lib/ask-sales-faq/types";
import {
  APPROVED_FAQ_ARTICLES,
  ASK_SALES_FAQ_POLICY_RULES,
  type ApprovedFaqArticle,
  type AskSalesFaqRule,
} from "@/lib/ask-sales-faq/generated/approved-faq-bundle";
import {
  buildAnswerPlan,
  type ApprovedPolicyUnit,
  type ApprovedPolicyUnitsDocument,
  type AskSalesAnswerPlan,
} from "@/lib/ask-sales-faq/answer-plan";
import { buildQuestionFrame, type QuestionFrame } from "@/lib/ask-sales-faq/question-frame";
import approvedPolicyUnits from "@/lib/ask-sales-faq/generated/approved-policy-units.json";
import ragIndex from "@/lib/ask-sales-faq/generated/policy-aware-rag-index.json";

type RagChunk = {
  id: string;
  source_type: "approved_article" | "curated_kb_article" | "curated_slack_evidence" | "governance_log" | "training_transcript";
  source_path: string;
  source_title: string;
  heading: string;
  article_id: string | null;
  article_status: string;
  category: string;
  risk_level: "low" | "medium" | "high" | string;
  authority: number;
  trust_label: string;
  last_reviewed: string;
  text: string;
};

type IndexedChunk = RagChunk & {
  normalized: string;
  tokens: string[];
  tokenSet: Set<string>;
};

type EvidenceCandidate = {
  id: string;
  kind: "approved_article" | "source_chunk";
  articleId: string | null;
  articleStatus: string;
  sourceType: RagChunk["source_type"] | "approved_article";
  sourceTitle: string;
  heading: string;
  category: string;
  riskLevel: string;
  authority: number;
  trustLabel: string;
  lastReviewed: string;
  text: string;
  score: number;
  matchedTokens: string[];
};

type RuntimeDecision = {
  outcome: AskSalesFaqOutcome;
  sourceMode: "approved" | "evidence" | "mixed" | "fallback" | "conversation";
  confidenceLabel: "High" | "Medium" | "Low";
  confidenceScore: number;
  reason: string;
  routeReason: string | null;
  safeToGenerate: boolean;
  matchedRuleId: string;
  matchedArticleId: string | null;
  primaryArticle: ApprovedFaqArticle | null;
  retrieved: EvidenceCandidate[];
};

type PolicyGuardDecision = {
  decision: AskSalesFaqRule["decision"] | "abstain_unapproved";
  safeToGenerate: boolean;
  articleId: string | null;
  blockedTopic: string | null;
  matchedRuleId: string;
  reason: string;
  primaryArticle: ApprovedFaqArticle | null;
  routingSource: "direct_rule" | "context_rule" | "article_router" | "conversation_planner" | "default";
  routingConfidence?: number;
  usedConversationContext?: boolean;
};

type ModelOutput = {
  answer: string;
  summary?: string;
  sections?: Array<{ title?: string; body?: string; items?: string[]; tone?: string }>;
  selected_source_ids?: string[];
  needs_route: boolean;
  route_reason: string;
  confidence_label?: "High" | "Medium" | "Low";
  confidence_score?: number;
  display?: {
    plainSummaryOnly?: boolean;
  };
};

type ArticleRouterOutput = {
  article_id?: string | null;
  confidence_score?: number | string | null;
  reason?: string | null;
};

type ConversationPlannerOutput = {
  mode: "conversation_reply" | "approved_article" | "unsupported";
  answer?: string;
  summary?: string;
  sections?: ModelOutput["sections"];
  article_id?: string | null;
  confidence_score?: number | string | null;
  confidence_label?: "High" | "Medium" | "Low";
  needs_route?: boolean;
  route_reason?: string;
  reason?: string | null;
};

type GroundingCheckOutput = {
  verdict: "pass" | "fail";
  reason?: string;
};

type ProviderJsonResult<T> = {
  provider: "deepseek" | "anthropic";
  model: string;
  output: T;
  diagnostics: ProviderCallDiagnostics;
};

type ProviderCallDiagnostics = {
  purpose: string;
  attempts: NonNullable<AskSalesFaqRuntimeMetadata["providerAttempts"]>;
  deepSeekThinkingDisabled: boolean;
  claudeFallbackEnabled: boolean;
  promptChars: number;
  maxTokens: number;
};

type ModelOutputResolution = {
  output: ModelOutput;
  diagnostics: ProviderCallDiagnostics[];
  fallbackUsed?: boolean;
};

export type AskSalesFaqRuntimeResult = AskSalesFaqResponse & {
  sanitizedQuestion: string;
  contextualQuestion: string;
  matchedArticleId: string | null;
  errorClass: string | null;
  runtimeMetadata: AskSalesFaqRuntimeMetadata | null;
};

const STOPWORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "am",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "before",
  "by",
  "can",
  "could",
  "do",
  "does",
  "for",
  "from",
  "give",
  "had",
  "has",
  "have",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "should",
  "that",
  "the",
  "their",
  "them",
  "this",
  "to",
  "we",
  "what",
  "when",
  "where",
  "which",
  "who",
  "with",
  "you",
  "your",
]);

const QUERY_EXPANSIONS: Array<{ triggers: string[]; add: string[] }> = [
  { triggers: ["pay", "payment", "payments", "plan", "plans"], add: ["price", "pricing", "package", "link", "deposit"] },
  { triggers: ["dj", "daymond", "john"], add: ["daymond", "john", "next", "level", "ceo"] },
  { triggers: ["nlceo", "next", "level"], add: ["next", "level", "ceo", "daymond", "john"] },
  { triggers: ["price", "pricing", "cost", "package", "packages"], add: ["istv", "payment", "plans", "lite", "standard", "premium"] },
  { triggers: ["discount", "discounts", "2000", "$2000", "$2,000"], add: ["same", "day", "call", "2", "pricing", "offer"] },
  { triggers: ["show", "shows", "tv"], add: ["current", "active", "list"] },
  { triggers: ["refund", "refunds"], add: ["next", "level", "ceo", "daymond", "istv"] },
  { triggers: ["apple", "amazon", "tubi", "tier", "guaranteed"], add: ["platform", "placement", "proof", "claims"] },
  { triggers: ["recording", "recordings"], add: ["zoom", "stored", "access"] },
  { triggers: ["upgrade", "upgraded"], add: ["lite", "standard", "vip", "premium", "same", "day", "discount", "filming"] },
  { triggers: ["call", "pricing"], add: ["call", "1", "price", "investment", "disqualify", "qualified"] },
  { triggers: ["31", "ownership", "assigned", "keap"], add: ["20", "percent", "lead", "ownership", "contact", "logged"] },
];

const SCOPED_EVIDENCE_WEAK_TOKENS = new Set([
  "answer",
  "approved",
  "article",
  "ask",
  "call",
  "calls",
  "case",
  "cases",
  "client",
  "clients",
  "confirm",
  "current",
  "faq",
  "owner",
  "rep",
  "reps",
  "route",
  "sales",
  "say",
  "source",
]);

const AI_UNAVAILABLE_RESPONSE =
  "I cannot generate a reliable answer right now. Do not guess from memory; route this to the current sales owner or the right help channel before replying.";

const JSON_SCHEMA_EXAMPLE =
  '{"answer":"Direct answer for the rep.","summary":"One-line summary.","sections":[{"title":"Answer","body":"Useful sales guidance.","tone":"default"}],"selected_source_ids":["approved:article-id"],"needs_route":false,"route_reason":"","confidence_label":"High","confidence_score":90}';

const DEFAULT_APPROVED_ARTICLE_PROMPT_CHARS = 7000;
const DEFAULT_SUPPORT_CHUNK_PROMPT_CHARS = 700;
const ARTICLE_ROUTER_MIN_CONFIDENCE = 82;
const ARTICLE_ROUTER_MAX_BODY_CHARS = 1600;
const ARTICLE_ROUTER_MAX_CONTEXT_CHARS = 2600;

const REP_FACING_INTERNAL_TERMS = [
  "not approved in the knowledge base",
  "not approved in kb",
  "knowledge base",
  "approved article",
  "approved faq article",
  "route-only",
  "route only",
  "manifest",
  "source coverage",
  "pending approval",
  "article status",
  "article id",
  "source id",
  "selected source",
  "governance log",
  "internal guidance",
  "slack evidence",
  "slack-sourced",
  "slack-level",
  "slack notes",
  "curated source evidence",
  "candidate answer",
  "decision candidates",
  "candidate q and a",
  "what the evidence says",
];

const REP_FACING_INTERNAL_PATTERNS = [
  /\bnot approved\b/i,
  /\bunapproved\b/i,
  /\bpending approval\b/i,
  /\bapproved (faq )?article\b/i,
  /\bknowledge base\b/i,
  /\broute[- ]only\b/i,
  /\bRAG\b/,
  /\bmanifest\b/i,
  /\bsource coverage\b/i,
  /\bsource id\b/i,
  /\bselected source\b/i,
  /\barticle[_ -]?id\b/i,
  /\bmatched[_ -]?rule[_ -]?id\b/i,
  /\bdefault[-_ ]abstain\b/i,
  /\bin_conflict\b/i,
  /\bgovernance log\b/i,
  /\binternal guidance\b/i,
  /\binternal discussions?\b/i,
  /\bthe evidence\b/i,
  /\bapproved evidence\b/i,
  /\bper (?:the )?approved\b/i,
  /\bapproved (?:event|sales|policy) guidance\b/i,
  /\bSlack(?:[- ]level|[- ]sourced)? (?:evidence|notes|guidance|discussion|source)/i,
  /\bcurated (?:Slack|source) evidence\b/i,
  /\b(?:Evidence|Source)\s+\d+\b/i,
  /\bwhat the evidence says\b/i,
  /\bcandidate answer\b/i,
  /\bdecision candidates\b/i,
  /\bcandidate q and a\b/i,
  /slack\/evidence\/\S+/i,
  /transcription\/transcripts\/\S+/i,
  /knowledge-base\/\S+/i,
  /\bapproved:[a-z0-9_-]+/i,
  /\bchunk:[a-z0-9_-]+/i,
];

const UNAPPROVED_HANDOFF_PATTERNS = [
  /\blet me connect (?:you|them|him|her|the client|the prospect) with\b/i,
  /\bconnect (?:you|them|him|her|the client|the prospect) with (?:our|a|the) specialist\b/i,
  /\bspecialist for (?:this|the) program\b/i,
  /\b(?:someone|a specialist|our specialist) (?:will|can) (?:reach out|contact|call|follow up)\b/i,
  /\btransfer (?:you|them|him|her|the client|the prospect) to (?:our|a|the) specialist\b/i,
  /\b(?:i will|i['’]ll) (?:connect with|make sure|ensure|send this|pass this|forward this|get this to)\b/i,
  /\bwe['’]ll get (?:this|that|it) reviewed\b/i,
];

type CriticalAnswerRule = {
  id: string;
  articleId: string;
  productScopes?: Array<QuestionFrame["scope"]>;
  matchAny?: string[];
  matchAnyGroups?: string[][];
  requiredAll?: string[];
  requiredAnyGroups?: string[][];
  forbiddenAny?: string[];
  fallback: ModelOutput;
};

const CRITICAL_ANSWER_RULES: CriticalAnswerRule[] = [
  {
    id: "qualification-regulated-cannabis-business",
    articleId: "qualification-and-show-fit-rubric",
    matchAny: ["cannabis", "dispensary", "dispensaries", "marijuana", "weed business", "regulated business"],
    requiredAnyGroups: [
      ["regulated, legal, licensed", "legal, licensed", "licensed"],
      ["positioned professionally", "professionally"],
      ["do not guarantee", "route", "before promising fit"],
    ],
    forbiddenAny: ["always allowed", "guarantee acceptance", "automatically approved", "green light him"],
    fallback: {
      answer:
        "Cannabis or dispensary businesses can be acceptable only when they are regulated, legal, licensed, and positioned professionally. Do not guarantee fit or approval on the call; route licensing, legal, reputation, or positioning concerns before promising fit.",
      summary: "Regulated cannabis businesses can be acceptable, but do not guarantee fit.",
      sections: [
        {
          title: "Answer",
          body: "Cannabis or dispensary businesses can be acceptable only when they are regulated, legal, licensed, and positioned professionally.",
          tone: "default",
        },
        {
          title: "Do not promise",
          body: "Do not guarantee fit or approval on the call. Route licensing, legal, reputation, or positioning concerns before promising fit.",
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:qualification-and-show-fit-rubric"],
      needs_route: true,
      route_reason: "Sensitive qualification or regulated-business fit should be confirmed before promising acceptance.",
      confidence_label: "High",
      confidence_score: 94,
    },
  },
  {
    id: "qualification-criminal-background-route",
    articleId: "qualification-and-show-fit-rubric",
    matchAny: [
      "background issue",
      "criminal history",
      "criminal charge",
      "came out of prison",
      "prison",
      "jail",
      "felony",
      "fraud",
      "organized fraud",
      "bail bonds",
      "bounty hunter",
    ],
    requiredAnyGroups: [
      ["route", "confirm", "sales leadership", "compliance"],
      ["criminal", "background", "reputation", "legal"],
      ["do not guarantee", "do not approve", "before promising fit", "before promising"],
    ],
    forbiddenAny: ["yes, you can cast", "safe to cast", "okay to cast", "approved to cast", "approve them"],
    fallback: {
      answer:
        "Do not approve this from the chatbot. A recent prison history, fraud allegation, bail-bonds/bounty-hunter positioning, or other criminal/legal/reputation concern needs to be routed to sales leadership or compliance before you promise fit. For DJ/NLCEO, criminal history is generally rejected except minor issues such as speeding or parking tickets. For main ISTV, only the listed serious red flags are automatic rejects, but criminal or reputation edge cases still need review before you move forward.",
      summary: "Criminal/background edge cases need owner review before promising fit.",
      sections: [
        {
          title: "What to do",
          body: "Route this to sales leadership or compliance before promising fit.",
          tone: "route",
        },
        {
          title: "Boundary",
          items: [
            "For DJ/NLCEO, criminal history is generally rejected except minor issues such as speeding or parking tickets.",
            "For main ISTV, only the listed serious red flags are automatic rejects, but criminal/legal/reputation edge cases still need review.",
          ],
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:qualification-and-show-fit-rubric"],
      needs_route: true,
      route_reason: "Criminal, legal, or reputation-sensitive qualification questions need sales leadership/compliance review.",
      confidence_label: "High",
      confidence_score: 94,
    },
  },
  {
    id: "call-1-pricing-default-and-disqualification-exception",
    articleId: "call-1-flow",
    matchAnyGroups: [
      ["call 1", "call one", "booked for tomorrow", "before attending", "attending"],
      ["price", "pricing", "investment", "price range", "minimum investment", "cost"],
    ],
    requiredAnyGroups: [
      ["do not discuss pricing", "save pricing", "keep pricing", "Call 2"],
      ["no business and is not financially qualified", "no business", "not financially qualified", "disqualify"],
      ["do not use that exception to pitch", "not to pitch", "not to close", "do not quote"],
    ],
    forbiddenAny: [
      "always quote",
      "give the price range",
      "minimum investment is 10k",
      "minimum investment is $10k",
      "minimum investment is $10,000",
    ],
    fallback: {
      answer:
        "For Call 1, do not quote a price or range in this situation. Keep pricing for Call 2. The only narrow exception is when you are sure the prospect has no business and is not financially qualified; then you may mention the investment only to disqualify them, not to pitch, close, negotiate, or create urgency.",
      summary: "Keep Call 1 pricing for Call 2 unless the narrow disqualification exception clearly applies.",
      sections: [
        {
          title: "Default rule",
          body: "For Call 1, do not quote a price or range. Keep pricing for Call 2.",
          tone: "warning",
        },
        {
          title: "Narrow exception",
          body: "Only if you are sure the prospect has no business and is not financially qualified, you may mention the investment only to disqualify them.",
          tone: "default",
        },
        {
          title: "Do not use it for",
          items: ["pitching", "closing", "negotiating", "pre-selling", "creating urgency"],
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:call-1-flow"],
      needs_route: true,
      route_reason: "If you are not sure both exception conditions are true, keep pricing for Call 2 or route to sales leadership.",
      confidence_label: "High",
      confidence_score: 95,
    },
  },
  {
    id: "dj-nlceo-no-cohort-deposit-boundary",
    articleId: "main-istv-call-2-cohort-reschedule-rules",
    productScopes: ["dj_nlceo"],
    matchAnyGroups: [
      ["daymond john", "next level ceo", "dj", "nlceo"],
      ["cohort", "deadline", "initial deposit", "deposit", "funds", "need time", "pay/sign", "pay and sign", "sign up"],
    ],
    requiredAll: ["no cohort rule"],
    requiredAnyGroups: [
      ["no same-day discount", "same-day discount"],
      ["do not apply the main ISTV cohort", "main ISTV cohort rule does not apply", "main ISTV cohort", "DJ/NLCEO has no cohort rule"],
      ["do not promise", "route", "approved payment"],
    ],
    forbiddenAny: [
      "same rule applies",
      "main ISTV deadline applies",
      "custom payment plan",
      "custom split",
      "you can give them until",
      "give them until",
      "you can let them wait until",
      "they can wait until",
      "can wait until",
      "can take until",
      "okay to wait until",
      "fine to wait until",
      "approved to wait until",
      "deadline is allowed",
      "does not require immediate payment on a specific call day",
      "start the payment plan when you're ready",
    ],
    fallback: {
      answer:
        "Because this is Daymond John / Next Level CEO, the main ISTV cohort rule does not apply. DJ/NLCEO has no cohort rule and no same-day discount. Use only the listed DJ/NLCEO payment options; if they cannot make the initial payment yet, do not invent a custom plan or promise a hold. Route any special exception or hold request to the current DJ/NLCEO owner.",
      summary: "DJ/NLCEO has no main ISTV cohort rule, but do not invent payment or hold exceptions.",
      sections: [
        {
          title: "Answer",
          body: "Because this is Daymond John / Next Level CEO, the main ISTV cohort rule does not apply. DJ/NLCEO has no cohort rule and no same-day discount.",
          tone: "default",
        },
        {
          title: "Payment boundary",
          body: "Use only the listed DJ/NLCEO payment options. If they cannot make the initial payment yet, do not invent a custom plan or promise a hold.",
          tone: "warning",
        },
        {
          title: "Route if needed",
          body: "Route any special exception or hold request to the current DJ/NLCEO owner.",
          tone: "route",
        },
      ],
      selected_source_ids: ["approved:main-istv-call-2-cohort-reschedule-rules"],
      needs_route: true,
      route_reason: "DJ/NLCEO cohort-like, pay/sign, deadline, or hold exceptions should go to the current DJ/NLCEO owner.",
      confidence_label: "High",
      confidence_score: 94,
    },
  },
  {
    id: "dj-nlceo-pricing-no-cohort-deposit-boundary",
    articleId: "istv-nlceo-pricing-and-same-day-discount",
    productScopes: ["dj_nlceo"],
    matchAnyGroups: [
      ["daymond john", "next level ceo", "dj", "nlceo"],
      [
        "cohort",
        "deadline",
        "initial payment",
        "first payment",
        "payment timing",
        "future payment date",
        "specific future payment date",
        "initial deposit",
        "deposit",
        "funds",
        "need time",
        "few weeks",
        "need a few weeks",
        "needs a few weeks",
        "delay first payment",
        "delay the first payment",
        "need time to get initial deposit",
        "needs time to get initial deposit",
        "pay/sign",
        "pay and sign",
        "sign up",
        "opportunity",
      ],
    ],
    requiredAll: ["no cohort rule"],
    requiredAnyGroups: [
      ["no same-day discount", "same-day discount"],
      ["do not apply", "main ISTV cohort", "main ISTV", "DJ/NLCEO has no cohort rule"],
      ["listed payment", "approved payment", "$2,500"],
    ],
    forbiddenAny: [
      "same rule applies",
      "main ISTV deadline applies",
      "custom payment plan",
      "custom split",
      "you can give them until",
      "give them until",
      "you can let them wait until",
      "they can wait until",
      "can wait until",
      "can take until",
      "okay to wait until",
      "fine to wait until",
      "approved to wait until",
      "deadline is allowed",
      "does not require immediate payment on a specific call day",
      "start the payment plan when you're ready",
    ],
    fallback: {
      answer:
        "For Daymond John / Next Level CEO, use only the listed payment options: Lite can be $10,000 PIF or $2,500 x 4. The main ISTV cohort rule does not apply to DJ/NLCEO, DJ/NLCEO has no cohort rule, and there is no same-day discount. If they cannot make the initial payment yet, do not invent a custom plan or promise a hold; route any special exception or hold request to the current DJ/NLCEO owner.",
      summary: "Use listed DJ/NLCEO payment options, and do not apply main ISTV cohort rules.",
      sections: [
        {
          title: "What you can offer",
          body: "For Daymond John / Next Level CEO Lite, use only the listed options: $10,000 PIF or $2,500 x 4.",
          tone: "default",
        },
        {
          title: "Cohort boundary",
          body: "The main ISTV cohort rule does not apply to DJ/NLCEO, DJ/NLCEO has no cohort rule, and there is no same-day discount.",
          tone: "warning",
        },
        {
          title: "If they need time",
          body: "Do not invent a custom plan or promise a hold. Route any special exception or hold request to the current DJ/NLCEO owner.",
          tone: "route",
        },
      ],
      selected_source_ids: ["approved:istv-nlceo-pricing-and-same-day-discount"],
      needs_route: true,
      route_reason: "DJ/NLCEO payment timing, hold, or exception requests should be confirmed with the current DJ/NLCEO owner.",
      confidence_label: "High",
      confidence_score: 94,
    },
  },
  {
    id: "pricing-ambiguous-payment-hold-product-check",
    articleId: "istv-nlceo-pricing-and-same-day-discount",
    productScopes: ["unknown"],
    matchAnyGroups: [
      ["ability to find", "payment holding", "pmt holding", "holding them back", "2.5k", "$2,500", "$2500"],
      ["call 2", "close", "closing", "opportunity", "payment", "pay", "deposit", "continue later"],
    ],
    requiredAnyGroups: [
      ["confirm whether this is main ISTV or DJ/NLCEO", "confirm main ISTV vs DJ/NLCEO", "First confirm"],
      ["main ISTV", "DJ/NLCEO", "Daymond John", "Next Level CEO"],
      ["do not promise", "route", "owner"],
    ],
    forbiddenAny: [
      "For a Next Level CEO / Daymond John applicant",
      "For Daymond John / Next Level CEO applicant",
      "Because this is Daymond John",
      "Because this is Next Level CEO",
      "approved to wait",
    ],
    fallback: {
      answer:
        "Is this for main ISTV or DJ/NLCEO? The payment-timing and cohort rules are different, so I do not want to apply the wrong policy.",
      summary: "Confirm main ISTV vs DJ/NLCEO before promising payment timing.",
      sections: [
        {
          title: "Product check",
          body: "Confirm whether this is main ISTV or DJ/NLCEO before applying a cohort/payment-timing rule.",
          tone: "default",
        },
      ],
      selected_source_ids: ["approved:istv-nlceo-pricing-and-same-day-discount"],
      needs_route: true,
      route_reason: "Payment timing, hold, or exception promises need the current owner when the listed plan/timing is not enough.",
      confidence_label: "High",
      confidence_score: 93,
    },
  },
  {
    id: "payment-no-custom-plans",
    articleId: "payment-plan-and-link-boundaries",
    matchAny: [
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
      "different amount",
      "different split",
      "different payment split",
      "different payment plan",
      "custom payment terms",
      "custom terms",
    ],
    requiredAnyGroups: [
      ["no", "cannot", "can't", "not allowed", "do not", "should not"],
      ["approved listed", "listed payment", "approved plans", "current spreadsheet", "spreadsheet", "official payment links"],
    ],
    forbiddenAny: ["#sales-finance-requests", "finance can approve", "must be routed", "route it", "routed"],
    fallback: {
      answer:
        "No. You cannot offer or suggest custom payment plans, custom splits, custom amounts, or custom payment links. Use only the approved listed payment plans and current official links from the spreadsheet/source.",
      summary: "Custom payment terms are not allowed; use only approved listed plans and links.",
      sections: [
        {
          title: "Answer",
          body: "No. You cannot offer or suggest custom payment plans, custom splits, custom amounts, or custom payment links.",
          tone: "warning",
        },
        {
          title: "What to use",
          body: "Use only the approved listed payment plans and current official links from the spreadsheet/source.",
          tone: "default",
        },
      ],
      selected_source_ids: ["approved:payment-plan-and-link-boundaries"],
      needs_route: false,
      route_reason: "",
      confidence_label: "High",
      confidence_score: 95,
    },
  },
  {
    id: "current-show-legacy-makers-materials-passoff",
    articleId: "current-show-source",
    matchAnyGroups: [
      ["legacy makers", "legacy maker"],
      ["doc", "docs", "document", "documents", "info", "information", "material", "materials"],
    ],
    requiredAll: ["Legacy Makers", "Sales Ops-approved", "DJ", "ISTV-assigned rep"],
    forbiddenAny: ["I do not have a confirmed answer", "DJ-side reps can sell Legacy Makers"],
    fallback: {
      answer:
        "Use the current Sales Ops-approved Legacy Makers materials. If you are on the DJ side, only sell Daymond John; pass any Legacy Makers or other ISTV-show interest to an ISTV-assigned rep.",
      summary: "Use the approved Legacy Makers materials and preserve the DJ-to-ISTV passoff boundary.",
      sections: [],
      selected_source_ids: ["approved:current-show-source"],
      needs_route: false,
      route_reason: "",
      confidence_label: "High",
      confidence_score: 96,
    },
  },
  {
    id: "contract-before-call-2-boundary",
    articleId: "contracts-edits-and-signature-process",
    matchAnyGroups: [
      ["contract", "contract link"],
      ["before call 2", "before call two", "prior to call 2", "early"],
    ],
    requiredAll: ["can send", "not advised"],
    forbiddenAny: [
      "cannot send",
      "only when leadership has approved",
      "only if leadership has approved",
      "requires leadership approval to send",
      "not recommended without leadership approval",
    ],
    fallback: {
      answer:
        "Yes, you can send the current contract before Call 2, but it is not advised as the default. Keep contract and payment mechanics in the normal close flow, and do not edit or promise changes to the contract.",
      summary: "The current contract can be sent before Call 2, but it is not the advised default.",
      sections: [],
      selected_source_ids: ["approved:contracts-edits-and-signature-process"],
      needs_route: false,
      route_reason: "",
      confidence_label: "High",
      confidence_score: 96,
    },
  },
  {
    id: "pricing-standard-upgrade-discount",
    articleId: "istv-nlceo-pricing-and-same-day-discount",
    productScopes: ["main_istv"],
    matchAnyGroups: [
      ["upgrade", "upgraded"],
      ["standard"],
      ["discount", "$2000", "$2,000", "same day"],
    ],
    requiredAll: ["carries forward"],
    requiredAnyGroups: [
      ["$18,000", "18000"],
      ["$8,000", "8000"],
    ],
    forbiddenAny: ["does not carry forward", "doesn't carry forward"],
    fallback: {
      answer:
        "Yes. For a main ISTV Lite client upgrading to Standard before filming, the $2,000 same-day discount carries forward. Discounted Standard is $18,000, so if they bought discounted Lite at $10,000, the difference is $8,000.",
      summary: "Main ISTV Lite-to-Standard upgrade keeps the same-day discount before filming.",
      sections: [
        {
          title: "Answer",
          body: "Yes. For a main ISTV Lite client upgrading to Standard before filming, the $2,000 same-day discount carries forward.",
          tone: "good",
        },
        {
          title: "Numbers",
          items: ["Discounted Standard total: $18,000.", "Difference from discounted Lite at $10,000: $8,000."],
          tone: "default",
        },
      ],
      selected_source_ids: ["approved:istv-nlceo-pricing-and-same-day-discount"],
      needs_route: false,
      route_reason: "",
      confidence_label: "High",
      confidence_score: 95,
    },
  },
  {
    id: "pricing-vip-upgrade-discount",
    articleId: "istv-nlceo-pricing-and-same-day-discount",
    productScopes: ["main_istv"],
    matchAnyGroups: [
      ["upgrade", "upgraded"],
      ["vip", "premium"],
      ["discount", "$2000", "$2,000", "same day"],
    ],
    requiredAll: ["carries forward"],
    requiredAnyGroups: [
      ["$28,000", "28000"],
      ["$18,000", "18000"],
    ],
    forbiddenAny: ["does not carry forward", "doesn't carry forward"],
    fallback: {
      answer:
        "Yes. For a main ISTV Lite client upgrading to VIP/Premium before filming, the $2,000 same-day discount carries forward. Discounted VIP/Premium is $28,000, so if they bought discounted Lite at $10,000, the difference is $18,000.",
      summary: "Main ISTV Lite-to-VIP/Premium upgrade keeps the same-day discount before filming.",
      sections: [
        {
          title: "Answer",
          body: "Yes. For a main ISTV Lite client upgrading to VIP/Premium before filming, the $2,000 same-day discount carries forward.",
          tone: "good",
        },
        {
          title: "Numbers",
          items: ["Discounted VIP/Premium total: $28,000.", "Difference from discounted Lite at $10,000: $18,000."],
          tone: "default",
        },
      ],
      selected_source_ids: ["approved:istv-nlceo-pricing-and-same-day-discount"],
      needs_route: false,
      route_reason: "",
      confidence_label: "High",
      confidence_score: 95,
    },
  },
  {
    id: "sales-tech-channel-route",
    articleId: "sales-tech-routing-and-support-requests",
    matchAnyGroups: [
      ["where do i post", "where should i post", "which channel", "what channel", "who do i ask", "who should i ask"],
      ["zoom", "keap", "calendar", "recording", "dropdown", "sales-tooling", "sales tooling", "sales-system", "sales system"],
    ],
    requiredAll: ["#sales-tech-requests"],
    forbiddenAny: ["I do not have a confirmed answer", "default-abstain"],
    fallback: {
      answer: "Post sales-tech/tooling issues in #sales-tech-requests. That includes Zoom, Keap, calendars, recordings, forms/dropdowns, calls, and other sales-system issues.",
      summary: "Sales-tech/tooling issues go to #sales-tech-requests.",
      sections: [
        {
          title: "Where to post",
          body: "Post sales-tech/tooling issues in #sales-tech-requests.",
          tone: "route",
        },
        {
          title: "Examples",
          items: ["Zoom", "Keap", "calendars", "recordings", "forms/dropdowns", "calls", "other sales-system issues"],
          tone: "default",
        },
      ],
      selected_source_ids: ["approved:sales-tech-routing-and-support-requests"],
      needs_route: true,
      route_reason: "Sales-tech/tooling issues route to #sales-tech-requests.",
      confidence_label: "High",
      confidence_score: 94,
    },
  },
  {
    id: "platform-media-kit-refund-exception-route",
    articleId: "platform-proof-and-claims-boundaries",
    matchAny: [
      "media kit",
      "third-party media kit",
      "third party media kit",
      "nielsen",
      "audience statistics",
      "audience stats",
      "audience data",
      "demographics",
      "proof deck",
      "stats deck",
    ],
    requiredAnyGroups: [
      ["media kit", "Nielsen", "audience-stat", "audience statistic", "audience stats"],
      ["source owner", "proof/source owner", "approved proof"],
      ["do not quote", "do not promise", "route"],
    ],
    forbiddenAny: ["All tiers air", "Inside Success Network app", "guarantee", "official refund exception"],
    fallback: {
      answer:
        "Do not quote media-kit, Nielsen, audience-stat, demographic, ranking, view-count, or proof-deck numbers from memory. Route requests for current media-kit/Nielsen/audience-stat material to the approved proof/source owner. For refund or rescheduling exceptions such as pandemic, lockdown, travel restriction, illness, or production disruption, do not promise an outcome; route to finance, contracts/legal, or the current owner before replying.",
      summary: "Media-kit/stat requests and refund/reschedule exceptions need current owner routing.",
      sections: [
        {
          title: "Media kit and stats",
          body: "Do not quote media-kit, Nielsen, audience-stat, demographic, ranking, view-count, or proof-deck numbers from memory. Route current proof material to the approved proof/source owner.",
          tone: "route",
        },
        {
          title: "Refund or reschedule exceptions",
          body: "For exceptions such as pandemic, lockdown, travel restriction, illness, or production disruption, do not promise an outcome; route to finance, contracts/legal, or the current owner before replying.",
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:platform-proof-and-claims-boundaries", "approved:refund-rules-by-product"],
      needs_route: true,
      route_reason: "Media-kit/Nielsen/audience-stat requests and refund/rescheduling exceptions need current owner-approved material.",
      confidence_label: "High",
      confidence_score: 92,
    },
  },
  {
    id: "internal-recording-delete-vault-route",
    articleId: "internal-material-sharing-boundaries",
    matchAnyGroups: [
      ["audition recording", "call recording", "recording"],
      ["delete", "deleted", "vault", "vaulted", "send it to her", "send it to them", "send"],
    ],
    requiredAnyGroups: [
      ["do not delete", "do not vault", "do not promise deletion", "do not promise"],
      ["route", "source owner", "compliance", "current owner"],
      ["do not share", "cannot send", "not externally share"],
    ],
    forbiddenAny: ["send the recording", "delete it yourself", "vault it yourself", "you can delete it", "you can vault it"],
    fallback: {
      answer:
        "Do not send, delete, or vault the recording yourself, and do not promise deletion or vaulting. Acknowledge the request and route it to the source owner, compliance, or current process owner so they can handle it through the approved process.",
      summary: "Recording sharing/deletion requests need the source owner or compliance.",
      sections: [
        {
          title: "What to do",
          body: "Acknowledge the request and route it to the source owner, compliance, or current process owner.",
          tone: "route",
        },
        {
          title: "Do not do yourself",
          items: ["Do not send the recording.", "Do not delete or vault it yourself.", "Do not promise deletion or vaulting."],
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:internal-material-sharing-boundaries"],
      needs_route: true,
      route_reason: "External recording access or deletion/vault requests need the source owner/compliance process.",
      confidence_label: "High",
      confidence_score: 93,
    },
  },
  {
    id: "internal-dashboard-access-route",
    articleId: "internal-material-sharing-boundaries",
    matchAnyGroups: [
      ["hq dashboard", "rudy dashboard", "dashboard that rudy shows", "internal dashboard", "training dashboard"],
      ["closers have access", "have access", "access to", "authors are interested", "extra training", "potential introductions", "events"],
    ],
    requiredAnyGroups: [
      ["dashboard"],
      ["route", "current owner", "dashboard/source owner", "sales leadership"],
      ["do not guess", "do not assume", "do not share", "do not use internal"],
    ],
    forbiddenAny: ["closers have access", "I can tell you about", "share the dashboard", "they have access"],
    fallback: {
      answer:
        "Do not guess whether closers, prospects, or clients have access to the internal dashboard. Do not use internal dashboard content as shareable proof. Route dashboard access and approved public talking-point questions to the current owner, dashboard/source owner, or sales leadership before replying.",
      summary: "Internal dashboard access needs current-owner confirmation.",
      sections: [
        {
          title: "What to do",
          body: "Route dashboard access and approved public talking-point questions to the current owner, dashboard/source owner, or sales leadership.",
          tone: "route",
        },
        {
          title: "Boundary",
          body: "Do not guess access permissions or use internal dashboard content as shareable proof.",
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:internal-material-sharing-boundaries"],
      needs_route: true,
      route_reason: "Internal dashboard access and dashboard-proof questions need the current owner, dashboard/source owner, or sales leadership.",
      confidence_label: "High",
      confidence_score: 93,
    },
  },
  {
    id: "greenlight-cap-route",
    articleId: "greenlight-pdf-and-cohort-deadlines",
    matchAny: ["greenlight approval cap", "current greenlight approval cap", "approval cap", "greenlight cap", "greenlights per day"],
    requiredAll: ["#greenlight-requests"],
    forbiddenAny: ["3 per day", "15 per week"],
    fallback: {
      answer: "For current greenlight caps, send windows, letter status, urgent sends, or stop questions, post in #greenlight-requests instead of quoting old cap numbers.",
      summary: "Current greenlight live-ops details route to #greenlight-requests.",
      sections: [
        {
          title: "Where to post",
          body: "Post in #greenlight-requests for current caps, send windows, letter status, urgent sends, or stop questions.",
          tone: "route",
        },
      ],
      selected_source_ids: ["approved:greenlight-pdf-and-cohort-deadlines"],
      needs_route: true,
      route_reason: "Greenlight caps and live timing can drift, so use #greenlight-requests.",
      confidence_label: "High",
      confidence_score: 94,
    },
  },
  {
    id: "greenlight-letter-route",
    articleId: "greenlight-pdf-and-cohort-deadlines",
    matchAnyGroups: [
      ["greenlight", "green light", "approval letter", "approval pdf"],
      ["letter", "pdf", "urgent", "urgently", "request", "send", "status", "where should", "where do"],
    ],
    requiredAll: ["#greenlight-requests"],
    forbiddenAny: ["#sales-finance-requests", "sales-finance-requests", "finance requests"],
    fallback: {
      answer:
        "Post greenlight letter requests, urgent sends, and letter-status questions in #greenlight-requests. Do not promise the letter, timing, or outcome unless the current greenlight owner confirms it.",
      summary: "Greenlight letter requests go to #greenlight-requests.",
      sections: [
        {
          title: "Where to post",
          body: "Post greenlight letter requests, urgent sends, and letter-status questions in #greenlight-requests.",
          tone: "route",
        },
        {
          title: "Boundary",
          body: "Do not promise the letter, timing, or outcome unless the current greenlight owner confirms it.",
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:greenlight-pdf-and-cohort-deadlines"],
      needs_route: true,
      route_reason: "Greenlight letter requests, urgent sends, and status questions route to #greenlight-requests.",
      confidence_label: "High",
      confidence_score: 94,
    },
  },
  {
    id: "greenlight-main-istv-proof-exception-route",
    articleId: "greenlight-pdf-and-cohort-deadlines",
    productScopes: ["main_istv"],
    matchAnyGroups: [
      ["family emergency", "emergency", "out of town", "genuine reason", "proof", "car crash", "death in family", "death in the family"],
      ["cohort", "deadline", "call 2", "call two", "Sunday", "exception"],
    ],
    requiredAnyGroups: [
      ["Rich", "route"],
      ["proof", "documented", "genuine"],
      ["do not approve", "do not approve it yourself", "owner"],
    ],
    forbiddenAny: ["#greenlight-requests", "greenlight letter", "urgent letter", "post in #greenlight-requests"],
    fallback: {
      answer:
        "Do not approve the exception yourself. For main ISTV, if they have a genuine documented emergency or proof, route it to Rich or the current owner for approval before telling the prospect they can move outside the normal cohort/deadline rule.",
      summary: "Main ISTV proof exceptions need Rich/current-owner approval.",
      sections: [
        {
          title: "What to do",
          body: "Route the documented emergency/proof to Rich or the current owner before promising a deadline or cohort exception.",
          tone: "route",
        },
        {
          title: "Boundary",
          body: "Do not approve the exception yourself or tell the prospect they can move outside the normal rule until the owner confirms it.",
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:greenlight-pdf-and-cohort-deadlines"],
      needs_route: true,
      route_reason: "Main ISTV genuine-reason/proof exceptions require Rich or current-owner approval.",
      confidence_label: "High",
      confidence_score: 94,
    },
  },
  {
    id: "main-istv-reapply-minimum",
    articleId: "greenlight-pdf-and-cohort-deadlines",
    productScopes: ["main_istv"],
    matchAnyGroups: [
      ["reapply", "reapply after", "when can they reapply"],
      ["no-show", "no show", "missed deadline", "missed cohort", "rejected", "not-fit", "not fit"],
    ],
    requiredAll: ["3 months"],
    forbiddenAny: ["not confirmed", "6 months"],
    fallback: {
      answer:
        "For main ISTV, if someone no-shows, misses the Sunday 11:59 PM ET pay/sign deadline, or is rejected/not-fit, tell them they can reapply in the future. The minimum is 3 months.",
      summary: "Main ISTV reapply minimum is 3 months.",
      sections: [
        {
          title: "Answer",
          body: "For main ISTV, if someone no-shows, misses the Sunday 11:59 PM ET pay/sign deadline, or is rejected/not-fit, tell them they can reapply in the future. The minimum is 3 months.",
          tone: "default",
        },
      ],
      selected_source_ids: ["approved:greenlight-pdf-and-cohort-deadlines"],
      needs_route: false,
      route_reason: "",
      confidence_label: "High",
      confidence_score: 95,
    },
  },
  {
    id: "wire-ach-finance-route",
    articleId: "payment-plan-and-link-boundaries",
    matchAny: ["wire", "ach", "invoice"],
    requiredAll: ["#sales-finance-requests"],
    forbiddenAny: ["bank details", "wire instructions from memory"],
    fallback: {
      answer: "For wire/ACH or invoice requests, post in #sales-finance-requests before sending anything to the client. Do not provide bank or payment instructions from memory.",
      summary: "Wire/ACH/invoice handling routes to #sales-finance-requests.",
      sections: [
        {
          title: "Where to post",
          body: "Post wire/ACH or invoice requests in #sales-finance-requests before sending anything to the client.",
          tone: "route",
        },
        {
          title: "Do not send from memory",
          body: "Do not provide bank or payment instructions from memory.",
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:payment-plan-and-link-boundaries"],
      needs_route: true,
      route_reason: "Wire/ACH/invoice handling needs the finance route.",
      confidence_label: "High",
      confidence_score: 94,
    },
  },
];

const rawChunks = (ragIndex as { chunks?: RagChunk[] }).chunks || [];
const APPROVED_POLICY_UNITS = approvedPolicyUnits as ApprovedPolicyUnitsDocument;
const ARTICLE_BY_ID = new Map(APPROVED_FAQ_ARTICLES.map((article) => [article.id, article]));
const INDEXED_CHUNKS: IndexedChunk[] = rawChunks.map((chunk) => {
  const normalized = normalizeText(`${chunk.source_title} ${chunk.heading} ${chunk.category} ${chunk.text}`);
  const tokens = tokenize(normalized, { expand: false });
  return {
    ...chunk,
    normalized,
    tokens,
    tokenSet: new Set(tokens),
  };
});

export async function runAskSalesFaq(
  question: string,
  conversationMessages: AskSalesFaqChatMessage[] = [],
): Promise<AskSalesFaqRuntimeResult> {
  const startedAt = Date.now();
  const { text: sanitizedQuestion, redactions } = redactSensitiveText(question);
  const sanitizedConversationMessages = conversationMessages.map((message) => ({
    role: message.role,
    content: redactSensitiveText(message.content).text,
  }));
  const questionFrame = buildQuestionFrame(sanitizedQuestion, sanitizedConversationMessages);
  const routingQuestion = questionFrame.effectiveQuestion;
  const conversationContext = buildConversationContext(sanitizedConversationMessages);
  const routingConversationContext =
    questionFrame.relation === "context_follow_up" || shouldUseConversationContextForRouting(sanitizedQuestion, conversationContext)
    ? conversationContext
    : "";
  const contextualQuestion = buildContextualQuestion(sanitizedQuestion, routingConversationContext);
  const providerDiagnostics: ProviderCallDiagnostics[] = [];
  let policyDecision = matchPolicyGuard(routingQuestion, questionFrame);
  let conversationPlannerAttempted = false;

  if (
    shouldAttemptApprovedArticleRouter(policyDecision) &&
    !questionFrame.isScopeCorrection &&
    shouldPlanConversationBeforeContextPolicy(sanitizedQuestion, routingConversationContext)
  ) {
    conversationPlannerAttempted = true;
    const plannerResult = await tryPlanConversationTurn({
      currentQuestion: sanitizedQuestion,
      conversationContext: routingConversationContext,
    });
    if (plannerResult.diagnostics) providerDiagnostics.push(plannerResult.diagnostics);
    if (plannerResult.reply) {
      const decision = buildConversationReplyDecision(plannerResult.reply);
      const answer = sanitizeModelAnswer(plannerResult.reply.answer);

      return buildHandledResponse({
        startedAt,
        sanitizedQuestion,
        contextualQuestion,
        redactions,
        decision,
        answer,
        structuredAnswer: normalizeModelStructuredAnswer(plannerResult.reply, answer, decision),
        source: null,
        provider: plannerResult.provider,
        model: plannerResult.model,
        errorClass: null,
        runtimeMetadata: buildRuntimeMetadata({
          evidence: [],
          modelEvidence: [],
          providerDiagnostics,
          criticalFallbackUsed: false,
          policyDecision: buildConversationPlannerDecision(),
        }),
      });
    }
    if (plannerResult.decision) policyDecision = plannerResult.decision;
  }

  if (policyDecision.matchedRuleId === "default-abstain") {
    policyDecision = decidePolicyGuard(routingQuestion, routingConversationContext, questionFrame);
  }

  if (
    !policyDecision.safeToGenerate &&
    shouldAttemptApprovedArticleRouter(policyDecision) &&
    !conversationPlannerAttempted &&
    !questionFrame.isScopeCorrection
  ) {
    const plannerResult = await tryPlanConversationTurn({
      currentQuestion: sanitizedQuestion,
      conversationContext: routingConversationContext,
    });
    if (plannerResult.diagnostics) providerDiagnostics.push(plannerResult.diagnostics);
    if (plannerResult.reply) {
      const decision = buildConversationReplyDecision(plannerResult.reply);
      const answer = sanitizeModelAnswer(plannerResult.reply.answer);

      return buildHandledResponse({
        startedAt,
        sanitizedQuestion,
        contextualQuestion,
        redactions,
        decision,
        answer,
        structuredAnswer: normalizeModelStructuredAnswer(plannerResult.reply, answer, decision),
        source: null,
        provider: plannerResult.provider,
        model: plannerResult.model,
        errorClass: null,
        runtimeMetadata: buildRuntimeMetadata({
          evidence: [],
          modelEvidence: [],
          providerDiagnostics,
          criticalFallbackUsed: false,
          policyDecision: buildConversationPlannerDecision(),
        }),
      });
    }
    if (plannerResult.decision) policyDecision = plannerResult.decision;
  }

  const answerPlan = buildAnswerPlan({
    questionFrame,
    approvedArticleId: policyDecision.articleId,
    policyUnits: APPROVED_POLICY_UNITS,
  });
  const candidates = buildEvidenceCandidates(routingQuestion, routingConversationContext, policyDecision, answerPlan);
  const baseRuntimeMetadata = buildRuntimeMetadata({
    evidence: candidates,
    modelEvidence: [],
    providerDiagnostics,
    criticalFallbackUsed: false,
    policyDecision,
    questionFrame,
    answerPlan,
  });

  if (!policyDecision.safeToGenerate) {
    const decision = buildPolicyBlockedDecision(policyDecision);
    const answer = policyBlockedAnswer(policyDecision);
    return buildHandledResponse({
      startedAt,
      sanitizedQuestion,
      contextualQuestion,
      redactions,
      decision,
      answer,
      structuredAnswer: structured({
        summary: answer,
        sections: [],
        decision,
      }),
      source: null,
      provider: null,
      model: null,
      errorClass: null,
      runtimeMetadata: baseRuntimeMetadata,
    });
  }

  if (answerPlan.clarificationRequired) {
    const clarification = buildPolicyPlanFallback(answerPlan, policyDecision);
    if (clarification) {
      const decision = buildDecision({ output: clarification, evidence: candidates, policyDecision });
      const answer = sanitizeModelAnswer(clarification.answer);

      return buildHandledResponse({
        startedAt,
        sanitizedQuestion,
        contextualQuestion,
        redactions,
        decision,
        answer,
        structuredAnswer: normalizeModelStructuredAnswer(clarification, answer, decision),
        source: sourceSummaryFromDecision(decision),
        provider: null,
        model: null,
        errorClass: null,
        runtimeMetadata: buildRuntimeMetadata({
          evidence: candidates,
          modelEvidence: modelEvidenceCandidates(candidates),
          providerDiagnostics,
          criticalFallbackUsed: false,
          policyDecision,
          questionFrame,
          answerPlan,
        }),
      });
    }
  }

  try {
    const answerResult = await generateProviderAnswer({
      currentQuestion: sanitizedQuestion,
      conversationContext: routingConversationContext,
      evidence: candidates,
      policyDecision,
      questionFrame,
      answerPlan,
    });
    providerDiagnostics.push(answerResult.diagnostics);
    const finalOutputResult = await ensureRepFacingOutput({
      currentQuestion: sanitizedQuestion,
      output: answerResult.output,
    });
    providerDiagnostics.push(...finalOutputResult.diagnostics);
    const criticalOutputResult = await ensureCriticalAnswer({
      currentQuestion: sanitizedQuestion,
      routingQuestion,
      conversationContext: routingConversationContext,
      evidence: candidates,
      policyDecision,
      questionFrame,
      answerPlan,
      output: finalOutputResult.output,
    });
    providerDiagnostics.push(...criticalOutputResult.diagnostics);
    const groundedOutputResult = await ensureArticleRouterGrounding({
      currentQuestion: sanitizedQuestion,
      conversationContext: routingConversationContext,
      evidence: candidates,
      policyDecision,
      questionFrame,
      answerPlan,
      output: criticalOutputResult.output,
    });
    providerDiagnostics.push(...groundedOutputResult.diagnostics);
    const finalOutput = shapeModelOutputForDisplay(
      sanitizedQuestion,
      groundedOutputResult.output,
      policyDecision.decision === "route_from_approved_article",
    );
    const selectedEvidence = resolveSelectedEvidence(finalOutput, candidates, sanitizedQuestion);
    const decision = buildDecision({
      output: finalOutput,
      evidence: selectedEvidence,
      policyDecision,
    });
    const answer = sanitizeModelAnswer(finalOutput.answer);

    if (!answer || modelOutputContainsHiddenTerms(finalOutput)) {
      throw new Error("AI output was empty or exposed hidden terms");
    }

    return buildHandledResponse({
      startedAt,
      sanitizedQuestion,
      contextualQuestion,
      redactions,
      decision,
      answer,
      structuredAnswer: normalizeModelStructuredAnswer(finalOutput, answer, decision),
      source: sourceSummaryFromDecision(decision),
      provider: answerResult.provider,
      model: answerResult.model,
      errorClass: null,
      runtimeMetadata: buildRuntimeMetadata({
        evidence: candidates,
        modelEvidence: modelEvidenceCandidates(candidates),
        providerDiagnostics,
        criticalFallbackUsed: Boolean(criticalOutputResult.fallbackUsed),
        policyDecision,
        questionFrame,
        answerPlan,
      }),
    });
  } catch (error) {
    console.error("Ask Sales FAQ AI runtime failed", error);
    const fallbackOutput = buildAndValidateApprovedFallback({
      currentQuestion: sanitizedQuestion,
      conversationContext: routingConversationContext,
      policyDecision,
      questionFrame,
      answerPlan,
    });
    if (fallbackOutput) {
      const selectedEvidence = resolveSelectedEvidence(fallbackOutput, candidates, sanitizedQuestion);
      const decision = buildDecision({
        output: fallbackOutput,
        evidence: selectedEvidence.length ? selectedEvidence : candidates,
        policyDecision,
      });
      const answer = sanitizeModelAnswer(fallbackOutput.answer);

      return buildHandledResponse({
        startedAt,
        sanitizedQuestion,
        contextualQuestion,
        redactions,
        decision,
        answer,
        structuredAnswer: normalizeModelStructuredAnswer(fallbackOutput, answer, decision),
        source: sourceSummaryFromDecision(decision),
        provider: null,
        model: null,
        errorClass: "ai_runtime_approved_fallback",
        runtimeMetadata: buildRuntimeMetadata({
          evidence: candidates,
          modelEvidence: modelEvidenceCandidates(candidates),
          providerDiagnostics,
          criticalFallbackUsed: true,
          policyDecision,
          questionFrame,
          answerPlan,
        }),
      });
    }

    const decision = buildUnavailableDecision(candidates);
    return buildHandledResponse({
      startedAt,
      sanitizedQuestion,
      contextualQuestion,
      redactions,
      decision,
      answer: AI_UNAVAILABLE_RESPONSE,
      structuredAnswer: structured({
        summary: AI_UNAVAILABLE_RESPONSE,
        sections: [{ title: "What to do", items: ["Route this to the current sales owner or the right help channel.", "Do not guess before replying to the prospect."], tone: "route" }],
        decision,
      }),
      source: null,
      errorClass: "ai_runtime_unavailable",
      runtimeMetadata: buildRuntimeMetadata({
        evidence: candidates,
        modelEvidence: modelEvidenceCandidates(candidates),
        providerDiagnostics,
        criticalFallbackUsed: false,
        policyDecision,
        questionFrame,
        answerPlan,
      }),
    });
  }
}

function buildHandledResponse(input: {
  startedAt: number;
  sanitizedQuestion: string;
  contextualQuestion: string;
  redactions: string[];
  decision: RuntimeDecision;
  answer: string;
  structuredAnswer: AskSalesFaqStructuredAnswer;
  source: AskSalesFaqRuntimeResult["source"];
  provider?: "deepseek" | "anthropic" | null;
  model?: string | null;
  errorClass: string | null;
  runtimeMetadata?: AskSalesFaqRuntimeMetadata | null;
}): AskSalesFaqRuntimeResult {
  return {
    ok: true,
    conversationId: "",
    messageId: "",
    answer: input.answer,
    structuredAnswer: input.structuredAnswer,
    outcome: input.decision.outcome,
    source: input.source,
    model: input.model || null,
    provider: input.provider || null,
    needsRoute:
      input.decision.outcome === "route_from_approved_article" ||
      input.decision.outcome === "route_from_evidence" ||
      input.decision.outcome === "low_confidence_route" ||
      input.decision.outcome === "abstain_unapproved" ||
      input.decision.outcome === "safe_fallback" ||
      (input.decision.outcome === "conversation_reply" && Boolean(input.decision.routeReason)),
    routeReason: input.decision.routeReason,
    redactions: input.redactions,
    latencyMs: Date.now() - input.startedAt,
    sanitizedQuestion: input.sanitizedQuestion,
    contextualQuestion: input.contextualQuestion,
    matchedArticleId: input.decision.matchedArticleId,
    errorClass: input.errorClass,
    runtimeMetadata: input.runtimeMetadata || null,
  };
}

function decidePolicyGuard(question: string, conversationContext = "", questionFrame?: QuestionFrame): PolicyGuardDecision {
  const directDecision = matchPolicyGuard(question, questionFrame);
  if (directDecision.matchedRuleId !== "default-abstain") return directDecision;
  void conversationContext;
  return directDecision;
}

function policyRuleCompatibleWithFrame(rule: AskSalesFaqRule, questionFrame?: QuestionFrame) {
  if (!questionFrame) return true;
  const ruleScope = rule.product_scope;
  if (!ruleScope) return true;
  if (questionFrame.excludedScopes.includes(ruleScope)) return false;
  if (questionFrame.scope === "comparison") return questionFrame.includedScopes.includes(ruleScope);
  if (questionFrame.scope === "unknown") return true;
  return questionFrame.scope === ruleScope;
}

function matchPolicyGuard(question: string, questionFrame?: QuestionFrame): PolicyGuardDecision {
  for (const [groupName, rules] of [
    ["adminOnlyRules", ASK_SALES_FAQ_POLICY_RULES.adminOnlyRules],
    ["abstainRules", ASK_SALES_FAQ_POLICY_RULES.abstainRules],
    ["routeRules", ASK_SALES_FAQ_POLICY_RULES.routeRules],
    ["answerRules", ASK_SALES_FAQ_POLICY_RULES.answerRules],
  ] as const) {
    for (const rule of rules) {
      if (!policyRuleCompatibleWithFrame(rule, questionFrame)) continue;
      if (!policyRuleMatches(question, rule)) continue;

      const article = rule.article_id ? ARTICLE_BY_ID.get(rule.article_id) || null : null;
      const safeToGenerate =
        (rule.decision === "answer_from_approved_article" || rule.decision === "route_from_approved_article") && Boolean(article);

      return {
        decision: safeToGenerate ? rule.decision : rule.decision === "admin_only" && groupName === "adminOnlyRules" ? "admin_only" : "abstain_unapproved",
        safeToGenerate,
        articleId: safeToGenerate ? rule.article_id || null : null,
        blockedTopic: rule.blocked_topic || null,
        matchedRuleId: rule.id,
        reason: safeToGenerate && rule.reason ? rule.reason : rule.reason || "No approved answer is available for this question.",
        primaryArticle: safeToGenerate ? article : null,
        routingSource: "direct_rule",
        usedConversationContext: false,
      };
    }
  }

  return {
    decision: ASK_SALES_FAQ_POLICY_RULES.defaultDecision.decision,
    safeToGenerate: false,
    articleId: null,
    blockedTopic: null,
    matchedRuleId: "default-abstain",
    reason: ASK_SALES_FAQ_POLICY_RULES.defaultDecision.reason,
    primaryArticle: null,
    routingSource: "default",
    usedConversationContext: false,
  };
}

function shouldAttemptApprovedArticleRouter(policyDecision: PolicyGuardDecision) {
  return policyDecision.matchedRuleId === "default-abstain" && policyDecision.decision === "abstain_unapproved";
}

async function tryPlanConversationTurn(input: {
  currentQuestion: string;
  conversationContext: string;
}): Promise<{
  decision: PolicyGuardDecision | null;
  reply: ModelOutput | null;
  provider?: "deepseek" | "anthropic";
  model?: string;
  diagnostics?: ProviderCallDiagnostics;
}> {
  try {
    const planner = await generateProviderJson<ConversationPlannerOutput>({
      purpose: "conversation planning",
      maxTokens: 650,
      messages: [
        {
          role: "system",
          content: [
            "You are the Ask Sales FAQ conversation planner.",
            "Decide whether the sales rep's current message needs a natural chat reply, an approved sales article, or a safe unsupported fallback.",
            "Use mode conversation_reply only for conversational turns, acknowledgments, requests to shorten/rephrase the previous answer, or short confirmations that can be answered only from the recent assistant answer.",
            "For conversation_reply, write only the natural concise answer in your own words. Do not copy a template. Do not add new policy, prices, discounts, owners, links, exceptions, or process steps.",
            "For conversation_reply, set summary equal to the answer and leave sections empty. The UI will render it as a normal chat reply, not a policy card.",
            "For shorten/rephrase requests, use the most recent substantive assistant sales answer. Ignore brief social replies like 'You're welcome' when resolving what 'that' refers to.",
            "Do not tell the rep or prospect you will connect them with a specialist, have someone reach out, or transfer them unless an approved article explicitly allows that exact handoff.",
            "Never use conversation_reply for new sales-policy/action questions, especially money, deposit, payment, discount, contract, greenlight, qualification, offer, promise, hold, or exception questions.",
            "If the current message asks a new sales-policy question or needs facts beyond the recent assistant answer, do not use conversation_reply.",
            "Use mode approved_article only when one approved article directly controls the answer.",
            "Use mode unsupported when there is no clear approved article and it is not a conversational reply.",
            "Use recent conversation context only to resolve product/show/topic references from the current question, such as this, they, the client, DJ show, cohort, package, payment, promise, or hold.",
            "The current user question is authoritative. If the current question names a different product/show/topic than the recent context, follow the current question.",
            "Choose an article only when its approved guidance directly controls the answer. Shared words or a loose topic match are not enough.",
            "For a thank-you or similar social message, mode must be conversation_reply with a brief friendly reply.",
            "For a short confirmation like 'so I should not promise that, right?', mode can be conversation_reply only if the prior assistant answer already gave that boundary.",
            "Return valid JSON only with keys: mode, answer, summary, sections, article_id, confidence_score, confidence_label, needs_route, route_reason, reason.",
            `For approved_article, confidence_score must be ${ARTICLE_ROUTER_MIN_CONFIDENCE}-100 for a clear approved article match.`,
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "APPROVED ARTICLE CATALOG:",
            formatArticleRouterCatalog(),
            "",
            "RECENT CONVERSATION CONTEXT:",
            input.conversationContext ? input.conversationContext.slice(0, ARTICLE_ROUTER_MAX_CONTEXT_CHARS) : "None",
            "",
            "CURRENT USER QUESTION:",
            input.currentQuestion,
          ].join("\n"),
        },
      ],
      parse: parseConversationPlannerOutput,
    });
    if (planner.output.mode === "conversation_reply") {
      const reply = conversationPlannerReplyToModelOutput(planner.output);
      if (reply && shouldAcceptConversationPlannerReply(input.currentQuestion, planner.output) && !modelOutputContainsHiddenTerms(reply)) {
        return {
          decision: null,
          reply,
          provider: planner.provider,
          model: planner.model,
          diagnostics: planner.diagnostics,
        };
      }
    }
    return {
      decision:
        planner.output.mode === "approved_article"
          ? buildPolicyDecisionFromArticleRouter(planner.output, Boolean(input.conversationContext))
          : null,
      reply: null,
      provider: planner.provider,
      model: planner.model,
      diagnostics: planner.diagnostics,
    };
  } catch (error) {
    console.warn("Ask Sales FAQ conversation planner failed", {
      error: sanitizeProviderError(error),
    });
    return { decision: null, reply: null };
  }
}

function buildPolicyDecisionFromArticleRouter(output: ArticleRouterOutput, usedConversationContext: boolean): PolicyGuardDecision | null {
  const articleId = typeof output.article_id === "string" ? output.article_id.trim() : "";
  const confidenceScore = parseConfidenceScore(output.confidence_score) ?? 0;
  const article = articleId ? ARTICLE_BY_ID.get(articleId) || null : null;

  if (!article || confidenceScore < ARTICLE_ROUTER_MIN_CONFIDENCE) return null;

  return {
    decision: "answer_from_approved_article",
    safeToGenerate: true,
    articleId: article.id,
    blockedTopic: null,
    matchedRuleId: "approved-article-router",
    reason: "Matched to a confirmed sales guidance area. Stay inside that guidance and route unclear edge cases.",
    primaryArticle: article,
    routingSource: "article_router",
    routingConfidence: confidenceScore,
    usedConversationContext,
  };
}

function conversationPlannerReplyToModelOutput(output: ConversationPlannerOutput): ModelOutput | null {
  if (typeof output.answer !== "string" || !output.answer.trim()) return null;
  const confidenceScore = parseConfidenceScore(output.confidence_score) ?? 88;
  const answer = sanitizeModelAnswer(output.answer);
  return normalizeModelOutput({
    answer,
    summary: answer,
    sections: [],
    selected_source_ids: [],
    needs_route: false,
    route_reason: "",
    confidence_label: output.confidence_label || confidenceLabelFromScore(confidenceScore),
    confidence_score: confidenceScore,
  });
}

function buildConversationReplyDecision(output: ModelOutput): RuntimeDecision {
  const confidenceScore = typeof output.confidence_score === "number" ? clampConfidence(output.confidence_score) : 88;
  return {
    outcome: "conversation_reply",
    sourceMode: "conversation",
    confidenceLabel: output.confidence_label || confidenceLabelFromScore(confidenceScore),
    confidenceScore,
    reason: output.summary || "Conversation reply.",
    routeReason: output.needs_route ? output.route_reason || null : null,
    safeToGenerate: true,
    matchedRuleId: "conversation-planner",
    matchedArticleId: null,
    primaryArticle: null,
    retrieved: [],
  };
}

function buildConversationPlannerDecision(): PolicyGuardDecision {
  return {
    decision: "abstain_unapproved",
    safeToGenerate: false,
    articleId: null,
    blockedTopic: null,
    matchedRuleId: "conversation-planner",
    reason: "AI handled this as a conversational turn without new sales-policy authority.",
    primaryArticle: null,
    routingSource: "conversation_planner",
    routingConfidence: 88,
    usedConversationContext: true,
  };
}

function formatArticleRouterCatalog() {
  return APPROVED_FAQ_ARTICLES.map((article, index) =>
    [
      `Article ${index + 1}`,
      `ID: ${article.id}`,
      `Title: ${article.title}`,
      `Category: ${article.category}`,
      `Risk: ${article.riskLevel}`,
      `Last reviewed: ${article.lastReviewed}`,
      `Approved question families: ${approvedQuestionFamiliesForArticle(article.id) || "Use the article title and topic summary."}`,
      `Guidance excerpt: ${compactArticleBodyForRouter(article.body)}`,
    ].join("\n"),
  ).join("\n\n");
}

function approvedQuestionFamiliesForArticle(articleId: string) {
  const phrases: string[] = [];
  for (const rules of [
    ASK_SALES_FAQ_POLICY_RULES.routeRules,
    ASK_SALES_FAQ_POLICY_RULES.answerRules,
  ]) {
    for (const rule of rules) {
      if (rule.article_id !== articleId) continue;
      phrases.push(...(rule.match_all || []), ...(rule.match_any || []), ...(rule.match_any_groups || []).flat());
    }
  }

  return Array.from(new Set(phrases.map((phrase) => phrase.trim()).filter(Boolean))).slice(0, 36).join("; ").slice(0, 1100);
}

function compactArticleBodyForRouter(body: string) {
  const topicHeadings = Array.from(body.matchAll(/^#{1,4}\s+(.+)$/gm), (match) => match[1].trim());
  const compactBody = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_|`[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return [`Topics: ${topicHeadings.join("; ")}.`, compactBody].join(" ").slice(0, ARTICLE_ROUTER_MAX_BODY_CHARS);
}

function shouldPlanConversationBeforeContextPolicy(question: string, conversationContext: string) {
  if (!conversationContext.trim()) return false;

  const normalizedQuestion = normalizeText(question);
  const tokens = tokenize(normalizedQuestion, { expand: false });
  if (!normalizedQuestion || tokens.length > 28) return false;

  if (isSocialConversationTurn(normalizedQuestion)) return true;
  if (isShortAnswerRewriteRequest(normalizedQuestion, tokens.length)) return true;
  if (isConcisePromiseConfirmation(question)) return true;

  return false;
}

function shouldUseConversationContextForRouting(question: string, conversationContext: string) {
  if (!conversationContext.trim()) return false;

  const normalizedQuestion = normalizeText(question);
  const tokens = tokenize(normalizedQuestion, { expand: false });
  if (!normalizedQuestion) return false;

  if (isSocialConversationTurn(normalizedQuestion)) return true;
  if (isShortAnswerRewriteRequest(normalizedQuestion, tokens.length)) return true;
  if (isConcisePromiseConfirmation(question)) return true;

  return isContextDependentFollowUpQuestion(normalizedQuestion, tokens.length);
}

function shouldAcceptConversationPlannerReply(question: string, output: ConversationPlannerOutput) {
  if (output.mode !== "conversation_reply") return false;

  const normalizedQuestion = normalizeText(question);
  const tokens = tokenize(normalizedQuestion, { expand: false });

  if (isSocialConversationTurn(normalizedQuestion)) return true;
  if (isShortAnswerRewriteRequest(normalizedQuestion, tokens.length)) return true;
  if (isConcisePromiseConfirmation(question)) return true;

  return !isNewSalesPolicyActionQuestion(question);
}

function isNewSalesPolicyActionQuestion(question: string) {
  const normalizedQuestion = normalizeText(question);
  if (!normalizedQuestion) return false;

  const asksForAction =
    /\b(can i|can we|could i|could we|should i|should we|may i|may we|am i allowed|are we allowed|is it okay|is this okay|is this allowed|are they allowed|can they|could they|should they|what should i tell|what do i tell|what can i say|what should we do|anything we can do)\b/.test(
      normalizedQuestion,
    );
  const hasMoneyOrPaymentAmount =
    /[$€£]\s?\d/.test(question) ||
    /\b\d+(?:,\d{3})*(?:\.\d+)?\s?(?:k|thousand|hundred|pif|x|times|payments?|installments?)\b/.test(
      normalizedQuestion,
    );
  const hasSalesAuthorityTerm =
    /\b(offer|promise|approve|approval|greenlight|qualify|qualified|eligible|allowed|custom|deposit|payment|pay|discount|hold|exception|refund|contract|link|price|pricing|pif|installment|split|plan|cohort|deadline|client|prospect|spot|funds|wait|join|sign|signup|sign up|book|wire|invoice|card|ach)\b/.test(
      normalizedQuestion,
    );

  return (asksForAction && hasSalesAuthorityTerm) || (hasMoneyOrPaymentAmount && hasSalesAuthorityTerm);
}

function isSocialConversationTurn(normalizedQuestion: string) {
  return (
    /^(thanks|thank you|thankyou|appreciate it|got it|ok thanks|okay thanks|perfect thanks|great thanks|that helps|makes sense|sounds good|cool thanks|awesome thanks)\b/.test(
      normalizedQuestion,
    ) &&
    !/\b(price|payment|pay|call|client|prospect|show|contract|discount|cohort|greenlight|allowed|can i|should i|what|how|when|where|why)\b/.test(
      normalizedQuestion,
    )
  );
}

function isShortAnswerRewriteRequest(normalizedQuestion: string, tokenCount: number) {
  if (tokenCount > 20) return false;

  return (
    /\b(make|keep|say|rewrite|rephrase|shorten|summarize|condense|simplify|shorter|brief|concise|simpler)\b/.test(
      normalizedQuestion,
    ) &&
    /\b(that|this|it|answer|reply|response|shorter|brief|concise|simpler|simple|short)\b/.test(normalizedQuestion)
  );
}

function isContextDependentFollowUpQuestion(normalizedQuestion: string, tokenCount: number) {
  const hasContextReference =
    /^(and|also|then|so)\b/.test(normalizedQuestion) ||
    /\b(it|that|this|they|them|their|him|her|those|same|another|still|again|previous|above|one|ones)\b/.test(
      normalizedQuestion,
    );
  if (!hasContextReference) return false;
  if (tokenCount > 28) return false;
  if (/\b(main istv|daymond john|next level ceo|nlceo|dj show|dj)\b/.test(normalizedQuestion)) return false;

  const pronounOnlyFollowUp =
    tokenCount <= 16 &&
    /\b(it|that|this|they|them|their|him|her|those|same|another|still|again|previous|above|one|ones)\b/.test(
      normalizedQuestion,
    );
  if (pronounOnlyFollowUp) return true;

  if (tokenCount <= 18 && /^(and|also|then|so)\b/.test(normalizedQuestion)) return true;
  if (tokenCount > 22) return false;

  return /\b(cohort|deadline|deposit|funds|payment|pay|sign|greenlight|qualify|qualified|client|show|package|discount|approval|allowed|fit|reschedule|exception|contract)\b/.test(
    normalizedQuestion,
  );
}

function policyRuleMatches(question: string, rule: AskSalesFaqRule) {
  const normalizedQuestion = normalizeText(question);

  if (rule.match_all?.length && !rule.match_all.every((phrase) => phrasePresent(phrase, normalizedQuestion))) return false;
  if (rule.match_any?.length && !rule.match_any.some((phrase) => phrasePresent(phrase, normalizedQuestion))) return false;

  for (const group of rule.match_any_groups || []) {
    if (!group.some((phrase) => phrasePresent(phrase, normalizedQuestion))) return false;
  }

  return Boolean(rule.match_all?.length || rule.match_any?.length || rule.match_any_groups?.length);
}

function criticalRuleMatchesQuestion(question: string, rule: CriticalAnswerRule) {
  const normalizedQuestion = normalizeText(question);

  if (rule.matchAny?.length && !rule.matchAny.some((phrase) => phrasePresent(phrase, normalizedQuestion))) return false;

  for (const group of rule.matchAnyGroups || []) {
    if (!group.some((phrase) => phrasePresent(phrase, normalizedQuestion))) return false;
  }

  return Boolean(rule.matchAny?.length || rule.matchAnyGroups?.length);
}

function matchingCriticalRules(
  question: string,
  policyDecision: PolicyGuardDecision,
  questionFrame?: QuestionFrame,
  answerPlan?: AskSalesAnswerPlan,
) {
  return CRITICAL_ANSWER_RULES.filter(
    (rule) =>
      rule.articleId === policyDecision.articleId &&
      (!rule.productScopes?.length || !questionFrame || rule.productScopes.includes(questionFrame.scope)) &&
      (!answerPlan?.selectedPolicyUnits.length || answerPlan.applicableCriticalRuleIds.includes(rule.id)) &&
      criticalRuleMatchesQuestion(question, rule),
  );
}

function cloneModelOutput(output: ModelOutput): ModelOutput {
  return {
    ...output,
    sections: output.sections?.map((section) => ({
      ...section,
      items: section.items ? [...section.items] : undefined,
    })),
    selected_source_ids: output.selected_source_ids ? [...output.selected_source_ids] : [],
  };
}

function buildCriticalFallbackOutput(
  question: string,
  policyDecision: PolicyGuardDecision,
  questionFrame?: QuestionFrame,
  answerPlan?: AskSalesAnswerPlan,
) {
  const fallbackRules = matchingCriticalRules(question, policyDecision, questionFrame, answerPlan);
  if (fallbackRules.length !== 1) return null;
  const [fallbackRule] = fallbackRules;

  const fallback = cloneModelOutput(fallbackRule.fallback);
  if (!userRequestedShortAnswer(question) || !fallbackRule.id.startsWith("dj-nlceo-")) return fallback;

  const answer =
    "For DJ/NLCEO: no cohort rule, no same-day discount, and main ISTV cohort rules do not apply. Use only listed payment options; do not promise a hold or future payment date without owner approval.";

  return {
    ...fallback,
    answer,
    summary: answer,
    sections: [],
    needs_route: true,
    route_reason: fallback.route_reason || "DJ/NLCEO payment timing, hold, or exception requests should be confirmed with the current DJ/NLCEO owner.",
  };
}

function buildApprovedArticleFallbackOutput(input: {
  currentQuestion: string;
  conversationContext: string;
  policyDecision: PolicyGuardDecision;
  questionFrame?: QuestionFrame;
  answerPlan?: AskSalesAnswerPlan;
}) {
  if (!input.policyDecision.safeToGenerate || !input.policyDecision.primaryArticle) return null;

  const plannedFallback = input.answerPlan ? buildPolicyPlanFallback(input.answerPlan, input.policyDecision) : null;
  if (plannedFallback) return plannedFallback;

  const fallbackQuestion = input.questionFrame?.effectiveQuestion || input.currentQuestion;
  const validationQuestion = criticalValidationQuestion({
    currentQuestion: fallbackQuestion,
    conversationContext: input.conversationContext,
    policyDecision: input.policyDecision,
  });
  const criticalFallback = buildCriticalFallbackOutput(
    validationQuestion,
    input.policyDecision,
    input.questionFrame,
    input.answerPlan,
  );
  if (criticalFallback) return criticalFallback;

  const article = input.policyDecision.primaryArticle;
  switch (article.id) {
    case "call-1-flow":
      return buildCallOnePricingFallback();
    case "current-show-source":
      return buildCurrentShowListFallback(article, fallbackQuestion);
    case "istv-nlceo-pricing-and-same-day-discount":
      return buildPricingAndTimingFallback(fallbackQuestion, input.policyDecision, input.questionFrame);
    case "main-istv-call-2-cohort-reschedule-rules":
      return buildMainIstvCohortFallback(fallbackQuestion, input.policyDecision, input.questionFrame);
    case "platform-proof-and-claims-boundaries":
      return buildPlatformProofFallback(fallbackQuestion, input.policyDecision);
    case "internal-material-sharing-boundaries":
      return buildInternalMaterialFallback(fallbackQuestion, input.policyDecision);
    case "greenlight-pdf-and-cohort-deadlines":
      return buildGreenlightFallback(fallbackQuestion, input.policyDecision);
    case "qualification-and-show-fit-rubric":
      return buildQualificationFallback(fallbackQuestion);
    case "post-sale-handoff-after-close":
      return buildPostSaleFallback(fallbackQuestion);
    case "events-mastermind-red-carpet":
      return buildEventFallback(fallbackQuestion);
    case "contracts-edits-and-signature-process":
      return buildContractFallback(fallbackQuestion);
    default:
      return buildGenericApprovedArticleFallback(article, input.policyDecision);
  }
}

function buildAndValidateApprovedFallback(input: {
  currentQuestion: string;
  conversationContext: string;
  policyDecision: PolicyGuardDecision;
  questionFrame: QuestionFrame;
  answerPlan: AskSalesAnswerPlan;
}) {
  const output = buildApprovedArticleFallbackOutput(input);
  if (!output || modelOutputContainsHiddenTerms(output)) return null;

  const errors = validateCriticalAnswer({
    currentQuestion: input.questionFrame.effectiveQuestion,
    latestQuestion: input.currentQuestion,
    policyDecision: input.policyDecision,
    questionFrame: input.questionFrame,
    answerPlan: input.answerPlan,
    output,
  });
  if (errors.length) {
    console.warn("Ask Sales FAQ approved fallback failed validation", {
      matchedRuleId: input.policyDecision.matchedRuleId,
      articleId: input.policyDecision.articleId,
      errors,
    });
    return null;
  }

  return output;
}

function buildPolicyPlanFallback(answerPlan: AskSalesAnswerPlan, policyDecision: PolicyGuardDecision): ModelOutput | null {
  if (answerPlan.selectedPolicyUnits.length !== 1) return null;
  const [unit] = answerPlan.selectedPolicyUnits;
  const answer = unit.safe_fallback.trim();
  if (!answer) return null;

  const needsRoute = answerPlan.routeRequired || answerPlan.fallbackMode === "clarify";
  return {
    answer,
    summary: answer,
    sections: [],
    selected_source_ids: policyDecision.articleId ? [`approved:${policyDecision.articleId}`] : [],
    needs_route: needsRoute,
    route_reason: needsRoute
      ? answerPlan.fallbackMode === "clarify"
        ? unit.route_reason || "Confirm the product before applying a payment-timing or cohort rule."
        : unit.route_reason || "Confirm this nonstandard request with the current owner before promising it."
      : "",
    confidence_label: "High",
    confidence_score: 96,
    display: { plainSummaryOnly: true },
  };
}

function buildCallOnePricingFallback(): ModelOutput {
  return cloneModelOutput({
    answer:
      "For Call 1, do not quote a price or range in this situation. Keep pricing for Call 2. The only narrow exception is when you are sure the prospect has no business and is not financially qualified; then you may mention the investment only to disqualify them, not to pitch, close, negotiate, or create urgency.",
    summary: "Keep Call 1 pricing for Call 2 unless the narrow disqualification exception clearly applies.",
    sections: [
      {
        title: "Default rule",
        body: "For Call 1, do not quote a price or range. Keep pricing for Call 2.",
        tone: "warning",
      },
      {
        title: "Narrow exception",
        body: "Only if you are sure the prospect has no business and is not financially qualified, you may mention the investment only to disqualify them.",
        tone: "default",
      },
      {
        title: "Do not use it for",
        items: ["pitching", "closing", "negotiating", "pre-selling", "creating urgency"],
        tone: "warning",
      },
    ],
    selected_source_ids: ["approved:call-1-flow"],
    needs_route: true,
    route_reason: "If you are not sure both exception conditions are true, keep pricing for Call 2 or route to sales leadership.",
    confidence_label: "High",
    confidence_score: 95,
  });
}

function buildCurrentShowListFallback(article: ApprovedFaqArticle, question = ""): ModelOutput {
  if (isLegacyMakersDocsQuestion(question)) {
    return cloneModelOutput({
      answer:
        "For Legacy Makers info/docs, use the current Sales Ops-approved Legacy Makers materials. If you are on the DJ side, only sell Daymond John; if the applicant wants an ISTV show such as Legacy Makers, pass them to an ISTV-assigned rep.",
      summary: "Use the current Sales Ops-approved Legacy Makers materials and keep DJ-side applicants with the DJ/NLCEO path.",
      sections: [
        {
          title: "What to use",
          body: "Use the current Sales Ops-approved Legacy Makers materials.",
          tone: "default",
        },
        {
          title: "DJ-side boundary",
          body: "If you are on the DJ side, only sell Daymond John. If the applicant wants an ISTV show such as Legacy Makers, pass them to an ISTV-assigned rep.",
          tone: "warning",
        },
      ],
      selected_source_ids: [`approved:${article.id}`],
      needs_route: false,
      route_reason: "",
      confidence_label: "High",
      confidence_score: 95,
    });
  }

  const showList = extractMarkdownListItems(extractMarkdownSection(article.body, "Latest Approved Show List"));
  const items = showList.length ? showList : ["Legacy Makers", "Women in Power", "Operation CEO", "America's Top Lawyers", "America's Best Doctors"];
  const answer = `The latest approved show list I have is:\n${items.map((item) => `- ${item}`).join("\n")}`;

  return cloneModelOutput({
    answer,
    summary: "Use the latest approved show list below.",
    sections: [
      {
        title: "Current shows",
        items,
        tone: "default",
      },
      {
        title: "If something is missing",
        body: "If a show was just added, paused, disputed, or missing from a dropdown/form, route to tech or the current sales/ops owner instead of choosing a placeholder.",
        tone: "route",
      },
    ],
    selected_source_ids: [`approved:${article.id}`],
    needs_route: false,
    route_reason: "",
    confidence_label: "High",
    confidence_score: 95,
  });
}

function isLegacyMakersDocsQuestion(question: string) {
  const normalizedQuestion = normalizeText(question);
  return (
    /\blegacy makers?\b/.test(normalizedQuestion) &&
    /\b(doc|docs|document|documents|info|information|material|materials)\b/.test(normalizedQuestion)
  );
}

function buildPricingAndTimingFallback(
  question: string,
  policyDecision: PolicyGuardDecision,
  questionFrame?: QuestionFrame,
): ModelOutput {
  if (isLicenseOptionsQuestion(question)) {
    return cloneModelOutput({
      answer:
        "Do not send the License Options document as the default way to compare Lite and Standard. It is better to go over the options on the call. The reuse license document can be sent if needed, but it is not advised because it often hurts the sale.",
      summary: "Do not use the License Options document as the default comparison tool.",
      sections: [
        {
          title: "What to do",
          body: "Go over the options on the call instead of sending the License Options document by default.",
          tone: "default",
        },
        {
          title: "Boundary",
          body: "The reuse license document can be sent if needed, but it is not advised because it often hurts the sale.",
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:istv-nlceo-pricing-and-same-day-discount"],
      needs_route: false,
      route_reason: "",
      confidence_label: "High",
      confidence_score: 94,
    });
  }

  if (isPaymentTimingOrHoldQuestion(question) || policyDecision.matchedRuleId.includes("payment-timing")) {
    const resolvedScope = questionFrame?.scope || "unknown";
    const explicitDj = resolvedScope === "dj_nlceo";
    const explicitMainIstv = resolvedScope === "main_istv";
    const answer = explicitDj
      ? "For DJ/NLCEO, there is no cohort rule. Use only the listed DJ/NLCEO payment options, and do not promise a specific future payment date, hold, custom plan, or exception without the current DJ/NLCEO owner confirming it."
      : explicitMainIstv
        ? "For main ISTV, do not promise a payment hold, future payment date, custom plan, or unlisted exception. Route a nonstandard payment or deadline request to Rich or the current owner before promising anything."
        : "Is this for main ISTV or DJ/NLCEO? The payment-timing and cohort rules are different, so I do not want to apply the wrong policy.";

    return cloneModelOutput({
      answer,
      summary: explicitDj
        ? "DJ/NLCEO has no cohort rule, but do not promise a hold or future payment date."
        : explicitMainIstv
          ? "Main ISTV payment or deadline exceptions need current-owner approval."
          : "Confirm main ISTV vs DJ/NLCEO before promising payment timing.",
      sections: [
        {
          title: explicitDj ? "DJ/NLCEO" : explicitMainIstv ? "Main ISTV" : "Product check",
          body: explicitDj
            ? "DJ/NLCEO has no cohort rule, but only listed payment options are approved."
            : explicitMainIstv
              ? "Use the main ISTV payment and cohort rules; do not promise a nonstandard exception."
              : "Confirm whether this is main ISTV or DJ/NLCEO before applying a cohort/payment-timing rule.",
          tone: "default",
        },
        {
          title: "Boundary",
          body: explicitMainIstv
            ? "For main ISTV, route payment/deadline exceptions to Rich or the current owner before promising anything."
            : "Do not promise a specific future payment date, hold, custom plan, or exception without owner confirmation.",
          tone: "route",
        },
      ],
      selected_source_ids: ["approved:istv-nlceo-pricing-and-same-day-discount"],
      needs_route: true,
      route_reason: "Payment timing, hold, or exception promises need the current owner when the listed plan/timing is not enough.",
      confidence_label: "High",
      confidence_score: 93,
    });
  }

  return cloneModelOutput({
    answer:
      "Use only the listed current package prices and payment options from the approved pricing guidance. Do not invent custom splits, custom amounts, special discounts, or old offer terms.",
    summary: "Use listed pricing/payment options only.",
    sections: [
      {
        title: "Boundary",
        body: "Do not invent custom splits, custom amounts, special discounts, or old offer terms.",
        tone: "warning",
      },
    ],
    selected_source_ids: ["approved:istv-nlceo-pricing-and-same-day-discount"],
    needs_route: policyDecision.decision === "route_from_approved_article",
    route_reason: policyDecision.decision === "route_from_approved_article" ? policyDecision.reason : "",
    confidence_label: "High",
    confidence_score: 90,
  });
}

function buildMainIstvCohortFallback(
  question: string,
  policyDecision: PolicyGuardDecision,
  questionFrame?: QuestionFrame,
): ModelOutput {
  const explicitDj = questionFrame?.scope === "dj_nlceo";
  const answer = explicitDj
    ? "DJ/NLCEO has no cohort rule and no same-day discount. Route DJ/NLCEO reschedule, no-show, pay/sign, deadline, hold, or payment-timing edge cases to the current DJ/NLCEO owner before promising anything."
    : "For main ISTV, Call 2 can be rescheduled within the same cohort week without Rich approval. Moving Call 2 into the next cohort needs Rich approval unless the approved proof exception applies. If someone no-shows, misses the Sunday 11:59 PM ET pay/sign deadline, or is rejected/not-fit, the minimum before they can reapply is 3 months.";

  return cloneModelOutput({
    answer,
    summary: explicitDj ? "DJ/NLCEO has no main ISTV cohort rule." : "Use the main ISTV cohort-week rule for Call 2 timing.",
    sections: [
      {
        title: explicitDj ? "DJ/NLCEO boundary" : "Main ISTV rule",
        body: answer,
        tone: explicitDj || policyDecision.decision === "route_from_approved_article" ? "route" : "default",
      },
    ],
    selected_source_ids: ["approved:main-istv-call-2-cohort-reschedule-rules"],
    needs_route: explicitDj || policyDecision.decision === "route_from_approved_article",
    route_reason: explicitDj
      ? "DJ/NLCEO cohort-like edge cases route to the current DJ/NLCEO owner."
      : policyDecision.decision === "route_from_approved_article"
        ? policyDecision.reason
        : "",
    confidence_label: "High",
    confidence_score: 93,
  });
}

function buildQualificationFallback(question: string): ModelOutput {
  if (isCriminalOrReputationQuestion(question)) {
    return cloneModelOutput({
      answer:
        "Do not approve this from the chatbot. A recent prison history, fraud allegation, bail-bonds/bounty-hunter positioning, or other criminal/legal/reputation concern needs to be routed to sales leadership or compliance before you promise fit. For DJ/NLCEO, criminal history is generally rejected except minor issues such as speeding or parking tickets. For main ISTV, only the listed serious red flags are automatic rejects, but criminal or reputation edge cases still need review before you move forward.",
      summary: "Criminal/background edge cases need owner review before promising fit.",
      sections: [
        {
          title: "What to do",
          body: "Route this to sales leadership or compliance before promising fit.",
          tone: "route",
        },
        {
          title: "Boundary",
          items: [
            "For DJ/NLCEO, criminal history is generally rejected except minor issues such as speeding or parking tickets.",
            "For main ISTV, only the listed serious red flags are automatic rejects, but criminal/legal/reputation edge cases still need review.",
          ],
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:qualification-and-show-fit-rubric"],
      needs_route: true,
      route_reason: "Criminal, legal, or reputation-sensitive qualification questions need sales leadership/compliance review.",
      confidence_label: "High",
      confidence_score: 94,
    });
  }

  return cloneModelOutput({
    answer:
      "Use the approved qualification boundaries only, and route sensitive edge cases before promising fit. That includes physical therapist/unusual medical roles, criminal/legal/reputation concerns, adult/sexual positioning, political or religious red flags, firearms, cannabis/hemp/dispensary questions, minors, or unclear business/platform fit.",
    summary: "Use the approved qualification boundaries and route sensitive edge cases.",
    sections: [
      {
        title: "Route if unclear",
        body: "Route sensitive qualification or show-fit edge cases before promising fit.",
        tone: "route",
      },
    ],
    selected_source_ids: ["approved:qualification-and-show-fit-rubric"],
    needs_route: true,
    route_reason: "Sensitive qualification/show-fit edge cases need owner review.",
    confidence_label: "High",
    confidence_score: 90,
  });
}

function buildPlatformProofFallback(question: string, policyDecision: PolicyGuardDecision): ModelOutput {
  if (/\b(media kit|nielsen|audience statistics|audience stats|audience data|demographics|proof deck|stats deck)\b/i.test(question)) {
    return cloneModelOutput({
      answer:
        "Do not quote media-kit, Nielsen, audience-stat, demographic, ranking, view-count, or proof-deck numbers from memory. Route requests for current media-kit/Nielsen/audience-stat material to the approved proof/source owner. For refund or rescheduling exceptions such as pandemic, lockdown, travel restriction, illness, or production disruption, do not promise an outcome; route to finance, contracts/legal, or the current owner before replying.",
      summary: "Media-kit/stat requests and refund/reschedule exceptions need current owner routing.",
      sections: [
        {
          title: "Media kit and stats",
          body: "Do not quote media-kit, Nielsen, audience-stat, demographic, ranking, view-count, or proof-deck numbers from memory. Route current proof material to the approved proof/source owner.",
          tone: "route",
        },
        {
          title: "Refund or reschedule exceptions",
          body: "For exceptions such as pandemic, lockdown, travel restriction, illness, or production disruption, do not promise an outcome; route to finance, contracts/legal, or the current owner before replying.",
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:platform-proof-and-claims-boundaries", "approved:refund-rules-by-product"],
      needs_route: true,
      route_reason: "Media-kit/Nielsen/audience-stat requests and refund/rescheduling exceptions need current owner-approved material.",
      confidence_label: "High",
      confidence_score: 92,
    });
  }

  if (/\b(rebrand examples|webpage and social rebrand|social rebrand|conversion page example)\b/i.test(question)) {
    return cloneModelOutput({
      answer:
        "For the $30K VIP webpage/social rebrand, Sales Ops has a VIP conversion page example. Use the current approved example/link only; do not invent or imply a broader approved example library.",
      summary: "Use only the Sales Ops-approved VIP conversion page example.",
      sections: [
        {
          title: "Approved example boundary",
          body: "Sales Ops has a VIP conversion page example. Use that current approved example/link only.",
          tone: "default",
        },
        {
          title: "Do not imply",
          body: "Do not invent or imply a broader approved example library unless Sales Ops confirms it.",
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:platform-proof-and-claims-boundaries"],
      needs_route: policyDecision.decision === "route_from_approved_article",
      route_reason: policyDecision.decision === "route_from_approved_article" ? policyDecision.reason : "",
      confidence_label: "High",
      confidence_score: 92,
    });
  }

  return cloneModelOutput({
    answer:
      "Use only approved platform and proof wording. Do not promise ROI, revenue, leads, fundraising, PR outcomes, platform placement, views, demographics, celebrity outcomes, or guaranteed business results. Route specific proof links, press, review links, media kits, audience stats, or proof decks to the approved proof/source owner.",
    summary: "Use approved platform/proof wording and route specific proof assets.",
    sections: [
      {
        title: "Boundary",
        body: "Use only approved platform and proof wording. Do not promise ROI, revenue, leads, fundraising, PR outcomes, platform placement, views, demographics, celebrity outcomes, or guaranteed business results.",
        tone: "warning",
      },
      {
        title: "Route specific proof assets",
        body: "Route specific proof links, press, review links, media kits, audience stats, or proof decks to the approved proof/source owner.",
        tone: "route",
      },
    ],
    selected_source_ids: ["approved:platform-proof-and-claims-boundaries"],
    needs_route: policyDecision.decision === "route_from_approved_article",
    route_reason: policyDecision.decision === "route_from_approved_article" ? policyDecision.reason : "",
    confidence_label: "High",
    confidence_score: 90,
  });
}

function buildInternalMaterialFallback(question: string, policyDecision: PolicyGuardDecision): ModelOutput {
  if (/\b(hq dashboard|rudy dashboard|dashboard that rudy shows|internal dashboard|training dashboard)\b/i.test(question)) {
    return cloneModelOutput({
      answer:
        "Do not guess whether closers, prospects, or clients have access to the internal dashboard. Do not use internal dashboard content as shareable proof. Route dashboard access and approved public talking-point questions to the current owner, dashboard/source owner, or sales leadership before replying.",
      summary: "Internal dashboard access needs current-owner confirmation.",
      sections: [
        {
          title: "What to do",
          body: "Route dashboard access and approved public talking-point questions to the current owner, dashboard/source owner, or sales leadership.",
          tone: "route",
        },
        {
          title: "Boundary",
          body: "Do not guess access permissions or use internal dashboard content as shareable proof.",
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:internal-material-sharing-boundaries"],
      needs_route: true,
      route_reason: "Internal dashboard access and dashboard-proof questions need the current owner, dashboard/source owner, or sales leadership.",
      confidence_label: "High",
      confidence_score: 93,
    });
  }

  if (/\b(pre[- ]?audition video|video before (?:her|his|their) audition|before (?:her|his|their) audition)\b/i.test(question)) {
    return cloneModelOutput({
      answer:
        "You cannot send the pre-audition video out manually. Do not share pre-audition video materials externally unless the current approved process explicitly allows it.",
      summary: "Do not manually send pre-audition video materials.",
      sections: [
        {
          title: "What to do",
          body: "Do not manually send the pre-audition video. Use the current approved process if the prospect did not receive it.",
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:internal-material-sharing-boundaries"],
      needs_route: policyDecision.decision === "route_from_approved_article",
      route_reason: policyDecision.decision === "route_from_approved_article" ? policyDecision.reason : "",
      confidence_label: "High",
      confidence_score: 92,
    });
  }

  if (/\b(recording|audition recording|call recording)\b/i.test(question) && /\b(delete|deleted|vault|vaulted|send|share)\b/i.test(question)) {
    return cloneModelOutput({
      answer:
        "Do not send, delete, or vault the recording yourself, and do not promise deletion or vaulting. Acknowledge the request and route it to the source owner, compliance, or current process owner so they can handle it through the approved process.",
      summary: "Recording sharing/deletion requests need the source owner or compliance.",
      sections: [
        {
          title: "What to do",
          body: "Acknowledge the request and route it to the source owner, compliance, or current process owner.",
          tone: "route",
        },
        {
          title: "Do not do yourself",
          items: ["Do not send the recording.", "Do not delete or vault it yourself.", "Do not promise deletion or vaulting."],
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:internal-material-sharing-boundaries"],
      needs_route: true,
      route_reason: "External recording access or deletion/vault requests need the source owner/compliance process.",
      confidence_label: "High",
      confidence_score: 93,
    });
  }

  return cloneModelOutput({
    answer:
      "Do not externally share internal materials unless they are explicitly approved for that use. If a client asks for an internal recording, screenshot, training video, document, or similar material, route to the source owner or compliance before sending anything.",
    summary: "Do not externally share internal materials without explicit approval.",
    sections: [
      {
        title: "Boundary",
        body: "Do not externally share internal materials unless they are explicitly approved for that use.",
        tone: "warning",
      },
      {
        title: "Route if asked",
        body: "Route client requests for internal recordings, screenshots, training videos, documents, or similar materials to the source owner or compliance.",
        tone: "route",
      },
    ],
    selected_source_ids: ["approved:internal-material-sharing-boundaries"],
    needs_route: policyDecision.decision === "route_from_approved_article",
    route_reason: policyDecision.decision === "route_from_approved_article" ? policyDecision.reason : "",
    confidence_label: "High",
    confidence_score: 90,
  });
}

function buildGreenlightFallback(question: string, policyDecision: PolicyGuardDecision): ModelOutput {
  if (/\b(passed social check|social check|see why|not approved|failed|fail)\b/i.test(question)) {
    return cloneModelOutput({
      answer:
        "If the Greenlight PDF or tracking sheet shows an internal failed social check or unclear status, route that internal question to #greenlight-requests before telling the applicant anything beyond the approved rejection process.",
      summary: "Greenlight internal status questions route to #greenlight-requests.",
      sections: [
        {
          title: "What to do",
          body: "Route the internal status question to #greenlight-requests.",
          tone: "route",
        },
        {
          title: "Client-facing boundary",
          body: "Do not tell the applicant an internal social-check reason unless the current owner confirms what can be shared.",
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:greenlight-pdf-and-cohort-deadlines"],
      needs_route: true,
      route_reason: "Greenlight internal status questions route to #greenlight-requests.",
      confidence_label: "High",
      confidence_score: 94,
    });
  }

  if (
    /\b(family emergency|emergency|out of town|genuine reason|proof|car crash|death in (?:the )?family)\b/i.test(question) &&
    /\b(cohort|deadline|call 2|call two|sunday|exception|make it|out for this cohort)\b/i.test(question)
  ) {
    return cloneModelOutput({
      answer:
        "Do not approve the exception yourself. For main ISTV, if they have a genuine documented emergency or proof, route it to Rich or the current owner for approval before telling the prospect they can move outside the normal cohort/deadline rule.",
      summary: "Main ISTV proof exceptions need Rich/current-owner approval.",
      sections: [
        {
          title: "What to do",
          body: "Route the documented emergency/proof to Rich or the current owner before promising a deadline or cohort exception.",
          tone: "route",
        },
        {
          title: "Boundary",
          body: "Do not approve the exception yourself or tell the prospect they can move outside the normal rule until the owner confirms it.",
          tone: "warning",
        },
      ],
      selected_source_ids: ["approved:greenlight-pdf-and-cohort-deadlines"],
      needs_route: true,
      route_reason: "Main ISTV genuine-reason/proof exceptions require Rich or current-owner approval.",
      confidence_label: "High",
      confidence_score: 94,
    });
  }

  if (/\b(greenlight letter|greenlight request|urgent greenlight|send a greenlight|approval letter|approval pdf)\b/i.test(question)) {
    return cloneModelOutput({
      answer:
        "For greenlight letter requests, urgent sends, letter status, current caps, send windows, or stop/send uncertainty, post in #greenlight-requests instead of quoting old caps or timing.",
      summary: "Greenlight live-ops questions route to #greenlight-requests.",
      sections: [
        {
          title: "Where to post",
          body: "Post in #greenlight-requests for greenlight letter requests, urgent sends, letter status, current caps, send windows, or stop/send uncertainty.",
          tone: "route",
        },
      ],
      selected_source_ids: ["approved:greenlight-pdf-and-cohort-deadlines"],
      needs_route: true,
      route_reason: "Greenlight live-ops questions route to #greenlight-requests.",
      confidence_label: "High",
      confidence_score: 94,
    });
  }

  return cloneModelOutput({
    answer:
      "For main ISTV, if someone no-shows, misses the Sunday 11:59 PM ET payment/signature deadline, or is rejected/not-fit, tell them they can reapply in the future. The minimum is 3 months. Genuine documented emergency/proof exceptions route to Rich or the current owner; do not approve those yourself.",
    summary: "Use the main ISTV reapply rule, and route proof exceptions.",
    sections: [
      {
        title: "Main ISTV rule",
        body: "If someone no-shows, misses the Sunday 11:59 PM ET pay/sign deadline, or is rejected/not-fit, tell them they can reapply in the future. The minimum is 3 months.",
        tone: "default",
      },
      {
        title: "Proof exception",
        body: "Genuine documented emergency/proof exceptions route to Rich or the current owner; do not approve those yourself.",
        tone: "route",
      },
    ],
    selected_source_ids: ["approved:greenlight-pdf-and-cohort-deadlines"],
    needs_route: policyDecision.decision === "route_from_approved_article",
    route_reason: policyDecision.decision === "route_from_approved_article" ? policyDecision.reason : "",
    confidence_label: "High",
    confidence_score: 92,
  });
}

function buildPostSaleFallback(question: string): ModelOutput {
  const shortNotice = /\b(short notice|same day|today|just closed|booked.*onboarding|onboarding.*booked)\b/i.test(question);
  const answer = shortNotice
    ? "You do not need to notify anyone separately for a same-day onboarding call booking, as long as you have completed all required post-sale steps: taken payment, gotten the contract signed, reviewed and sent the onboarding email, and booked the call for today. The onboarding call itself is handled by the studio executive team, so they will be ready."
    : "After payment and signature, review and send the onboarding email, book the onboarding call for the next day, and only confirm PayMe / All Payments after payment is actually confirmed.";

  return cloneModelOutput({
    answer,
    summary: shortNotice ? "No separate notification is needed when required post-sale steps are complete." : "Follow the approved post-sale handoff steps.",
    sections: [
      {
        title: shortNotice ? "Same-day onboarding" : "Post-sale steps",
        body: answer,
        tone: "default",
      },
    ],
    selected_source_ids: ["approved:post-sale-handoff-after-close"],
    needs_route: false,
    route_reason: "",
    confidence_label: "High",
    confidence_score: 94,
  });
}

function buildEventFallback(question: string): ModelOutput {
  const fourPayMastermind = /\b(4-pay|4 pay|four pay|payment plan)\b/i.test(question) && /\b(mastermind|film|filming|august|not pif)\b/i.test(question);
  const answer = fourPayMastermind
    ? "For a 4-pay client trying to film in August and attend Mastermind before the episode is fully PIF, post in the fulfillment hotline to double-check before promising the schedule. The guidance says it should be okay, but fulfillment still needs to confirm."
    : "Mastermind/red-carpet access is included in all packages under the current rule, and there is a $200 non-refundable food/drink fee. Route current dates, logistics, travel, guest rules, or exceptions to the current event/source owner.";

  return cloneModelOutput({
    answer,
    summary: fourPayMastermind ? "Double-check 4-pay/August filming/Mastermind timing with fulfillment." : "Use the approved Mastermind access and fee boundary.",
    sections: [
      {
        title: fourPayMastermind ? "What to do" : "Event boundary",
        body: answer,
        tone: fourPayMastermind ? "route" : "default",
      },
    ],
    selected_source_ids: ["approved:events-mastermind-red-carpet"],
    needs_route: true,
    route_reason: fourPayMastermind ? "Fulfillment should confirm before the rep promises the schedule." : "Event logistics or exceptions can drift.",
    confidence_label: "High",
    confidence_score: 92,
  });
}

function buildContractFallback(question: string): ModelOutput {
  const beforeCallTwo = /\bbefore call 2\b|\bbefore call two\b/i.test(question);
  const answer = beforeCallTwo
    ? "You can send the current contract link before Call 2, but it is not advised. Keep the normal sales process unless leadership approves a specific exception."
    : "You can send the current contract link, but do not edit contract terms, create addenda, promise custom language, or interpret legal terms. Route edits, attorney review, wrong links, entity-name changes, or legal interpretation to Rich/contracts/legal.";

  return cloneModelOutput({
    answer,
    summary: beforeCallTwo ? "Sending the contract before Call 2 is allowed but not advised." : "Use the current contract link and route contract exceptions.",
    sections: [
      {
        title: "Answer",
        body: answer,
        tone: beforeCallTwo ? "warning" : "route",
      },
    ],
    selected_source_ids: ["approved:contracts-edits-and-signature-process"],
    needs_route: !beforeCallTwo,
    route_reason: beforeCallTwo ? "" : "Contract edits, legal review, or wrong-link issues need Rich/contracts/legal.",
    confidence_label: "High",
    confidence_score: 92,
  });
}

function buildGenericApprovedArticleFallback(article: ApprovedFaqArticle, policyDecision: PolicyGuardDecision): ModelOutput {
  const repSayItems = extractMarkdownListItems(extractMarkdownSection(article.body, "What Reps Can Say")).slice(0, 4);
  const answerSectionText = firstMeaningfulParagraph(extractMarkdownSection(article.body, "Answer")) || firstMeaningfulParagraph(article.body);
  const items = repSayItems.length ? repSayItems : answerSectionText ? [answerSectionText] : [];
  const answer = items.length
    ? items[0]
    : `Use the current approved guidance for ${article.title}. If the case is unusual, time-sensitive, or not directly covered, confirm with the current owner before promising it.`;
  const needsRoute = policyDecision.decision === "route_from_approved_article";

  return cloneModelOutput({
    answer,
    summary: answer,
    sections: [
      {
        title: repSayItems.length ? "What you can say" : "Answer",
        body: repSayItems.length ? undefined : answer,
        items: repSayItems.length ? repSayItems : undefined,
        tone: needsRoute ? "route" : "default",
      },
    ],
    selected_source_ids: [`approved:${article.id}`],
    needs_route: needsRoute,
    route_reason: needsRoute ? policyDecision.reason : "",
    confidence_label: "Medium",
    confidence_score: needsRoute ? 82 : 86,
  });
}

function extractMarkdownSection(markdown: string, heading: string) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`(?:^|\\n)##\\s+${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i"));
  return match?.[1]?.trim() || "";
}

function extractMarkdownListItems(markdown: string) {
  return markdown
    .split(/\n+/)
    .map((line) => line.match(/^\s*[-*]\s+(.+?)\s*$/)?.[1]?.trim())
    .filter((item): item is string => Boolean(item));
}

function firstMeaningfulParagraph(markdown: string) {
  const withoutTables = markdown
    .split(/\n+/)
    .filter((line) => !/^\s*\|/.test(line) && !/^\s*[-*]\s+/.test(line) && !/^#{1,6}\s+/.test(line))
    .join("\n");
  return (
    withoutTables
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
      .find((paragraph) => paragraph.length >= 30 && paragraph.length <= 320) || ""
  );
}

function isLicenseOptionsQuestion(question: string) {
  const normalizedQuestion = normalizeText(question);
  return /\blicense options?\b|\breuse license\b/.test(normalizedQuestion);
}

function isPaymentTimingOrHoldQuestion(question: string) {
  const normalizedQuestion = normalizeText(question);
  return (
    /\b(funds unavailable|funds unavail|cannot pay|can't pay|cant pay|unable to pay|initial deposit|first payment|future payment date|payment timing|hold|holding them back|payment holding|pmt holding|need until|aug 15|august 15|2\.5k|2500|2 500|\$2,500|\$2500)\b/.test(
      normalizedQuestion,
    ) &&
    /\b(call 2|call two|greenlit|approved|close|closing|opportunity|payment|pay|deposit|sign|continue|later)\b/.test(
      normalizedQuestion,
    )
  );
}

function isCriminalOrReputationQuestion(question: string) {
  const normalizedQuestion = normalizeText(question);
  return /\b(criminal|crime|charge|felony|fraud|prison|jail|bail bonds|bounty hunter|background|reputation)\b/.test(
    normalizedQuestion,
  );
}

function userRequestedShortAnswer(question: string) {
  const normalizedQuestion = normalizeText(question);
  return /\b(short|shorter|brief|concise|quick|one[- ]line|one[- ]sentence|summarize|condense|simplify|simple reply)\b/.test(
    normalizedQuestion,
  );
}

function shapeModelOutputForDisplay(question: string, output: ModelOutput, policyRequiresRoute = false): ModelOutput {
  const shaped = cloneModelOutput(output);
  const answer = sanitizeModelAnswer(shaped.answer || shaped.summary || "");

  if (
    (userRequestedShortAnswer(question) ||
      shouldUsePlainRouteAnswer(question, shaped, answer, policyRequiresRoute) ||
      shouldUsePlainDirectAnswer(question, shaped, answer, policyRequiresRoute)) &&
    answer
  ) {
    return {
      ...shaped,
      answer,
      summary: answer,
      sections: [],
      display: {
        ...shaped.display,
        plainSummaryOnly: true,
      },
    };
  }

  return {
    ...shaped,
    sections: mergeDuplicateDisplaySections(shaped.sections?.flatMap(normalizeStructuredAnswerSections) || []),
  };
}

function shouldUsePlainRouteAnswer(
  question: string,
  output: ModelOutput,
  answer: string,
  policyRequiresRoute: boolean,
) {
  if ((!output.needs_route && !policyRequiresRoute) || answer.length > 520) return false;
  const normalizedQuestion = normalizeText(question);
  const explicitlyRequestsStructure = questionExplicitlyRequestsStructure(normalizedQuestion);
  return !explicitlyRequestsStructure && tokenize(normalizedQuestion, { expand: false }).length <= 60;
}

function shouldUsePlainDirectAnswer(
  question: string,
  output: ModelOutput,
  answer: string,
  policyRequiresRoute: boolean,
) {
  if (output.needs_route || policyRequiresRoute || answer.length < 80 || answer.length > 420) return false;
  const normalizedQuestion = normalizeText(question);
  if (questionExplicitlyRequestsStructure(normalizedQuestion)) return false;
  if (tokenize(normalizedQuestion, { expand: false }).length > 35) return false;
  return /\b(yes|no|can|cannot|can't|allowed|not advised|do not|don't|use|send)\b/i.test(answer);
}

function questionExplicitlyRequestsStructure(normalizedQuestion: string) {
  return /\b(steps?|step by step|checklist|list|options?|script|what (?:can|should) i say|what should i do|how do i|how should i|process|procedure)\b/.test(
    normalizedQuestion,
  );
}

function normalizeStructuredAnswerSections(
  section: NonNullable<ModelOutput["sections"]>[number],
): NonNullable<ModelOutput["sections"]> {
  return [normalizeActionInstructionSectionTitle(section)]
    .flatMap(splitInlineLabeledOptionSection)
    .flatMap(splitMarkdownListSection)
    .flatMap(splitDenseOptionSection)
    .flatMap(splitCommaListSection);
}

function normalizeActionInstructionSectionTitle(
  section: NonNullable<ModelOutput["sections"]>[number],
): NonNullable<ModelOutput["sections"]>[number] {
  if (!section.title || !/^what you can say$/i.test(section.title.trim())) return section;

  const text = [section.body || "", ...(section.items || [])].join(" ");
  if (/["]/.test(text) || /\byou can say\b/i.test(text)) return section;

  return {
    ...section,
    title: "What you can do",
  };
}

function splitInlineLabeledOptionSection(
  section: NonNullable<ModelOutput["sections"]>[number],
): NonNullable<ModelOutput["sections"]> {
  if (!section.body || section.items?.length) return [section];

  const optionList = extractInlineLabeledOptionList(section.body, section.title);
  if (!optionList) return [section];

  return [
    {
      ...section,
      title: optionList.title || section.title || "Options",
      body: optionList.intro || undefined,
      items: optionList.items,
    },
    ...(optionList.boundary
      ? [
          {
            title: "Boundary",
            body: optionList.boundary,
            tone: section.tone === "route" ? "route" : "warning",
          },
        ]
      : []),
  ];
}

function extractInlineLabeledOptionList(body: string, title?: string) {
  const titleText = normalizeText(title || "");
  const bodyText = normalizeText(body);
  if (!/\b(payment|payments|plan|plans|package|packages|pif|deposit|daymond|nlceo|next level ceo)\b/.test(`${titleText} ${bodyText}`)) {
    return null;
  }

  const normalizedBody = body.replace(
    /\s+-\s+(?=(?:Lite|Standard|Premium VIP|VIP \/ Premium|CEO Day upgrade)\s*:)/gi,
    "\n",
  );
  const optionPattern = /(?:^|\n|[.;]\s+)(Lite|Standard|Premium VIP|VIP \/ Premium|CEO Day upgrade)\s*:\s*/gi;
  const matches = [...normalizedBody.matchAll(optionPattern)];
  if (matches.length < 2) return null;

  const firstIndex = matches[0].index ?? 0;
  const intro = normalizedBody.slice(0, firstIndex).replace(/[-:;,.\s]+$/, "").trim();
  const items = matches
    .map((match, index) => {
      const nextMatch = matches[index + 1];
      const startIndex = (match.index ?? 0) + match[0].length;
      const endIndex = nextMatch?.index ?? normalizedBody.length;
      const value = normalizedBody.slice(startIndex, endIndex).replace(/^[-:;,.\s]+|[-:;,.\s]+$/g, "").trim();
      return value ? `${match[1].trim()}: ${value}` : "";
    })
    .filter(Boolean);

  if (items.length < 2) return null;

  return {
    title: title && !/^answer$/i.test(title) ? title : "Payment options",
    intro,
    items,
    boundary: "",
  };
}

function splitMarkdownListSection(section: NonNullable<ModelOutput["sections"]>[number]): NonNullable<ModelOutput["sections"]> {
  if (!section.body || section.items?.length) return [section];

  const lines = section.body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstBulletIndex = lines.findIndex((line) => /^[-*•]\s+/.test(line));
  if (firstBulletIndex < 0) return [section];

  const items: string[] = [];
  const trailingLines: string[] = [];
  for (const line of lines.slice(firstBulletIndex)) {
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch && !trailingLines.length) {
      items.push(bulletMatch[1].trim());
      continue;
    }
    trailingLines.push(line);
  }
  if (items.length < 2) return [section];

  const intro = lines.slice(0, firstBulletIndex).join(" ").replace(/[-:;,.\s]+$/, "").trim();
  return [
    {
      ...section,
      body: intro || undefined,
      items,
    },
    ...(trailingLines.length
      ? [
          {
            title: "Boundary",
            body: trailingLines.join(" "),
            tone: section.tone === "route" ? "route" : "warning",
          },
        ]
      : []),
  ];
}

function splitDenseOptionSection(section: NonNullable<ModelOutput["sections"]>[number]): NonNullable<ModelOutput["sections"]> {
  if (!section.body || section.items?.length) return [section];

  const optionList = extractDenseOptionList(section.body);
  if (!optionList) return [section];

  return [
    {
      ...section,
      title: optionList.title,
      body: optionList.intro || undefined,
      items: optionList.items,
    },
    ...(optionList.boundary
      ? [
          {
            title: "Boundary",
            body: optionList.boundary,
            tone: section.tone === "route" ? "route" : "warning",
          },
        ]
      : []),
  ];
}

function extractDenseOptionList(body: string) {
  const optionPattern = /(?:^|[:,;]\s*|\bor\s+)([A-Z][A-Za-z0-9/& -]{1,35})\s*\(([^()]*?(?:\$|\d)[^()]*)\)/g;
  const matches = [...body.matchAll(optionPattern)];
  if (matches.length < 3) return null;

  const firstMatch = matches[0];
  const firstIndex = firstMatch.index ?? 0;
  const items = matches.map((match) => `${match[1].trim()}: ${match[2].trim()}`);
  const lastMatch = matches[matches.length - 1];
  let suffix = body.slice((lastMatch.index ?? 0) + lastMatch[0].length).trim();

  const pifMatch = suffix.match(/^[,;]?\s*(?:or\s+)?PIF\b\.?/i);
  if (pifMatch) {
    items.push("PIF");
    suffix = suffix.slice(pifMatch[0].length).trim();
  }

  return {
    title: /\b(pay|payment|deposit|plan|package|pif)\b/i.test(body) ? "Payment options" : "Options",
    intro: body.slice(0, firstIndex).replace(/[:;,.\s]+$/, "").trim(),
    items,
    boundary: suffix.replace(/^[-:;,.\s]+/, "").trim(),
  };
}

function splitCommaListSection(section: NonNullable<ModelOutput["sections"]>[number]): NonNullable<ModelOutput["sections"]> {
  if (!section.body || section.items?.length) return [section];

  const list = extractCommaSeparatedList(section.body, section.title);
  if (!list) return [section];

  return [
    {
      ...section,
      body: list.intro || undefined,
      items: list.items,
    },
  ];
}

function extractCommaSeparatedList(body: string, title?: string) {
  const titleText = normalizeText(title || "");
  const titleSupportsCommaList = /\b(show|shows|show list|current shows|available shows)\b/.test(titleText);
  const genericListWithoutMoney = /\blist\b/.test(titleText) && !/\$/.test(body);
  if (!titleSupportsCommaList && !genericListWithoutMoney) return null;

  const colonIndex = body.indexOf(":");
  const hasShortIntro = colonIndex > 0 && colonIndex < 140 && body.slice(colonIndex + 1).split(",").length >= 6;
  const intro = hasShortIntro ? body.slice(0, colonIndex).replace(/[-:;,.\s]+$/, "").trim() : "";
  const listText = (hasShortIntro ? body.slice(colonIndex + 1) : body).replace(/[.\s]+$/, "").trim();
  const items = listText
    .split(/\s*,\s*/)
    .map((item) => item.replace(/^and\s+/i, "").trim())
    .filter(Boolean);

  if (items.length < 6) return null;
  if (items.some((item) => item.split(/\s+/).length > 8)) return null;

  return { intro, items };
}

function mergeDuplicateDisplaySections(
  sections: NonNullable<ModelOutput["sections"]>,
): NonNullable<ModelOutput["sections"]> {
  const merged: NonNullable<ModelOutput["sections"]> = [];

  for (const section of sections) {
    const last = merged.at(-1);
    if (!last || normalizeText(last.title || "") !== normalizeText(section.title || "")) {
      merged.push(section);
      continue;
    }

    const body = mergeSectionBodies(last.body, section.body);
    const items = mergeSectionItems(last.items, section.items);
    merged[merged.length - 1] = {
      ...last,
      body,
      items,
      tone: strongerSectionTone(last.tone, section.tone),
    };
  }

  return merged;
}

function mergeSectionBodies(first?: string, second?: string) {
  if (!first) return second;
  if (!second) return first;
  if (normalizeText(first) === normalizeText(second)) return first;
  return `${first} ${second}`;
}

function mergeSectionItems(first: string[] = [], second: string[] = []) {
  const items: string[] = [];
  const seen = new Set<string>();

  for (const item of [...first, ...second]) {
    const key = normalizeText(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }

  return items.length ? items : undefined;
}

function strongerSectionTone(
  first?: NonNullable<ModelOutput["sections"]>[number]["tone"],
  second?: NonNullable<ModelOutput["sections"]>[number]["tone"],
) {
  return sectionToneRank(second) > sectionToneRank(first) ? second : first;
}

function sectionToneRank(tone?: NonNullable<ModelOutput["sections"]>[number]["tone"]) {
  if (tone === "route") return 4;
  if (tone === "warning") return 3;
  if (tone === "good") return 2;
  if (tone === "default") return 1;
  return 0;
}

function validateCriticalAnswer(input: {
  currentQuestion: string;
  latestQuestion?: string;
  policyDecision: PolicyGuardDecision;
  output: ModelOutput;
  questionFrame?: QuestionFrame;
  answerPlan?: AskSalesAnswerPlan;
}) {
  const errors = [
    ...validateQuestionFrameScope(input.questionFrame, input.output),
    ...validatePolicyUnitClaims(input.answerPlan, input.output),
  ];
  const matchedRules = matchingCriticalRules(
    input.currentQuestion,
    input.policyDecision,
    input.questionFrame,
    input.answerPlan,
  );
  if (!matchedRules.length) return errors;

  const answerText = modelOutputText(input.output).join(" ");

  for (const rule of matchedRules) {
    const forbiddenErrors: string[] = [];
    for (const phrase of rule.forbiddenAny || []) {
      if (forbiddenPhrasePresent(phrase, answerText)) {
        forbiddenErrors.push(`${rule.id}: answer must not include ${phrase}`);
      }
    }
    if (forbiddenErrors.length) {
      errors.push(...forbiddenErrors);
      continue;
    }

    if (criticalRuleAllowsConciseConfirmation({ rule, latestQuestion: input.latestQuestion || input.currentQuestion, answerText })) {
      continue;
    }

    for (const phrase of rule.requiredAll || []) {
      if (!phrasePresent(phrase, answerText)) {
        errors.push(`${rule.id}: answer must include ${phrase}`);
      }
    }

    for (const group of rule.requiredAnyGroups || []) {
      if (!group.some((phrase) => phrasePresent(phrase, answerText))) {
        errors.push(`${rule.id}: answer must include one of ${group.join(", ")}`);
      }
    }

  }

  return errors;
}

function validatePolicyUnitClaims(answerPlan: AskSalesAnswerPlan | undefined, output: ModelOutput) {
  if (!answerPlan?.selectedPolicyUnits.length) return [];
  const answerText = modelOutputText(output).join(" ");
  const errors: string[] = [];

  for (const unit of answerPlan.selectedPolicyUnits) {
    for (const forbiddenClaim of unit.forbidden_claims) {
      if (forbiddenPhrasePresent(forbiddenClaim, answerText)) {
        errors.push(`${unit.id}: answer includes forbidden claim ${forbiddenClaim}`);
      }
    }
  }

  return errors;
}

function forbiddenPhrasePresent(phrase: string, answerText: string) {
  const normalizedPhrase = normalizeText(phrase);
  const normalizedAnswer = normalizeText(answerText);
  if (!normalizedPhrase || !normalizedAnswer.includes(normalizedPhrase)) return false;
  if (/^(?:no|not|never|cannot|can't|do not|don't|must not|should not)\b/.test(normalizedPhrase)) return true;

  let searchFrom = 0;
  while (searchFrom < normalizedAnswer.length) {
    const index = normalizedAnswer.indexOf(normalizedPhrase, searchFrom);
    if (index < 0) return false;
    const prefix = normalizedAnswer.slice(Math.max(0, index - 72), index);
    const currentClause = prefix.split(/[.!?;:]/).at(-1) || "";
    const isNegated =
      /\b(?:no|not|never|cannot|can't|do not|don't|must not|should not)\b(?:\s+[a-z0-9'/-]+){0,4}\s*$/.test(
        currentClause,
      );
    if (!isNegated) return true;
    searchFrom = index + normalizedPhrase.length;
  }

  return false;
}

function validateQuestionFrameScope(questionFrame: QuestionFrame | undefined, output: ModelOutput) {
  if (!questionFrame || questionFrame.scope === "comparison") return [];

  const answer = modelOutputText(output).join(" ");
  const errors: string[] = [];
  const mentionsDj = /\b(daymond\s+john|next\s+level\s+ceo|nlceo|dj(?:\s+show)?)\b/i.test(answer);
  const mentionsMain = /\b(main\s+istv|inside\s+success(?:\s+tv)?)\b/i.test(answer);
  const includesDjOnlyPolicy = /\$2,?500\s*(?:x|×)\s*4|\bno\s+cohort\s+rule\b/i.test(answer);
  const includesMainOnlyPolicy = /\$2,?000\s+same[- ]day|\bsunday\s+11:59\s*pm\s*et\b/i.test(answer);

  if (questionFrame.scope === "main_istv" && (mentionsDj || includesDjOnlyPolicy)) {
    errors.push("product-scope: main ISTV answer must not include DJ/NLCEO policy or pricing");
  }
  if (questionFrame.scope === "dj_nlceo" && includesMainOnlyPolicy) {
    errors.push("product-scope: DJ/NLCEO answer must not include main ISTV-only discount or deadline policy");
  }
  if (questionFrame.excludedScopes.includes("main_istv") && mentionsMain) {
    errors.push("product-exclusion: answer mentions explicitly excluded main ISTV");
  }
  if (questionFrame.excludedScopes.includes("dj_nlceo") && mentionsDj) {
    errors.push("product-exclusion: answer mentions explicitly excluded DJ/NLCEO");
  }

  return errors;
}

function criticalRuleAllowsConciseConfirmation(input: { rule: CriticalAnswerRule; latestQuestion: string; answerText: string }) {
  if (!input.rule.id.startsWith("dj-nlceo-")) return false;
  if (!isConcisePromiseConfirmation(input.latestQuestion)) return false;

  const answer = normalizeText(input.answerText);
  const hasNoPromiseBoundary =
    /\b(do not|don't|dont|cannot|can't|cant|should not|shouldn't|shouldnt)\b/.test(answer) &&
    /\b(promise|commit|guarantee|approve|hold|future payment|payment date|exception)\b/.test(answer);
  const hasConfirmOrRouteBoundary = /\b(confirm|check|route|owner|before promising|before you promise)\b/.test(answer);

  return hasNoPromiseBoundary && hasConfirmOrRouteBoundary;
}

function isConcisePromiseConfirmation(question: string) {
  const normalizedQuestion = normalizeText(question);
  const tokens = tokenize(normalizedQuestion, { expand: false });
  if (tokens.length > 24) return false;
  return (
    /^(so|basically|right|ok|okay|just to confirm)\b/.test(normalizedQuestion) ||
    /\b(right|correct|basically|just to confirm|to confirm)\b/.test(normalizedQuestion)
  ) && /\b(promise|promising|commit|hold|anything|confirm|route|payment date|future date)\b/.test(normalizedQuestion);
}

function policyBlockedAnswer(policyDecision: PolicyGuardDecision) {
  if (policyDecision.decision === "admin_only") {
    return "This is an admin or maintenance question, not a normal sales-call answer. Keep it in the admin workflow and do not use raw Slack messages to change what reps are told.";
  }

  if (policyDecision.blockedTopic === "greenlight-pdf-and-cohort-deadlines") {
    return "Use #greenlight-requests for greenlight letter requests, urgent sends, status, caps, cutoff timing, or stop questions. For main ISTV no-show, missed-deadline, rejection, or proof-exception cases, route nonstandard exceptions to Rich.";
  }

  if (policyDecision.blockedTopic === "sales-tech-routing-and-support-requests") {
    return "Use issue-type routing: #sales-tech-requests for sales-system tooling issues, #sales-finance-requests for billing/payment issues, #sales-questions-requests for sales-policy approval questions, and #greenlight-requests for greenlight letters.";
  }

  if (policyDecision.blockedTopic === "calendars-recordings-and-zoom-phone") {
    return "For calendar, rebooking, Zoom Phone, call, recording, Keap, form, dropdown, or other sales-system tooling issues, post in #sales-tech-requests before giving exact troubleshooting steps.";
  }

  if (policyDecision.blockedTopic === "new-rep-onboarding-and-final-mock") {
    return "I do not have a confirmed new-rep onboarding or final mock checklist yet. Route this to the current training owner before giving a final checklist.";
  }

  if (policyDecision.blockedTopic === "qualification-hospital-employed-doctor-conflict") {
    return "Current guidance conflicts on hospital-employed doctors who do not own a practice. Confirm this case with the current qualification owner before telling the prospect they qualify or do not qualify.";
  }

  if (policyDecision.blockedTopic === "accessibility-accommodation-unconfirmed") {
    return "Audio-description and other accessibility accommodation options are not confirmed. Check with the current production or accessibility owner before promising an accommodation to the prospect.";
  }

  if (policyDecision.blockedTopic === "commission-tier-and-leaderboard") {
    return "I do not have your live commission tier, leaderboard, or payout data. Check with the current sales/commission owner before relying on a number.";
  }

  return "I do not have a confirmed answer for that yet. Route this to the current sales owner or the right help channel before replying to the prospect.";
}

function policyBlockedRouteReason(policyDecision: PolicyGuardDecision) {
  if (policyDecision.blockedTopic === "qualification-hospital-employed-doctor-conflict") {
    return "Confirm this case with the current qualification owner before replying.";
  }
  if (policyDecision.blockedTopic === "accessibility-accommodation-unconfirmed") {
    return "Confirm available accommodations with the current production or accessibility owner before promising them.";
  }
  if (policyDecision.blockedTopic === "new-rep-onboarding-and-final-mock") {
    return "Confirm the current checklist with the training owner before relying on it.";
  }
  if (policyDecision.blockedTopic === "commission-tier-and-leaderboard") {
    return "Confirm live account-specific data with the current sales or commission owner.";
  }
  return "Confirm this with the current sales owner or the right help channel before replying.";
}

function buildPolicyBlockedDecision(policyDecision: PolicyGuardDecision): RuntimeDecision {
  return {
    outcome: policyDecision.decision === "admin_only" ? "admin_only" : "abstain_unapproved",
    sourceMode: "fallback",
    confidenceLabel: "Low",
    confidenceScore: 0,
    reason: policyDecision.reason,
    routeReason: policyDecision.decision === "admin_only" ? null : policyBlockedRouteReason(policyDecision),
    safeToGenerate: false,
    matchedRuleId: policyDecision.matchedRuleId,
    matchedArticleId: null,
    primaryArticle: null,
    retrieved: [],
  };
}

function buildEvidenceCandidates(
  question: string,
  conversationContext: string,
  policyDecision: PolicyGuardDecision,
  answerPlan?: AskSalesAnswerPlan,
): EvidenceCandidate[] {
  if (policyDecision.safeToGenerate && policyDecision.primaryArticle) {
    return buildPolicyScopedEvidenceCandidates(question, conversationContext, policyDecision.primaryArticle, answerPlan);
  }

  const approved = APPROVED_FAQ_ARTICLES.map((article) => approvedArticleToCandidate(article));
  const searchText = [question, conversationContext].filter(Boolean).join("\n");
  const chunkCandidates = retrieveCandidateChunks(searchText, 42, { expand: true })
    .filter((chunk) => chunk.source_type !== "approved_article")
    .map((chunk) => chunkToCandidate(chunk));
  const byId = new Map<string, EvidenceCandidate>();

  for (const candidate of [...approved, ...chunkCandidates]) {
    const existing = byId.get(candidate.id);
    if (!existing || candidate.score > existing.score) byId.set(candidate.id, candidate);
  }

  return Array.from(byId.values())
    .sort((left, right) => right.authority - left.authority || right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, 48);
}

function buildPolicyScopedEvidenceCandidates(
  question: string,
  conversationContext: string,
  primaryArticle: ApprovedFaqArticle,
  answerPlan?: AskSalesAnswerPlan,
): EvidenceCandidate[] {
  const primary = approvedArticleToCandidate(primaryArticle, answerPlan?.selectedPolicyUnits);
  const searchText = [question, conversationContext].filter(Boolean).join("\n");
  const scoped = retrieveCandidateChunks(searchText, 18, { expand: true })
    .filter((chunk) => chunk.source_type !== "approved_article")
    .filter((chunk) => scopedSupportChunkMatchesArticle(chunk, primaryArticle))
    .map((chunk) => chunkToCandidate(chunk))
    .sort((left, right) => right.score - left.score || right.authority - left.authority || left.id.localeCompare(right.id))
    .slice(0, 2);
  const byId = new Map<string, EvidenceCandidate>();

  for (const candidate of [primary, ...scoped]) {
    if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
  }

  return Array.from(byId.values());
}

function modelEvidenceCandidates(candidates: EvidenceCandidate[]) {
  // Raw Slack, transcript, governance, draft, and conflict chunks are discovery
  // evidence only. They may help offline coverage work, but they must never
  // authorize or word a production answer.
  return candidates.filter((candidate) => candidate.kind === "approved_article").slice(0, 1);
}

function scopedSupportChunkMatchesArticle(chunk: RetrievedChunk, article: ApprovedFaqArticle) {
  if (chunk.article_id === article.id) return true;

  const normalizedChunk = normalizeText(`${chunk.source_title} ${chunk.heading} ${chunk.category} ${chunk.text}`);
  const normalizedArticleId = normalizeText(article.id.replaceAll("-", " "));
  const normalizedArticleTitle = normalizeText(article.title);
  const sameCategory = normalizeText(chunk.category) === normalizeText(article.category);

  if (phrasePresent(normalizedArticleTitle, normalizedChunk) || phrasePresent(normalizedArticleId, normalizedChunk)) return true;
  if (sameCategory && chunk.authority >= 58) return true;

  const articleTokenSet = new Set(tokenize(`${article.id} ${article.title} ${article.category} ${article.body.slice(0, 1600)}`, { expand: true }));
  const strongArticleTokenMatches = chunk.matchedTokens.filter(
    (token) => articleTokenSet.has(token) && !SCOPED_EVIDENCE_WEAK_TOKENS.has(token),
  );

  return strongArticleTokenMatches.length >= 3 && chunk.score >= 4.5;
}

function approvedArticleToCandidate(article: ApprovedFaqArticle, policyUnits: ApprovedPolicyUnit[] = []): EvidenceCandidate {
  const policyText = policyUnits.length ? formatApprovedPolicyUnits(policyUnits) : article.body;
  return {
    id: `approved:${article.id}`,
    kind: "approved_article",
    articleId: article.id,
    articleStatus: "approved",
    sourceType: "approved_article",
    sourceTitle: policyUnits.length === 1 ? policyUnits[0].title : article.title,
    heading: policyUnits.length ? "Approved policy units" : "Approved FAQ article",
    category: article.category,
    riskLevel: article.riskLevel,
    authority: 100,
    trustLabel: "Approved FAQ article",
    lastReviewed: article.lastReviewed,
    text: policyText,
    score: 100,
    matchedTokens: [],
  };
}

function formatApprovedPolicyUnits(policyUnits: ApprovedPolicyUnit[]) {
  return policyUnits
    .map((unit) =>
      [
        `Policy unit: ${unit.title}`,
        `Approved guidance: ${unit.approved_text}`,
        `Route required: ${unit.route_required ? "yes" : "no"}`,
        unit.route_reason ? `Rep-facing route note: ${unit.route_reason}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

function chunkToCandidate(chunk: RetrievedChunk): EvidenceCandidate {
  return {
    id: `chunk:${chunk.id}`,
    kind: "source_chunk",
    articleId: chunk.article_id,
    articleStatus: chunk.article_status,
    sourceType: chunk.source_type,
    sourceTitle: chunk.source_title,
    heading: chunk.heading,
    category: chunk.category,
    riskLevel: chunk.risk_level,
    authority: chunk.authority,
    trustLabel: chunk.trust_label,
    lastReviewed: chunk.last_reviewed,
    text: chunk.text,
    score: chunk.score,
    matchedTokens: chunk.matchedTokens,
  };
}

function resolveSelectedEvidence(output: ModelOutput, candidates: EvidenceCandidate[], currentQuestion: string) {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const selected = (output.selected_source_ids || [])
    .map((id) => byId.get(id))
    .filter((candidate): candidate is EvidenceCandidate => Boolean(candidate));

  const validatedSelected = filterQuestionSupportedEvidence(selected, currentQuestion, output);
  if (validatedSelected.length) return validatedSelected.slice(0, 10);

  const fallback = filterQuestionSupportedEvidence(candidates, currentQuestion, output);
  if (fallback.length) return fallback.slice(0, 10);

  return [];
}

async function generateProviderAnswer(input: {
  currentQuestion: string;
  conversationContext: string;
  evidence: EvidenceCandidate[];
  policyDecision: PolicyGuardDecision;
  questionFrame: QuestionFrame;
  answerPlan: AskSalesAnswerPlan;
}): Promise<ProviderJsonResult<ModelOutput>> {
  const routeRequired = input.answerPlan.routeRequired || input.policyDecision.decision === "route_from_approved_article";
  const modelEvidence = modelEvidenceCandidates(input.evidence);
  return generateProviderJson({
    purpose: "answer generation",
    maxTokens: answerGenerationMaxTokens(input.policyDecision),
    messages: [
      {
        role: "system",
        content: [
          "You are Ask Sales FAQ, an internal AI assistant for sales reps on live calls.",
          "Use only the evidence packet. Do not invent facts, prices, discounts, owners, links, or exceptions.",
          "A policy guard and answer planner have already selected the approved sales guidance that controls this answer.",
          "Treat the approved policy units or approved article in the evidence packet as the complete authority for this answer.",
          "Raw Slack messages, transcripts, drafts, conflicts, and governance notes are never included as answer authority.",
          routeRequired
            ? "This policy decision requires routing. Give the safe boundary from the approved source and set needs_route to true."
            : "This policy decision allows a direct answer from the selected approved source unless the source itself says to route an edge case.",
          "Internally select the evidence by meaning, not by mechanical keyword overlap, then answer from that selected evidence.",
          "Answer the actual question asked. If the user asks for only one product, package, show, or topic, do not include unrelated sections.",
          "Start with the shortest useful direct answer for a rep on a live call.",
          "If the rep asks for a short reply, answer in one or two sentences while preserving required safety boundaries.",
          "For a simple route or confirmation question, put the complete useful answer in answer, keep it to one or two sentences, and leave sections empty unless the rep explicitly asks for steps, a checklist, options, or a script.",
          "Use sections only when they add useful steps, boundaries, or escalation details; do not create an Answer section just to repeat the first sentence.",
          "When the answer contains a list of shows, payment plans, packages, or steps, put the list entries in sections[].items instead of packing them into one paragraph.",
          "Use a section title like What you can say only for literal suggested wording. Use What you can do for action instructions.",
          "Do not turn simple answers into policy memos.",
          "The current user question is authoritative. Use recent conversation context only to resolve references or context-dependent follow-ups; never let old context override a clear current question.",
          "If payment/package context could refer to more than one product, use recent context only when it clearly names the product; otherwise label the product you are answering or ask a short clarifying question.",
          "If the current question is a short confirmation of the prior answer, answer in one or two direct sentences and do not repeat the full policy unless needed for safety.",
          "Never mention or apply a product listed as excluded. Do not contrast products unless the resolved scope is comparison.",
          "Write directly to the rep using you, you can say, do not promise, and route this. Do not write in third person as the rep should.",
          "Do not tell the rep or prospect you will connect them with a specialist, have someone reach out, or transfer them unless the approved evidence explicitly authorizes that exact handoff.",
          "Do not dump every related fact. Be direct first, then add only the context the rep needs.",
          "If the evidence is incomplete, say what is known and add a clear route note without pretending certainty.",
          "If the user asks where to check the current show list, answer from the approved show-list evidence and do not tell normal reps to check inaccessible internal channels as the primary answer.",
          "Never expose source IDs, file paths, article statuses, Slack links, implementation details, knowledge base wording, approved article wording, route-only labels, RAG, manifests, source coverage, or pending approval wording.",
          "Never say Slack evidence, Slack-level evidence, internal guidance, governance log, candidate answer, decision candidates, Evidence 1, Source 2, or similar source-review language.",
          "Do not explain why a fact is or is not approved. If something needs confirmation, say: Confirm this with the current sales owner before promising it.",
          "Return only JSON with keys: answer, summary, sections, selected_source_ids, needs_route, route_reason, confidence_label, confidence_score.",
          "sections must be an array of objects with title, optional body, optional items array, and optional tone: default, good, warning, or route.",
          "selected_source_ids must contain only IDs from the evidence packet and should list the sources actually used for the answer.",
          "confidence_score must be an integer from 0 to 100, not a 0-to-1 decimal. confidence_label must match the score: High 80-100, Medium 50-79, Low 0-49.",
          `JSON example shape: ${JSON_SCHEMA_EXAMPLE}`,
          "Return valid JSON only. Do not use markdown. The first character must be { and the last character must be }.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          "POLICY DECISION:",
          input.policyDecision.decision,
          "",
          "MATCHED POLICY REASON:",
          input.policyDecision.reason,
          "",
          "ROUTE REQUIRED:",
          routeRequired ? "yes" : "no",
          "",
          "RESOLVED PRODUCT SCOPE:",
          input.answerPlan.resolvedProductScope,
          "",
          "EXCLUDED PRODUCT SCOPES:",
          input.answerPlan.excludedScopes.length ? input.answerPlan.excludedScopes.join(", ") : "None",
          "",
          "SELECTED POLICY UNITS:",
          input.answerPlan.selectedPolicyUnits.length
            ? input.answerPlan.selectedPolicyUnits.map((unit) => unit.id).join(", ")
            : "No atomic unit; use only the selected approved article.",
          "",
          "EVIDENCE PACKET:",
          formatEvidencePacket(modelEvidence, {
            approvedArticleChars: DEFAULT_APPROVED_ARTICLE_PROMPT_CHARS,
            sourceChunkChars: DEFAULT_SUPPORT_CHUNK_PROMPT_CHARS,
          }),
          "",
          "RECENT CONVERSATION CONTEXT:",
          input.conversationContext || "None",
          "",
          "CURRENT USER QUESTION:",
          input.currentQuestion,
          "",
          "RESOLVED QUESTION FOR POLICY:",
          input.questionFrame.effectiveQuestion,
        ].join("\n"),
      },
    ],
    parse: parseModelOutput,
  });
}

async function ensureRepFacingOutput(input: { currentQuestion: string; output: ModelOutput }): Promise<ModelOutputResolution> {
  if (!modelOutputContainsHiddenTerms(input.output)) return { output: input.output, diagnostics: [] };

  try {
    const rewrite = await generateProviderJson<ModelOutput>({
      purpose: "rep-facing wording repair",
      maxTokens: 900,
      messages: [
        {
          role: "system",
          content: [
            "You rewrite Ask Sales FAQ answers so they sound like a polished internal sales assistant, not an internal QA or source-review tool.",
            "Preserve the answer's facts, warnings, route requirement, and confidence. Do not add new policy or remove useful sales guidance.",
            "Remove all internal source mechanics and review language. Never mention Slack, evidence numbers, source IDs, article IDs, knowledge base, approved articles, route-only labels, governance logs, internal guidance, RAG, manifests, or file paths.",
            "If a detail needs confirmation, use normal sales wording such as: \"Confirm this with the current sales owner before promising it.\"",
            "Do not tell the rep or prospect you will connect them with a specialist or that someone will reach out unless the approved evidence explicitly authorizes that handoff; rewrite to confirm with the current owner or post in the approved channel.",
            "Write directly to the rep using you, you can say, do not promise, and route this.",
            "Return valid JSON only with the same schema: answer, summary, sections, selected_source_ids, needs_route, route_reason, confidence_label, confidence_score.",
            `JSON example shape: ${JSON_SCHEMA_EXAMPLE}`,
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "CURRENT USER QUESTION:",
            input.currentQuestion,
            "",
            "DRAFT ANSWER JSON TO CLEAN UP:",
            JSON.stringify(input.output),
          ].join("\n"),
        },
      ],
      parse: parseModelOutput,
    });

    return {
      output: {
        ...rewrite.output,
        selected_source_ids: input.output.selected_source_ids,
        needs_route: input.output.needs_route,
        confidence_label: input.output.confidence_label,
        confidence_score: input.output.confidence_score,
      },
      diagnostics: [rewrite.diagnostics],
    };
  } catch (error) {
    console.warn("Ask Sales FAQ rep-facing wording repair failed", {
      error: sanitizeProviderError(error),
    });
    return { output: input.output, diagnostics: [] };
  }
}

async function ensureCriticalAnswer(input: {
  currentQuestion: string;
  routingQuestion: string;
  conversationContext: string;
  evidence: EvidenceCandidate[];
  policyDecision: PolicyGuardDecision;
  questionFrame: QuestionFrame;
  answerPlan: AskSalesAnswerPlan;
  output: ModelOutput;
}): Promise<ModelOutputResolution> {
  const validationQuestion = input.routingQuestion;
  const validationErrors = validateCriticalAnswer({
    currentQuestion: validationQuestion,
    latestQuestion: input.currentQuestion,
    policyDecision: input.policyDecision,
    questionFrame: input.questionFrame,
    answerPlan: input.answerPlan,
    output: input.output,
  });
  if (!validationErrors.length) return { output: input.output, diagnostics: [] };

  const plannedFallback = buildPolicyPlanFallback(input.answerPlan, input.policyDecision);
  if (plannedFallback) {
    const plannedFallbackErrors = validateCriticalAnswer({
      currentQuestion: validationQuestion,
      latestQuestion: input.currentQuestion,
      policyDecision: input.policyDecision,
      questionFrame: input.questionFrame,
      answerPlan: input.answerPlan,
      output: plannedFallback,
    });
    if (!plannedFallbackErrors.length) {
      return { output: plannedFallback, diagnostics: [], fallbackUsed: true };
    }
  }

  let repairFailure: unknown = null;
  let repairedErrors: string[] = [];

  try {
    const repair = await generateProviderJson<ModelOutput>({
      purpose: "critical answer repair",
      maxTokens: 950,
      messages: [
        {
          role: "system",
          content: [
            "You repair Ask Sales FAQ answers only when they missed or contradicted approved high-risk sales facts.",
            "Use only the evidence packet and the validation failures. Do not add new policies, links, owners, exceptions, or hidden source mechanics.",
            "Keep the answer concise, direct, and written to the rep as you.",
            "If the current question is only a short confirmation of the prior answer, repair it as one or two direct sentences while preserving the safety boundary.",
            "Return only JSON with keys: answer, summary, sections, selected_source_ids, needs_route, route_reason, confidence_label, confidence_score.",
            `JSON example shape: ${JSON_SCHEMA_EXAMPLE}`,
            "Return valid JSON only. The first character must be { and the last character must be }.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "CURRENT USER QUESTION:",
            input.currentQuestion,
            "",
            "RECENT CONVERSATION CONTEXT:",
            input.conversationContext || "None",
            "",
            "POLICY DECISION:",
            input.policyDecision.decision,
            "",
            "VALIDATION FAILURES TO FIX:",
            validationErrors.map((error) => `- ${error}`).join("\n"),
            "",
            "DRAFT ANSWER JSON:",
            JSON.stringify(input.output),
            "",
            "EVIDENCE PACKET:",
            formatEvidencePacket(modelEvidenceCandidates(input.evidence), {
              approvedArticleChars: DEFAULT_APPROVED_ARTICLE_PROMPT_CHARS,
              sourceChunkChars: DEFAULT_SUPPORT_CHUNK_PROMPT_CHARS,
            }),
          ].join("\n"),
        },
      ],
      parse: parseModelOutput,
    });

    const repairedOutput = await ensureRepFacingOutput({
      currentQuestion: input.currentQuestion,
      output: {
        ...repair.output,
        selected_source_ids: repair.output.selected_source_ids?.length
          ? repair.output.selected_source_ids
          : input.output.selected_source_ids,
      },
    });
    const diagnostics = [repair.diagnostics, ...repairedOutput.diagnostics];
    repairedErrors = validateCriticalAnswer({
      currentQuestion: validationQuestion,
      latestQuestion: input.currentQuestion,
      policyDecision: input.policyDecision,
      questionFrame: input.questionFrame,
      answerPlan: input.answerPlan,
      output: repairedOutput.output,
    });
    if (!repairedErrors.length) return { output: repairedOutput.output, diagnostics };
  } catch (error) {
    repairFailure = error;
  }

  const fallback = buildCriticalFallbackOutput(
    validationQuestion,
    input.policyDecision,
    input.questionFrame,
    input.answerPlan,
  );
  if (fallback) {
    const fallbackErrors = validateCriticalAnswer({
      currentQuestion: validationQuestion,
      latestQuestion: input.currentQuestion,
      policyDecision: input.policyDecision,
      questionFrame: input.questionFrame,
      answerPlan: input.answerPlan,
      output: fallback,
    });
    if (!fallbackErrors.length) return { output: fallback, diagnostics: [], fallbackUsed: true };

    console.warn("Ask Sales FAQ critical fallback failed validation", {
      matchedRuleId: input.policyDecision.matchedRuleId,
      articleId: input.policyDecision.articleId,
      errors: fallbackErrors,
    });
  }

  if (repairedErrors.length) {
    console.warn("Ask Sales FAQ critical answer repair still failed", {
      matchedRuleId: input.policyDecision.matchedRuleId,
      articleId: input.policyDecision.articleId,
      errors: repairedErrors,
    });
  } else if (repairFailure) {
    console.warn("Ask Sales FAQ critical answer repair failed", {
      matchedRuleId: input.policyDecision.matchedRuleId,
      articleId: input.policyDecision.articleId,
      error: sanitizeProviderError(repairFailure),
    });
  }

  throw new Error(`AI output failed critical answer validation: ${validationErrors.join("; ")}`);
}

async function ensureArticleRouterGrounding(input: {
  currentQuestion: string;
  conversationContext: string;
  evidence: EvidenceCandidate[];
  policyDecision: PolicyGuardDecision;
  questionFrame: QuestionFrame;
  answerPlan: AskSalesAnswerPlan;
  output: ModelOutput;
}): Promise<ModelOutputResolution> {
  if (input.policyDecision.routingSource !== "article_router") {
    return { output: input.output, diagnostics: [] };
  }

  const primaryArticle = input.policyDecision.primaryArticle;
  if (!primaryArticle) {
    throw new Error("Article router selected no primary article");
  }

  const check = await generateProviderJson<GroundingCheckOutput>({
    purpose: "approved article answer validation",
    maxTokens: 260,
    messages: [
      {
        role: "system",
        content: [
          "You validate an Ask Sales FAQ draft answer before a sales rep sees it.",
          "Return pass only if the draft answers the current question and every policy/fact in it is supported by the selected approved sales guidance.",
          "Recent conversation context may be used only to resolve references from the current question. The current question remains authoritative.",
          "Fail if the draft invents a policy, price, discount, owner, exception, hold, legal/compliance decision, or operational step not present in the selected guidance.",
          "Fail if the draft ignores a key product/show context from the recent conversation that is needed to answer the current follow-up.",
          "Return valid JSON only with keys: verdict, reason. verdict must be pass or fail.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          "CURRENT USER QUESTION:",
          input.currentQuestion,
          "",
          "RECENT CONVERSATION CONTEXT:",
          input.conversationContext || "None",
          "",
          "SELECTED APPROVED SALES GUIDANCE:",
          formatEvidencePacket([approvedArticleToCandidate(primaryArticle, input.answerPlan.selectedPolicyUnits)], {
            approvedArticleChars: DEFAULT_APPROVED_ARTICLE_PROMPT_CHARS,
            sourceChunkChars: DEFAULT_SUPPORT_CHUNK_PROMPT_CHARS,
          }),
          "",
          "DRAFT ANSWER JSON:",
          JSON.stringify(input.output),
          "",
          "RESOLVED PRODUCT SCOPE:",
          input.questionFrame.scope,
          "",
          "EXCLUDED PRODUCT SCOPES:",
          input.questionFrame.excludedScopes.length ? input.questionFrame.excludedScopes.join(", ") : "None",
        ].join("\n"),
      },
    ],
    parse: parseGroundingCheckOutput,
  });

  if (check.output.verdict !== "pass") {
    throw new Error(`Article-router answer validation failed: ${check.output.reason || "unsupported answer"}`);
  }

  return { output: input.output, diagnostics: [check.diagnostics] };
}

function criticalValidationQuestion(input: {
  currentQuestion: string;
  conversationContext: string;
  policyDecision: PolicyGuardDecision;
}) {
  if (
    input.conversationContext &&
    (input.policyDecision.routingSource === "context_rule" || input.policyDecision.routingSource === "article_router")
  ) {
    return buildContextualQuestion(input.currentQuestion, input.conversationContext);
  }

  return input.currentQuestion;
}

function buildDecision(input: {
  output: ModelOutput;
  evidence: EvidenceCandidate[];
  policyDecision: PolicyGuardDecision;
}): RuntimeDecision {
  const primaryArticle = input.policyDecision.primaryArticle || firstSelectedApprovedArticle(input.evidence);
  const selectedApproved = input.evidence.filter((candidate) => candidate.kind === "approved_article");
  const selectedEvidence = input.evidence.filter((candidate) => candidate.kind !== "approved_article");
  const policyRequiresRoute = input.policyDecision.decision === "route_from_approved_article";
  const needsRoute = policyRequiresRoute || Boolean(input.output.needs_route);
  const confidenceLabel = input.output.confidence_label || "Medium";
  const confidenceScore = clampConfidence(input.output.confidence_score ?? 72);
  const sourceMode =
    selectedApproved.length && selectedEvidence.length
      ? "mixed"
      : selectedApproved.length
        ? "approved"
        : selectedEvidence.length
          ? "evidence"
          : "fallback";
  const outcome: AskSalesFaqOutcome = needsRoute ? "route_from_approved_article" : "answer_from_approved_article";

  return {
    outcome,
    sourceMode: primaryArticle ? "approved" : sourceMode,
    confidenceLabel,
    confidenceScore,
    reason: input.output.summary || input.policyDecision.reason,
    routeReason: needsRoute ? input.output.route_reason || input.policyDecision.reason || "Confirm this with the current owner before relying on it." : null,
    safeToGenerate: true,
    matchedRuleId: input.policyDecision.matchedRuleId,
    matchedArticleId: primaryArticle?.id || input.policyDecision.articleId,
    primaryArticle,
    retrieved: input.evidence,
  };
}

function buildUnavailableDecision(candidates: EvidenceCandidate[]): RuntimeDecision {
  return {
    outcome: "safe_fallback",
    sourceMode: "fallback",
    confidenceLabel: "Low",
    confidenceScore: 0,
    reason: "AI provider was unavailable, so no content answer was generated.",
    routeReason: "AI provider unavailable.",
    safeToGenerate: false,
    matchedRuleId: "ai-provider-unavailable",
    matchedArticleId: null,
    primaryArticle: null,
    retrieved: candidates.slice(0, 8),
  };
}

function firstSelectedApprovedArticle(evidence: EvidenceCandidate[]) {
  const articleId = evidence.find((candidate) => candidate.kind === "approved_article" && candidate.articleId)?.articleId;
  if (!articleId) return null;
  return APPROVED_FAQ_ARTICLES.find((article) => article.id === articleId) || null;
}

function sourceSummaryFromDecision(decision: RuntimeDecision): AskSalesFaqRuntimeResult["source"] {
  const primary = decision.primaryArticle;
  const top = decision.retrieved[0];
  if (primary) {
    return {
      label: primary.title,
      lastReviewed: primary.lastReviewed,
      approved: true,
      sourceMode: decision.sourceMode,
      confidenceLabel: decision.confidenceLabel,
      confidenceScore: decision.confidenceScore,
      expandableDetails: `FAQ source reviewed on ${primary.lastReviewed}.`,
    };
  }
  if (top) {
    return {
      label: sourceTrustLabel(top.trustLabel),
      lastReviewed: top.lastReviewed || "2026-07-01",
      approved: top.kind === "approved_article",
      sourceMode: decision.sourceMode,
      confidenceLabel: decision.confidenceLabel,
      confidenceScore: decision.confidenceScore,
      expandableDetails: `Related sales guidance area: ${top.category}. Confirm unusual or time-sensitive cases with the current owner before promising them.`,
    };
  }
  return null;
}

function structured(input: {
  summary: string;
  sections: AskSalesFaqStructuredAnswer["sections"];
  decision: RuntimeDecision;
}): AskSalesFaqStructuredAnswer {
  return {
    summary: input.summary,
    sections: input.sections.filter((section) => section.body || section.items?.length),
    confidenceLabel: input.decision.confidenceLabel,
    confidenceScore: input.decision.confidenceScore,
    sourceMode: input.decision.sourceMode,
  };
}

function buildConversationContext(messages: AskSalesFaqChatMessage[]) {
  return messages
    .slice(0, -1)
    .filter((message) => message.content.trim())
    .slice(-6)
    .map((message) => `${message.role}: ${message.content.trim().slice(0, 600)}`)
    .join("\n");
}

function buildContextualQuestion(question: string, conversationContext: string) {
  if (!conversationContext) return question;
  return `Recent conversation context:\n${conversationContext}\n\nCurrent user question:\n${question}`;
}

function redactSensitiveText(value: string) {
  const redactions = new Set<string>();
  let text = value;

  text = text.replace(/\b(?:\d[ -]*?){13,19}\b/g, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19) {
      redactions.add("payment_number");
      return "[REDACTED_PAYMENT_NUMBER]";
    }
    return match;
  });

  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) {
    redactions.add("ssn");
    text = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]");
  }

  text = text.replace(/\b(password|passcode|api key|secret|token)\s*[:=]\s*\S+/gi, (match, label: string) => {
    redactions.add("secret");
    return `${label}: [REDACTED_SECRET]`;
  });

  return { text, redactions: Array.from(redactions).sort() };
}

type RetrievedChunk = RagChunk & {
  score: number;
  matchedTokens: string[];
};

function retrieveCandidateChunks(question: string, topK: number, options: { expand: boolean }): RetrievedChunk[] {
  const queryTokens = tokenize(question, { expand: options.expand });
  const queryTokenSet = new Set(queryTokens);
  const normalizedQuestion = normalizeText(question);

  const scored: RetrievedChunk[] = [];
  for (const chunk of INDEXED_CHUNKS) {
    const matchedTokens = Array.from(queryTokenSet).filter((token) => chunk.tokenSet.has(token));
    if (!matchedTokens.length) continue;

    let score = 0;
    for (const token of matchedTokens) {
      const frequency = chunk.tokens.filter((candidate) => candidate === token).length;
      score += 1 + Math.log(Math.max(1, frequency));
    }

    if (phrasePresent(chunk.source_title, normalizedQuestion)) score += 3;
    if (phrasePresent(chunk.heading, normalizedQuestion)) score += 2;
    if (chunk.source_type === "approved_article") score += 1.5;
    score += Math.min(2.2, chunk.authority / 55);
    score += matchedTokens.length / Math.max(2, queryTokenSet.size);

    scored.push({
      ...chunk,
      score: Number(score.toFixed(3)),
      matchedTokens,
    });
  }

  return scored
    .sort((left, right) => right.score - left.score || right.authority - left.authority || left.id.localeCompare(right.id))
    .slice(0, topK);
}

function tokenize(value: string, options: { expand: boolean }) {
  const tokens =
    normalizeText(value)
      .match(/[a-z0-9$]+/g)
      ?.filter((token) => token.length > 1 && !STOPWORDS.has(token)) || [];

  if (!options.expand) return tokens;

  const expanded = new Set(tokens);
  for (const expansion of QUERY_EXPANSIONS) {
    if (expansion.triggers.some((trigger) => expanded.has(normalizeText(trigger)))) {
      expansion.add.forEach((token) => expanded.add(normalizeText(token)));
    }
  }
  return Array.from(expanded);
}

function phrasePresent(needle: string, haystack: string) {
  return normalizeText(haystack).includes(normalizeText(needle));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replaceAll("next-level", "next level")
    .replaceAll("same-day", "same day")
    .replaceAll("call-2", "call 2")
    .replaceAll("call-1", "call 1")
    .replaceAll("tier-1", "tier 1")
    .replaceAll("red-carpet", "red carpet")
    .replaceAll("pay-to-play", "pay to play")
    .replace(/\bdj\b/g, "daymond john")
    .replace(/\$2\s*,?\s*000/g, " $2000 2000 $2,000 ")
    .replace(/\$2k\b/g, " $2000 2000 $2,000 ")
    .replace(/\bnlceo\b/g, "next level ceo")
    .replace(/\s+/g, " ")
    .trim();
}

function formatEvidencePacket(
  candidates: EvidenceCandidate[],
  options: { approvedArticleChars?: number; sourceChunkChars?: number; maxCharsPerItem?: number },
) {
  return candidates
    .map((candidate, index) => {
      const maxChars =
        candidate.kind === "approved_article"
          ? options.approvedArticleChars || options.maxCharsPerItem || DEFAULT_APPROVED_ARTICLE_PROMPT_CHARS
          : options.sourceChunkChars || options.maxCharsPerItem || DEFAULT_SUPPORT_CHUNK_PROMPT_CHARS;

      return [
        `EVIDENCE ${index + 1}`,
        `ID: ${candidate.id}`,
        `Trust: ${candidate.trustLabel}`,
        `Type: ${candidate.sourceType}`,
        `Category: ${candidate.category}`,
        `Risk: ${candidate.riskLevel}`,
        `Last reviewed: ${candidate.lastReviewed || "unknown"}`,
        `Title: ${candidate.sourceTitle}`,
        `Heading: ${candidate.heading}`,
        `Text: ${candidate.text.slice(0, maxChars)}`,
      ].join("\n");
    })
    .join("\n\n");
}

function evidencePromptCharCount(candidates: EvidenceCandidate[]) {
  return formatEvidencePacket(candidates, {
    approvedArticleChars: DEFAULT_APPROVED_ARTICLE_PROMPT_CHARS,
    sourceChunkChars: DEFAULT_SUPPORT_CHUNK_PROMPT_CHARS,
  }).length;
}

function answerGenerationMaxTokens(policyDecision: PolicyGuardDecision) {
  if (policyDecision.decision === "route_from_approved_article") return 900;
  if (policyDecision.articleId === "current-show-source") return 1300;
  return 1100;
}

function buildRuntimeMetadata(input: {
  evidence: EvidenceCandidate[];
  modelEvidence: EvidenceCandidate[];
  providerDiagnostics: ProviderCallDiagnostics[];
  criticalFallbackUsed: boolean;
  policyDecision: PolicyGuardDecision;
  questionFrame?: QuestionFrame;
  answerPlan?: AskSalesAnswerPlan;
}): AskSalesFaqRuntimeMetadata {
  const providerAttempts = input.providerDiagnostics.flatMap((diagnostic) => diagnostic.attempts);
  const latestDiagnostic = input.providerDiagnostics[input.providerDiagnostics.length - 1];

  return {
    providerAttempts,
    evidence: {
      totalCandidates: input.evidence.length,
      modelCandidates: input.modelEvidence.length,
      approvedCandidates: input.modelEvidence.filter((candidate) => candidate.kind === "approved_article").length,
      sourceChunkCandidates: input.modelEvidence.filter((candidate) => candidate.kind !== "approved_article").length,
      promptChars: evidencePromptCharCount(input.modelEvidence),
      candidates: input.evidence.slice(0, 12).map((candidate) => ({
        id: candidate.id,
        sourceType: candidate.sourceType,
        articleStatus: candidate.articleStatus,
        modelIncluded: input.modelEvidence.some((modelCandidate) => modelCandidate.id === candidate.id),
      })),
    },
    routing: {
      source: input.policyDecision.routingSource,
      matchedRuleId: input.policyDecision.matchedRuleId,
      articleId: input.policyDecision.articleId,
      confidenceScore: input.policyDecision.routingConfidence,
      usedConversationContext: input.policyDecision.usedConversationContext,
    },
    deepSeekThinkingDisabled: latestDiagnostic?.deepSeekThinkingDisabled ?? isDeepSeekThinkingDisabled(),
    claudeFallbackEnabled: latestDiagnostic?.claudeFallbackEnabled ?? isClaudeFallbackEnabled(),
    criticalFallbackUsed: input.criticalFallbackUsed,
    policyPlan:
      input.questionFrame && input.answerPlan
        ? {
            resolvedProductScope: input.answerPlan.resolvedProductScope,
            excludedProductScopes: input.answerPlan.excludedScopes,
            questionRelation: input.questionFrame.relation,
            previousUserQuestionUsed: Boolean(input.questionFrame.rehydratedFromUserQuestion),
            selectedPolicyUnitIds: input.answerPlan.selectedPolicyUnits.map((unit) => unit.id),
            applicableCriticalRuleIds: input.answerPlan.applicableCriticalRuleIds,
            clarificationRequired: input.answerPlan.clarificationRequired,
            fallbackMode: input.answerPlan.fallbackMode,
          }
        : undefined,
  };
}

function isClaudeFallbackEnabled() {
  return process.env.FAQ_ALLOW_CLAUDE_FALLBACK === "true";
}

function isDeepSeekThinkingDisabled() {
  return process.env.FAQ_DEEPSEEK_DISABLE_THINKING !== "false";
}

function providerPromptChars(messages: Array<{ role: "system" | "user"; content: string }>) {
  return messages.reduce((total, message) => total + message.content.length, 0);
}

function buildProviderDiagnostics<T>(
  input: ProviderJsonInput<T>,
  options: {
    attempts: NonNullable<AskSalesFaqRuntimeMetadata["providerAttempts"]>;
    claudeFallbackEnabled: boolean;
    deepSeekThinkingDisabled: boolean;
    promptChars: number;
  },
): ProviderCallDiagnostics {
  return {
    purpose: input.purpose,
    attempts: options.attempts,
    deepSeekThinkingDisabled: options.deepSeekThinkingDisabled,
    claudeFallbackEnabled: options.claudeFallbackEnabled,
    promptChars: options.promptChars,
    maxTokens: input.maxTokens,
  };
}

function buildDeepSeekJsonRetryMessages<T>(input: ProviderJsonInput<T>, previousContent: string, parseError: string) {
  return [
    {
      role: "system" as const,
      content: [
        "Your previous Ask Sales FAQ response was not valid JSON for the required schema.",
        "Answer the same request again using only the approved evidence inside the original request below.",
        "Do not add facts, prices, discounts, owners, links, exceptions, or policy not present in that original request.",
        "Return one valid JSON object only. Do not use markdown.",
        `Required JSON shape: ${JSON_SCHEMA_EXAMPLE}`,
        `Previous parse/schema error: ${parseError}`,
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        "ORIGINAL REQUEST:",
        input.messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n"),
        "",
        "PREVIOUS INVALID RESPONSE:",
        previousContent.slice(0, 2400) || "(empty response)",
      ].join("\n"),
    },
  ];
}

function isLikelyThinkingParamError(error: string) {
  return /\bthinking\b/i.test(error) && /\b(unknown|unsupported|invalid|extra|parameter|field)\b/i.test(error);
}

type ProviderJsonInput<T> = {
  purpose: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  maxTokens: number;
  parse: (content: string) => T;
};

async function generateProviderJson<T>(input: ProviderJsonInput<T>): Promise<ProviderJsonResult<T>> {
  const deepSeekKey = process.env.DEEPSEEK_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const claudeFallbackEnabled = isClaudeFallbackEnabled();
  const deepSeekThinkingDisabled = isDeepSeekThinkingDisabled();
  const errors: string[] = [];
  const attempts: NonNullable<AskSalesFaqRuntimeMetadata["providerAttempts"]> = [];
  const promptChars = providerPromptChars(input.messages);

  if (deepSeekKey) {
    try {
      return await callDeepSeekJson(input, deepSeekKey, {
        attempts,
        claudeFallbackEnabled,
        deepSeekThinkingDisabled,
        promptChars,
      });
    } catch (error) {
      const sanitizedError = sanitizeProviderError(error);
      errors.push(`deepseek: ${sanitizedError}`);
      console.warn("Ask Sales FAQ provider attempt failed", {
        provider: "deepseek",
        purpose: input.purpose,
        error: sanitizedError,
      });
    }
  }

  if (anthropicKey && claudeFallbackEnabled) {
    try {
      return await callAnthropicJson(input, anthropicKey, {
        attempts,
        claudeFallbackEnabled,
        deepSeekThinkingDisabled,
        promptChars,
      });
    } catch (error) {
      const sanitizedError = sanitizeProviderError(error);
      errors.push(`anthropic: ${sanitizedError}`);
      console.warn("Ask Sales FAQ provider attempt failed", {
        provider: "anthropic",
        purpose: input.purpose,
        error: sanitizedError,
      });
    }
  }

  if (anthropicKey && !claudeFallbackEnabled) {
    errors.push("anthropic: skipped because FAQ_ALLOW_CLAUDE_FALLBACK is not true");
  }

  throw new Error(`No Ask Sales FAQ provider succeeded for ${input.purpose}. Attempts: ${errors.length}. ${errors.join(" | ")}`);
}

async function callDeepSeekJson<T>(
  input: ProviderJsonInput<T>,
  apiKey: string,
  options: {
    attempts: NonNullable<AskSalesFaqRuntimeMetadata["providerAttempts"]>;
    claudeFallbackEnabled: boolean;
    deepSeekThinkingDisabled: boolean;
    promptChars: number;
  },
): Promise<ProviderJsonResult<T>> {
  const model = process.env.FAQ_DEEPSEEK_MODEL || "deepseek-v4-pro";
  const primary = await fetchDeepSeekJsonCompletion({
    input,
    apiKey,
    model,
    messages: input.messages,
    maxTokens: input.maxTokens,
    thinkingDisabled: options.deepSeekThinkingDisabled,
    retry: false,
  });
  options.attempts.push(primary.attempt);

  if (primary.output.ok) {
    return {
      provider: "deepseek",
      model,
      output: primary.output.value,
      diagnostics: buildProviderDiagnostics(input, options),
    };
  }

  let retrySource = primary;
  let retryThinkingDisabled = options.deepSeekThinkingDisabled;

  if (options.deepSeekThinkingDisabled && isLikelyThinkingParamError(primary.output.error)) {
    const withoutThinking = await fetchDeepSeekJsonCompletion({
      input,
      apiKey,
      model,
      messages: input.messages,
      maxTokens: input.maxTokens,
      thinkingDisabled: false,
      retry: true,
    });
    options.attempts.push(withoutThinking.attempt);

    if (withoutThinking.output.ok) {
      return {
        provider: "deepseek",
        model,
        output: withoutThinking.output.value,
        diagnostics: buildProviderDiagnostics(input, {
          ...options,
          deepSeekThinkingDisabled: false,
        }),
      };
    }

    retrySource = withoutThinking;
    retryThinkingDisabled = false;
  }

  if (!retrySource.retryableJsonError) {
    throw new Error(retrySource.output.ok ? `DeepSeek ${input.purpose} request failed` : retrySource.output.error);
  }

  const retryError = retrySource.output.ok ? "DeepSeek JSON output did not match schema" : retrySource.output.error;
  const retry = await fetchDeepSeekJsonCompletion({
    input,
    apiKey,
    model,
    messages: buildDeepSeekJsonRetryMessages(input, retrySource.content, retryError),
    maxTokens: Math.min(input.maxTokens, 1200),
    thinkingDisabled: retryThinkingDisabled,
    retry: true,
  });
  options.attempts.push(retry.attempt);

  if (retry.output.ok) {
    return {
      provider: "deepseek",
      model,
      output: retry.output.value,
      diagnostics: buildProviderDiagnostics(input, options),
    };
  }

  throw new Error(retry.output.error || primary.output.error || `DeepSeek ${input.purpose} request failed`);
}

async function fetchDeepSeekJsonCompletion<T>(input: {
  input: ProviderJsonInput<T>;
  apiKey: string;
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  maxTokens: number;
  thinkingDisabled: boolean;
  retry: boolean;
}) {
  const startedAt = Date.now();
  const response = await fetchWithTimeout("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens,
      response_format: { type: "json_object" },
      ...(input.thinkingDisabled ? { thinking: { type: "disabled" } } : {}),
      messages: input.messages,
    }),
  });

  const data = (await safeJson(response)) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
    usage?: {
      prompt_cache_hit_tokens?: number;
      prompt_cache_miss_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  } | null;

  const latencyMs = Date.now() - startedAt;
  const content = data?.choices?.[0]?.message?.content || "";
  let output: { ok: true; value: T } | { ok: false; error: string };

  if (!response.ok) {
    output = {
      ok: false,
      error: data?.error?.message || `DeepSeek ${input.input.purpose} request failed with HTTP ${response.status}`,
    };
  } else {
    try {
      output = { ok: true, value: input.input.parse(content) };
    } catch (error) {
      output = { ok: false, error: sanitizeProviderError(error) };
    }
  }

  return {
    content,
    output,
    retryableJsonError: response.ok && !output.ok,
    attempt: {
      provider: "deepseek" as const,
      model: input.model,
      purpose: input.input.purpose,
      status: output.ok ? ("success" as const) : ("failed" as const),
      latencyMs,
      retry: input.retry || undefined,
      error: output.ok ? undefined : output.error,
      promptCacheHitTokens: data?.usage?.prompt_cache_hit_tokens,
      promptCacheMissTokens: data?.usage?.prompt_cache_miss_tokens,
      completionTokens: data?.usage?.completion_tokens,
      totalTokens: data?.usage?.total_tokens,
    },
  };
}

async function callAnthropicJson<T>(
  input: ProviderJsonInput<T>,
  apiKey: string,
  options: {
    attempts: NonNullable<AskSalesFaqRuntimeMetadata["providerAttempts"]>;
    claudeFallbackEnabled: boolean;
    deepSeekThinkingDisabled: boolean;
    promptChars: number;
  },
): Promise<ProviderJsonResult<T>> {
  const model = process.env.FAQ_CLAUDE_MODEL || "claude-sonnet-4-6";
  const system = input.messages.find((message) => message.role === "system")?.content || "";
  const user = input.messages.find((message) => message.role === "user")?.content || "";

  const startedAt = Date.now();
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: input.maxTokens,
      temperature: 0.15,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  const data = (await safeJson(response)) as {
    content?: Array<{ type?: string; text?: string }>;
    error?: { message?: string };
  } | null;

  const latencyMs = Date.now() - startedAt;
  if (!response.ok) throw new Error(data?.error?.message || `Anthropic ${input.purpose} request failed with HTTP ${response.status}`);

  const content = data?.content?.find((part) => part.type === "text" && part.text)?.text || "";
  const output = input.parse(content);
  options.attempts.push({
    provider: "anthropic",
    model,
    purpose: input.purpose,
    status: "success",
    latencyMs,
  });
  return { provider: "anthropic", model, output, diagnostics: buildProviderDiagnostics(input, options) };
}

function parseModelOutput(content: string): ModelOutput {
  const parsed = parseJsonObject<Partial<ModelOutput>>(content);

  if (!parsed.answer || typeof parsed.needs_route !== "boolean") {
    throw new Error("Model output did not match Ask Sales FAQ schema");
  }

  return normalizeModelOutput(parsed);
}

function parseConversationPlannerOutput(content: string): ConversationPlannerOutput {
  const parsed = parseJsonObject<Partial<ConversationPlannerOutput>>(content);
  const mode =
    parsed.mode === "conversation_reply" || parsed.mode === "approved_article" || parsed.mode === "unsupported"
      ? parsed.mode
      : "unsupported";
  const confidenceScore = parseConfidenceScore(parsed.confidence_score) ?? 0;
  const confidenceLabel = parseConfidenceLabel(parsed.confidence_label) || confidenceLabelFromScore(confidenceScore || 50);

  return {
    mode,
    answer: typeof parsed.answer === "string" ? sanitizeModelAnswer(parsed.answer).slice(0, 900) : "",
    summary: typeof parsed.summary === "string" ? sanitizeModelAnswer(parsed.summary).slice(0, 400) : "",
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    article_id: typeof parsed.article_id === "string" ? parsed.article_id.trim() || null : null,
    confidence_score: confidenceScore,
    confidence_label: confidenceLabel,
    needs_route: Boolean(parsed.needs_route),
    route_reason: typeof parsed.route_reason === "string" ? sanitizeModelAnswer(parsed.route_reason).slice(0, 400) : "",
    reason: typeof parsed.reason === "string" ? parsed.reason.trim().slice(0, 400) : "",
  };
}

function parseGroundingCheckOutput(content: string): GroundingCheckOutput {
  const parsed = parseJsonObject<Partial<GroundingCheckOutput>>(content);
  const verdict = typeof parsed.verdict === "string" && parsed.verdict.toLowerCase() === "pass" ? "pass" : "fail";
  return {
    verdict,
    reason: typeof parsed.reason === "string" ? parsed.reason.trim().slice(0, 400) : "",
  };
}

function parseJsonObject<T>(content: string): T {
  const trimmed = content.trim();
  const jsonText = trimmed.match(/```json\s*([\s\S]*?)```/)?.[1] || extractJsonObject(trimmed) || trimmed;
  return JSON.parse(jsonText) as T;
}

function extractJsonObject(value: string) {
  const start = value.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return value.slice(start, index + 1);
    }
  }

  return null;
}

function normalizeModelOutput(output: Partial<ModelOutput>): ModelOutput {
  const confidenceScore = parseConfidenceScore(output.confidence_score);
  return {
    answer: sanitizeModelAnswer(String(output.answer || "")),
    summary: typeof output.summary === "string" ? sanitizeModelAnswer(output.summary) : undefined,
    sections: Array.isArray(output.sections) ? output.sections : [],
    selected_source_ids: Array.isArray(output.selected_source_ids)
      ? output.selected_source_ids.filter((id): id is string => typeof id === "string").slice(0, 10)
      : [],
    needs_route: Boolean(output.needs_route),
    route_reason: typeof output.route_reason === "string" ? sanitizeModelAnswer(output.route_reason) : "",
    confidence_label: confidenceScore === undefined ? parseConfidenceLabel(output.confidence_label) : confidenceLabelFromScore(confidenceScore),
    confidence_score: confidenceScore,
  };
}

function normalizeModelStructuredAnswer(
  output: ModelOutput,
  answer: string,
  decision: RuntimeDecision,
): AskSalesFaqStructuredAnswer {
  const sections = Array.isArray(output.sections)
    ? output.sections
        .filter((section) => section && typeof section.title === "string")
        .map((section) => ({
          title: String(section.title),
          body: typeof section.body === "string" ? sanitizeModelAnswer(section.body) : undefined,
          items: Array.isArray(section.items)
            ? section.items.filter((item): item is string => typeof item === "string").map(sanitizeModelAnswer)
            : undefined,
          tone: parseSectionTone(section.tone),
        }))
    : [];
  const summary = sanitizeModelAnswer(output.summary || answer);
  const visibleSections = ensureAnswerVisibleInStructuredSections({
    answer,
    summary,
    sections,
    plainSummaryOnly: Boolean(output.display?.plainSummaryOnly),
  });

  return structured({
    summary,
    sections: visibleSections,
    decision: {
      ...decision,
      confidenceLabel: output.confidence_label || decision.confidenceLabel,
      confidenceScore: typeof output.confidence_score === "number" ? clampConfidence(output.confidence_score) : decision.confidenceScore,
    },
  });
}

function ensureAnswerVisibleInStructuredSections(input: {
  answer: string;
  summary: string;
  sections: AskSalesFaqStructuredAnswer["sections"];
  plainSummaryOnly: boolean;
}): AskSalesFaqStructuredAnswer["sections"] {
  const sections = input.sections.length || input.plainSummaryOnly ? input.sections : [{ title: "Answer", body: input.answer }];
  if (!input.answer.trim() || structuredVisibleTextCoversAnswer(input.answer, input.summary, sections)) return sections;

  const answerSectionTitle = inferAnswerVisibilitySectionTitle(input.answer);
  const answerSections = [{ title: answerSectionTitle, body: input.answer, tone: "default" as const }].flatMap((section) =>
    normalizeStructuredAnswerSections(section),
  ).filter((section): section is AskSalesFaqStructuredAnswer["sections"][number] => typeof section.title === "string");
  return mergeDuplicateDisplaySections([...answerSections, ...sections])
    .filter((section) => typeof section.title === "string")
    .map((section) => ({
      title: String(section.title),
      body: section.body,
      items: section.items,
      tone: parseSectionTone(section.tone),
    }));
}

function structuredVisibleTextCoversAnswer(
  answer: string,
  summary: string,
  sections: AskSalesFaqStructuredAnswer["sections"],
) {
  const normalizedAnswer = normalizeAnswerForCoverage(answer);
  if (!normalizedAnswer) return true;

  const visibleText = normalizeAnswerForCoverage(
    [
      summary,
      ...sections.flatMap((section) => [section.title, section.body, ...(section.items || [])]),
    ]
      .filter(Boolean)
      .join(" "),
  );
  if (!visibleText) return false;
  if (visibleText.includes(normalizedAnswer)) return true;

  const answerTokens = Array.from(new Set(tokenize(normalizedAnswer, { expand: false }).filter((token) => token.length > 2)));
  if (answerTokens.length < 8) return answerTokens.every((token) => visibleText.includes(token));

  const coveredTokens = answerTokens.filter((token) => visibleText.includes(token)).length;
  return coveredTokens / answerTokens.length >= 0.68;
}

function normalizeAnswerForCoverage(value: string) {
  return normalizeText(value.replace(/[$]/g, " $"));
}

function inferAnswerVisibilitySectionTitle(answer: string) {
  const normalizedAnswer = normalizeText(answer);
  if (/\b(show list|current shows|latest approved show list|legacy makers|masters of innovation)\b/.test(normalizedAnswer)) {
    return "Current shows";
  }
  if (/\b(payment options?|payment plans?|packages?|pif)\b/.test(normalizedAnswer)) {
    return "Payment options";
  }
  return "Answer";
}

function parseConfidenceLabel(value: unknown): "High" | "Medium" | "Low" | undefined {
  return value === "High" || value === "Medium" || value === "Low" ? value : undefined;
}

function parseConfidenceScore(value: unknown) {
  const numericValue = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(numericValue)) return undefined;
  return clampConfidence(numericValue >= 0 && numericValue <= 1 ? numericValue * 100 : numericValue);
}

function confidenceLabelFromScore(score: number): "High" | "Medium" | "Low" {
  if (score >= 80) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

function parseSectionTone(value: unknown): "default" | "good" | "warning" | "route" | undefined {
  return value === "default" || value === "good" || value === "warning" || value === "route" ? value : undefined;
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 60;
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function fetchWithTimeout(input: string, init: RequestInit) {
  const timeoutSeconds = Number(process.env.FAQ_MODEL_TIMEOUT_SECONDS || "60");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(8, timeoutSeconds) * 1000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function sanitizeModelAnswer(value: string) {
  return value
    .replace(/\b[Tt]he rep should\b/g, "You should")
    .replace(/\b[Rr]eps should\b/g, "You should")
    .replace(/\b[Rr]eps must\b/g, "You must")
    .replace(/\b[Rr]ep-facing\b/g, "sales")
    .trim();
}

function containsHiddenTerms(answer: string) {
  const normalizedAnswer = answer.toLowerCase();
  return (
    REP_FACING_INTERNAL_TERMS.some((term) => normalizedAnswer.includes(term)) ||
    REP_FACING_INTERNAL_PATTERNS.some((pattern) => pattern.test(answer)) ||
    UNAPPROVED_HANDOFF_PATTERNS.some((pattern) => pattern.test(answer))
  );
}

function modelOutputContainsHiddenTerms(output: ModelOutput) {
  return modelOutputText(output).some((value) => containsHiddenTerms(value));
}

function modelOutputText(output: ModelOutput) {
  return [
    output.answer,
    output.summary,
    output.route_reason,
    ...(output.sections || []).flatMap((section) => [section.title, section.body, ...(section.items || [])]),
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function sourceTrustLabel(value: string) {
  if (/approved/i.test(value)) return "FAQ source";
  return "Sales guidance";
}

function filterQuestionSupportedEvidence(candidates: EvidenceCandidate[], currentQuestion: string, output: ModelOutput) {
  const answerText = [output.answer, output.summary, output.route_reason].filter(Boolean).join(" ");
  return candidates
    .map((candidate) => ({
      candidate,
      supportScore: evidenceSupportScore(candidate, currentQuestion, answerText),
    }))
    .filter((item) => item.supportScore >= 3)
    .sort(
      (left, right) =>
        right.supportScore - left.supportScore ||
        right.candidate.authority - left.candidate.authority ||
        right.candidate.score - left.candidate.score ||
        left.candidate.id.localeCompare(right.candidate.id),
    )
    .map((item) => item.candidate);
}

function evidenceSupportScore(candidate: EvidenceCandidate, currentQuestion: string, answerText: string) {
  const searchText = normalizeText(`${currentQuestion} ${answerText}`);
  const candidateText = normalizeText(`${candidate.sourceTitle} ${candidate.heading} ${candidate.category} ${candidate.text}`);
  const queryTokens = Array.from(new Set(tokenize(searchText, { expand: true }))).filter((token) => token.length > 2);
  let score = 0;

  for (const token of queryTokens) {
    if (candidateText.includes(token)) score += 1;
  }

  const topicPairs: Array<[string[], string[], number]> = [
    [["same day discount", "$2000", "$2,000"], ["same day discount", "$2000", "$2,000"], 7],
    [["daymond john", "next level ceo"], ["daymond john", "next level ceo"], 6],
    [["upgrade", "before filming", "after filming"], ["upgrade", "before filming", "after filming"], 6],
    [["call 1", "investment", "pricing", "disqualify"], ["call 1", "investment", "pricing", "disqualify"], 6],
    [["show list", "tv shows"], ["show list", "latest approved show list"], 5],
    [["refund"], ["refund"], 5],
    [["recording"], ["recording"], 4],
  ];

  for (const [questionPhrases, candidatePhrases, boost] of topicPairs) {
    if (questionPhrases.some((phrase) => phrasePresent(phrase, searchText)) && candidatePhrases.some((phrase) => phrasePresent(phrase, candidateText))) {
      score += boost;
    }
  }

  if (candidate.kind === "approved_article") score += 1;
  return score;
}

function sanitizeProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[redacted_key]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted_key]")
    .slice(0, 500);
}
