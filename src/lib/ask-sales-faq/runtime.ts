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
  sourceMode: "approved" | "evidence" | "mixed" | "fallback";
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
  routingSource: "direct_rule" | "context_rule" | "article_router" | "default";
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
};

type ArticleRouterOutput = {
  article_id?: string | null;
  confidence_score?: number | string | null;
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

const DEFAULT_APPROVED_ARTICLE_PROMPT_CHARS = 2600;
const DEFAULT_SUPPORT_CHUNK_PROMPT_CHARS = 700;
const ARTICLE_ROUTER_MIN_CONFIDENCE = 82;
const ARTICLE_ROUTER_MAX_BODY_CHARS = 900;
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

type CriticalAnswerRule = {
  id: string;
  articleId: string;
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
    id: "dj-nlceo-no-cohort-deposit-boundary",
    articleId: "main-istv-call-2-cohort-reschedule-rules",
    matchAnyGroups: [
      ["daymond john", "next level ceo", "dj", "nlceo"],
      ["cohort", "deadline", "initial deposit", "deposit", "funds", "need time", "pay/sign", "pay and sign", "sign up"],
    ],
    requiredAll: ["no cohort rule"],
    requiredAnyGroups: [
      ["no same-day discount", "same-day discount"],
      ["do not apply the main ISTV cohort", "main ISTV cohort rule does not apply", "main ISTV cohort"],
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
      ["do not apply", "main ISTV cohort", "main ISTV"],
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
    id: "pricing-standard-upgrade-discount",
    articleId: "istv-nlceo-pricing-and-same-day-discount",
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
    id: "main-istv-reapply-minimum",
    articleId: "greenlight-pdf-and-cohort-deadlines",
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
  const conversationContext = buildConversationContext(conversationMessages);
  const contextualQuestion = buildContextualQuestion(sanitizedQuestion, conversationContext);
  const providerDiagnostics: ProviderCallDiagnostics[] = [];
  let policyDecision = decidePolicyGuard(sanitizedQuestion, conversationContext);

  if (!policyDecision.safeToGenerate && shouldAttemptApprovedArticleRouter(policyDecision)) {
    const routerResult = await tryRouteWithApprovedArticle({
      currentQuestion: sanitizedQuestion,
      conversationContext,
    });
    if (routerResult.diagnostics) providerDiagnostics.push(routerResult.diagnostics);
    if (routerResult.decision) policyDecision = routerResult.decision;
  }

  const candidates = buildEvidenceCandidates(sanitizedQuestion, conversationContext, policyDecision);
  const baseRuntimeMetadata = buildRuntimeMetadata({
    evidence: candidates,
    modelEvidence: [],
    providerDiagnostics,
    criticalFallbackUsed: false,
    policyDecision,
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
        sections: [{ title: "What to do", body: answer, tone: policyDecision.decision === "admin_only" ? "default" : "route" }],
        decision,
      }),
      source: null,
      provider: null,
      model: null,
      errorClass: null,
      runtimeMetadata: baseRuntimeMetadata,
    });
  }

  try {
    const answerResult = await generateProviderAnswer({
      currentQuestion: sanitizedQuestion,
      conversationContext,
      evidence: candidates,
      policyDecision,
    });
    providerDiagnostics.push(answerResult.diagnostics);
    const finalOutputResult = await ensureRepFacingOutput({
      currentQuestion: sanitizedQuestion,
      output: answerResult.output,
    });
    providerDiagnostics.push(...finalOutputResult.diagnostics);
    const criticalOutputResult = await ensureCriticalAnswer({
      currentQuestion: sanitizedQuestion,
      conversationContext,
      evidence: candidates,
      policyDecision,
      output: finalOutputResult.output,
    });
    providerDiagnostics.push(...criticalOutputResult.diagnostics);
    const groundedOutputResult = await ensureArticleRouterGrounding({
      currentQuestion: sanitizedQuestion,
      conversationContext,
      evidence: candidates,
      policyDecision,
      output: criticalOutputResult.output,
    });
    providerDiagnostics.push(...groundedOutputResult.diagnostics);
    const finalOutput = groundedOutputResult.output;
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
      }),
    });
  } catch (error) {
    console.error("Ask Sales FAQ AI runtime failed", error);
    const fallbackOutput = buildCriticalFallbackOutput(
      criticalValidationQuestion({
        currentQuestion: sanitizedQuestion,
        conversationContext,
        policyDecision,
      }),
      policyDecision,
    );
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
      input.decision.outcome === "safe_fallback",
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

function decidePolicyGuard(question: string, conversationContext = ""): PolicyGuardDecision {
  const directDecision = matchPolicyGuard(question);
  if (directDecision.matchedRuleId !== "default-abstain") return directDecision;

  if (conversationContext && shouldUseConversationContextForPolicyGuard(question)) {
    const contextualDecision = matchPolicyGuard(buildContextualQuestion(question, conversationContext));
    if (contextualDecision.matchedRuleId !== "default-abstain") {
      return {
        ...contextualDecision,
        reason: `${contextualDecision.reason} Recent chat context was used only to resolve the context-dependent follow-up.`,
        routingSource: "context_rule",
        usedConversationContext: true,
      };
    }
  }

  return directDecision;
}

function matchPolicyGuard(question: string): PolicyGuardDecision {
  for (const [groupName, rules] of [
    ["adminOnlyRules", ASK_SALES_FAQ_POLICY_RULES.adminOnlyRules],
    ["abstainRules", ASK_SALES_FAQ_POLICY_RULES.abstainRules],
    ["routeRules", ASK_SALES_FAQ_POLICY_RULES.routeRules],
    ["answerRules", ASK_SALES_FAQ_POLICY_RULES.answerRules],
  ] as const) {
    for (const rule of rules) {
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

async function tryRouteWithApprovedArticle(input: {
  currentQuestion: string;
  conversationContext: string;
}): Promise<{ decision: PolicyGuardDecision | null; diagnostics?: ProviderCallDiagnostics }> {
  try {
    const router = await generateProviderJson<ArticleRouterOutput>({
      purpose: "approved article routing",
      maxTokens: 450,
      messages: [
        {
          role: "system",
          content: [
            "You are the internal Ask Sales FAQ article router.",
            "Your only job is to decide whether the sales rep's current question is clearly governed by one approved article from the catalog.",
            "Do not answer the sales question. Do not create policy. Do not infer exceptions, prices, discounts, owners, or process steps.",
            "Use recent conversation context only to resolve product/show/topic references from the current question, such as this, they, the client, DJ show, cohort, package, or payment.",
            "The current user question is authoritative. If the current question names a different product/show/topic than the recent context, follow the current question.",
            "Choose an article only when its approved guidance directly controls the answer. Shared words or a loose topic match are not enough.",
            "If none of the approved articles directly controls the answer, return article_id as null with a low confidence score.",
            "Return valid JSON only with keys: article_id, confidence_score, reason.",
            `Only scores ${ARTICLE_ROUTER_MIN_CONFIDENCE}-100 may be used for a clear approved article match.`,
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
      parse: parseArticleRouterOutput,
    });
    return {
      decision: buildPolicyDecisionFromArticleRouter(router.output, Boolean(input.conversationContext)),
      diagnostics: router.diagnostics,
    };
  } catch (error) {
    console.warn("Ask Sales FAQ approved article router failed", {
      error: sanitizeProviderError(error),
    });
    return { decision: null };
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

function formatArticleRouterCatalog() {
  return APPROVED_FAQ_ARTICLES.map((article, index) =>
    [
      `Article ${index + 1}`,
      `ID: ${article.id}`,
      `Title: ${article.title}`,
      `Category: ${article.category}`,
      `Risk: ${article.riskLevel}`,
      `Last reviewed: ${article.lastReviewed}`,
      `Guidance excerpt: ${compactArticleBodyForRouter(article.body)}`,
    ].join("\n"),
  ).join("\n\n");
}

function compactArticleBodyForRouter(body: string) {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_|`[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, ARTICLE_ROUTER_MAX_BODY_CHARS);
}

function shouldUseConversationContextForPolicyGuard(question: string) {
  const normalizedQuestion = normalizeText(question);
  const tokens = tokenize(normalizedQuestion, { expand: false });
  const hasContextReference =
    /^(and|also|then|so)\b/.test(normalizedQuestion) ||
    /\b(it|that|this|they|them|those|same|another|still|again|later|after|before|next|previous|above|there|one|ones)\b/.test(
      normalizedQuestion,
    );
  if (!hasContextReference) return false;
  if (tokens.length <= 14) return true;
  if (tokens.length > 44) return false;
  if (/\b(main istv|daymond john|next level ceo|nlceo|dj show|dj)\b/.test(normalizedQuestion)) return false;

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

function matchingCriticalRules(question: string, policyDecision: PolicyGuardDecision) {
  return CRITICAL_ANSWER_RULES.filter(
    (rule) => rule.articleId === policyDecision.articleId && criticalRuleMatchesQuestion(question, rule),
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

function buildCriticalFallbackOutput(question: string, policyDecision: PolicyGuardDecision) {
  const fallbackRule = matchingCriticalRules(question, policyDecision)[0];
  return fallbackRule ? cloneModelOutput(fallbackRule.fallback) : null;
}

function validateCriticalAnswer(input: {
  currentQuestion: string;
  policyDecision: PolicyGuardDecision;
  output: ModelOutput;
}) {
  const errors: string[] = [];
  const matchedRules = matchingCriticalRules(input.currentQuestion, input.policyDecision);
  if (!matchedRules.length) return errors;

  const answerText = modelOutputText(input.output).join(" ");

  for (const rule of matchedRules) {
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

    for (const phrase of rule.forbiddenAny || []) {
      if (phrasePresent(phrase, answerText)) {
        errors.push(`${rule.id}: answer must not include ${phrase}`);
      }
    }
  }

  return errors;
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

  return "I do not have a confirmed answer for that yet. Route this to the current sales owner or the right help channel before replying to the prospect.";
}

function buildPolicyBlockedDecision(policyDecision: PolicyGuardDecision): RuntimeDecision {
  return {
    outcome: policyDecision.decision === "admin_only" ? "admin_only" : "abstain_unapproved",
    sourceMode: "fallback",
    confidenceLabel: "Low",
    confidenceScore: 0,
    reason: policyDecision.reason,
    routeReason: policyDecision.decision === "admin_only" ? null : policyDecision.reason,
    safeToGenerate: false,
    matchedRuleId: policyDecision.matchedRuleId,
    matchedArticleId: null,
    primaryArticle: null,
    retrieved: [],
  };
}

function buildEvidenceCandidates(question: string, conversationContext: string, policyDecision: PolicyGuardDecision): EvidenceCandidate[] {
  if (policyDecision.safeToGenerate && policyDecision.primaryArticle) {
    return buildPolicyScopedEvidenceCandidates(question, conversationContext, policyDecision.primaryArticle);
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

function buildPolicyScopedEvidenceCandidates(question: string, conversationContext: string, primaryArticle: ApprovedFaqArticle): EvidenceCandidate[] {
  const primary = approvedArticleToCandidate(primaryArticle);
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
  const approved = candidates.filter((candidate) => candidate.kind === "approved_article").slice(0, 1);
  const support = candidates.filter((candidate) => candidate.kind !== "approved_article").slice(0, 2);
  return [...approved, ...support];
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

function approvedArticleToCandidate(article: ApprovedFaqArticle): EvidenceCandidate {
  return {
    id: `approved:${article.id}`,
    kind: "approved_article",
    articleId: article.id,
    articleStatus: "approved",
    sourceType: "approved_article",
    sourceTitle: article.title,
    heading: "Approved FAQ article",
    category: article.category,
    riskLevel: article.riskLevel,
    authority: 100,
    trustLabel: "Approved FAQ article",
    lastReviewed: article.lastReviewed,
    text: article.body,
    score: 100,
    matchedTokens: [],
  };
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
}): Promise<ProviderJsonResult<ModelOutput>> {
  const routeRequired = input.policyDecision.decision === "route_from_approved_article";
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
          "A policy guard or approved-article router has already selected the approved sales guidance that controls this answer.",
          "Treat the approved article as authoritative. Use any supporting evidence only for consistent context or wording; never use it to add, contradict, or extend policy.",
          routeRequired
            ? "This policy decision requires routing. Give the safe boundary from the approved source and set needs_route to true."
            : "This policy decision allows a direct answer from the selected approved source unless the source itself says to route an edge case.",
          "Internally select the evidence by meaning, not by mechanical keyword overlap, then answer from that selected evidence.",
          "Answer the actual question asked. If the user asks for only one product, package, show, or topic, do not include unrelated sections.",
          "The current user question is authoritative. Use recent conversation context only to resolve references or context-dependent follow-ups; never let old context override a clear current question.",
          "For DJ/NLCEO cohort or payment-timing questions, say the main ISTV cohort rule does not block them, but never approve a specific future payment date or hold; route or confirm payment-timing exceptions before promising.",
          "Write directly to the rep using you, you can say, do not promise, and route this. Do not write in third person as the rep should.",
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
  conversationContext: string;
  evidence: EvidenceCandidate[];
  policyDecision: PolicyGuardDecision;
  output: ModelOutput;
}): Promise<ModelOutputResolution> {
  const validationQuestion = criticalValidationQuestion({
    currentQuestion: input.currentQuestion,
    conversationContext: input.conversationContext,
    policyDecision: input.policyDecision,
  });
  const validationErrors = validateCriticalAnswer({
    currentQuestion: validationQuestion,
    policyDecision: input.policyDecision,
    output: input.output,
  });
  if (!validationErrors.length) return { output: input.output, diagnostics: [] };

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
    const repairedErrors = validateCriticalAnswer({
      currentQuestion: validationQuestion,
      policyDecision: input.policyDecision,
      output: repairedOutput.output,
    });
    if (!repairedErrors.length) return { output: repairedOutput.output, diagnostics };

    console.warn("Ask Sales FAQ critical answer repair still failed", {
      matchedRuleId: input.policyDecision.matchedRuleId,
      articleId: input.policyDecision.articleId,
      errors: repairedErrors,
    });
  } catch (error) {
    console.warn("Ask Sales FAQ critical answer repair failed", {
      matchedRuleId: input.policyDecision.matchedRuleId,
      articleId: input.policyDecision.articleId,
      error: sanitizeProviderError(error),
    });
  }

  const fallback = buildCriticalFallbackOutput(validationQuestion, input.policyDecision);
  if (fallback) return { output: fallback, diagnostics: [], fallbackUsed: true };

  throw new Error(`AI output failed critical answer validation: ${validationErrors.join("; ")}`);
}

async function ensureArticleRouterGrounding(input: {
  currentQuestion: string;
  conversationContext: string;
  evidence: EvidenceCandidate[];
  policyDecision: PolicyGuardDecision;
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
          formatEvidencePacket([approvedArticleToCandidate(primaryArticle)], {
            approvedArticleChars: DEFAULT_APPROVED_ARTICLE_PROMPT_CHARS,
            sourceChunkChars: DEFAULT_SUPPORT_CHUNK_PROMPT_CHARS,
          }),
          "",
          "DRAFT ANSWER JSON:",
          JSON.stringify(input.output),
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

function parseArticleRouterOutput(content: string): ArticleRouterOutput {
  const parsed = parseJsonObject<Partial<ArticleRouterOutput>>(content);
  const articleId = typeof parsed.article_id === "string" ? parsed.article_id.trim() : null;
  const confidenceScore = parseConfidenceScore(parsed.confidence_score) ?? 0;

  return {
    article_id: articleId || null,
    confidence_score: confidenceScore,
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

  return structured({
    summary: sanitizeModelAnswer(output.summary || answer),
    sections: sections.length ? sections : [{ title: "Answer", body: answer }],
    decision: {
      ...decision,
      confidenceLabel: output.confidence_label || decision.confidenceLabel,
      confidenceScore: typeof output.confidence_score === "number" ? clampConfidence(output.confidence_score) : decision.confidenceScore,
    },
  });
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
    REP_FACING_INTERNAL_PATTERNS.some((pattern) => pattern.test(answer))
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
