export type AskSalesFaqRole = "user" | "assistant";

export type AskSalesFaqChatMessage = {
  role: AskSalesFaqRole;
  content: string;
};

export type AskSalesFaqOutcome =
  | "answer_from_approved_article"
  | "route_from_approved_article"
  | "abstain_unapproved"
  | "admin_only"
  | "safe_fallback"
  | "feature_disabled"
  | "auth_blocked"
  | "validation_error";

export type AskSalesFaqSourceSummary = {
  label: string;
  lastReviewed: string;
  approved: true;
  expandableDetails?: string;
};

export type AskSalesFaqResponse = {
  ok: boolean;
  conversationId: string;
  messageId: string;
  answer: string;
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
  needsRoute: boolean;
  routeReason: string | null;
  provider: string | null;
  model: string | null;
  latencyMs: number;
  errorClass: string | null;
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
