export type AskSalesFaqRole = "user" | "assistant";

export type AskSalesFaqChatMessage = {
  role: AskSalesFaqRole;
  content: string;
};

export type AskSalesFaqOutcome =
  | "answer_from_approved_article"
  | "route_from_approved_article"
  | "answer_from_evidence"
  | "route_from_evidence"
  | "low_confidence_route"
  | "abstain_unapproved"
  | "admin_only"
  | "safe_fallback"
  | "feature_disabled"
  | "auth_blocked"
  | "validation_error";

export type AskSalesFaqSourceSummary = {
  label: string;
  lastReviewed: string;
  approved: boolean;
  sourceMode?: "approved" | "evidence" | "mixed" | "fallback";
  confidenceLabel?: "High" | "Medium" | "Low";
  confidenceScore?: number;
  expandableDetails?: string;
};

export type AskSalesFaqAnswerSection = {
  title: string;
  body?: string;
  items?: string[];
  tone?: "default" | "good" | "warning" | "route";
};

export type AskSalesFaqStructuredAnswer = {
  summary: string;
  sections: AskSalesFaqAnswerSection[];
  confidenceLabel: "High" | "Medium" | "Low";
  confidenceScore: number;
  sourceMode: "approved" | "evidence" | "mixed" | "fallback";
};

export type AskSalesFaqResponse = {
  ok: boolean;
  conversationId: string;
  messageId: string;
  answer: string;
  structuredAnswer?: AskSalesFaqStructuredAnswer | null;
  outcome: AskSalesFaqOutcome;
  source: AskSalesFaqSourceSummary | null;
  model: string | null;
  provider: "deepseek" | "anthropic" | "mock" | null;
  needsRoute: boolean;
  routeReason: string | null;
  redactions: string[];
  latencyMs: number;
};

export type AskSalesFaqConversationSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system_safe";
    content: string;
    outcome: string | null;
    sourceLabel: string | null;
    sourceLastReviewed: string | null;
    structuredAnswer?: AskSalesFaqStructuredAnswer | null;
    needsRoute: boolean;
    routeReason: string | null;
    provider: string | null;
    model: string | null;
    createdAt: string;
  }>;
};

export type AskSalesFaqLogPayload = {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  viewerEmail: string;
  viewerName: string | null;
  title: string;
  questionRedacted: string;
  answerRedacted: string;
  redactions: string[];
  outcome: AskSalesFaqOutcome;
  matchedArticleId: string | null;
  sourceLabel: string | null;
  sourceLastReviewed: string | null;
  structuredAnswer?: AskSalesFaqStructuredAnswer | null;
  needsRoute: boolean;
  routeReason: string | null;
  provider: string | null;
  model: string | null;
  latencyMs: number;
  errorClass: string | null;
};

export type AskSalesFaqDiagnosticPayload = {
  id: string;
  conversationId: string | null;
  viewerEmail: string;
  viewerName: string | null;
  eventType: string;
  detail: string | null;
  metadata: Record<string, unknown>;
};

export type AskSalesFaqFeedbackPayload = {
  id: string;
  messageId: string;
  conversationId: string;
  viewerEmail: string;
  rating: "up" | "down";
  comment: string | null;
};

export type AskSalesFaqFeedbackContext = {
  messageId: string;
  conversationId: string;
  conversationTitle: string | null;
  viewerEmail: string;
  rating: "up" | "down";
  comment: string | null;
  question: string | null;
  answer: string | null;
  outcome: string | null;
  sourceLabel: string | null;
  sourceLastReviewed: string | null;
  needsRoute: boolean;
  routeReason: string | null;
  provider: string | null;
  model: string | null;
  createdAt: string | null;
};

export type AskSalesFaqAdminMetric = {
  label: string;
  value: number;
  helper: string;
  tone: "default" | "good" | "warning";
};

export type AskSalesFaqAdminLogItem = {
  id: string;
  createdAt: string;
  viewerEmail: string;
  question: string | null;
  answer?: string | null;
  outcome?: string | null;
  decision?: string | null;
  sourceLabel?: string | null;
  provider?: string | null;
  model?: string | null;
  needsRoute?: boolean;
  routeReason?: string | null;
  confidenceLabel?: string | null;
  confidenceScore?: number | null;
  sourceMode?: string | null;
  rating?: "up" | "down";
  comment?: string | null;
  status?: string | null;
  reviewCategory?: string | null;
  reviewAction?: string | null;
};

export type AskSalesFaqAdminOverview = {
  generatedAt: string;
  metrics: AskSalesFaqAdminMetric[];
  recentMisses: AskSalesFaqAdminLogItem[];
  recentFeedback: AskSalesFaqAdminLogItem[];
  recentAnswers: AskSalesFaqAdminLogItem[];
};
