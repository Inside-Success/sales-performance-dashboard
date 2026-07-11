import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";

export type V3ProductScope = "main_istv" | "dj_nlceo" | "comparison" | "unknown";
export type V3TurnKind = "social" | "memory" | "rewrite" | "clarification" | "follow_up" | "new";

export type V3Policy = {
  id: string;
  policy_key: string;
  title: string;
  question_families: string[];
  decision: string;
  product_scopes: string[];
  domains: string[];
  actions: string[];
  entities: string[];
  risk_level: string;
  answerability: "answer_evidence" | "route_or_support" | "discovery_only";
  quality_tier: "canonical" | "supporting" | "trusted_evidence" | "contextual_evidence" | "discovery_only";
  quality_flags: string[];
  route_key: string | null;
  route_channel: string | null;
  route_reason: string;
  authority: number;
  effective_at: string;
  last_reviewed: string;
  source: {
    kind: string;
    article_id: string | null;
    ids: string[];
    approved_by: string[];
  };
  search_text: string;
};

export type V3BlockedTopic = {
  id: string;
  status: "open" | string;
  resolution?: string | null;
  blocked_topic_ids?: string[];
  question_families?: string[];
  product_scopes?: string[];
  domains?: string[];
  actions?: string[];
  entities?: string[];
};

export type V3PolicyRegistry = {
  schema_version: 3;
  knowledge_version: string;
  generated_at: string;
  policies: V3Policy[];
  blocked_topics: V3BlockedTopic[];
  resolved_overrides: Array<Record<string, unknown>>;
  route_catalog: Record<string, { channel: string; description: string }>;
  entity_catalog: string[];
};

export type V3TurnResolution = {
  kind: V3TurnKind;
  currentQuestion: string;
  standaloneQuestion: string;
  immediatePreviousUserQuestion: string | null;
  immediatePreviousAssistantAnswer: string | null;
  productScope: V3ProductScope;
  excludedScopes: Array<"main_istv" | "dj_nlceo">;
  memoryAnswer: string | null;
  usedImmediateContext: boolean;
  explicitCorrection: boolean;
  stylePreferences: string[];
  contextMessages: AskSalesFaqChatMessage[];
};

export type V3PolicyMatch = {
  policy: V3Policy;
  score: number;
  lexicalScore: number;
  phraseScore: number;
  trigramScore: number;
  familyScore: number;
  contextScore: number;
  scopeScore: number;
  matchedTerms: string[];
};

export type V3BlockedMatch = {
  topic: V3BlockedTopic;
  score: number;
  matchedTerms: string[];
};

export type V3RetrievalResult = {
  query: string;
  semanticQueries?: string[];
  preselectionCandidateCount?: number;
  evidenceSelectionReason?: string;
  candidates: V3PolicyMatch[];
  blocked: V3BlockedMatch[];
  queryTokens: string[];
  stageTimings: Record<string, number>;
};

export type V3CoverageItem = {
  need: string;
  status: "answered" | "partial" | "unresolved";
  policy_ids: string[];
  reason: string;
};

export type V3AnswerOutput = {
  mode: "answer" | "partial" | "route" | "conversation";
  answer: string;
  summary: string;
  sections: Array<{
    title: string;
    body?: string;
    items?: string[];
    tone?: "default" | "good" | "warning" | "route";
  }>;
  selected_policy_ids: string[];
  rejected_policy_ids: string[];
  coverage: V3CoverageItem[];
  sentence_evidence: Array<{ sentence: string; policy_ids: string[] }>;
  needs_route: boolean;
  route_key: string | null;
  route_reason: string;
  confidence_score: number;
};

export type V3ValidationResult = {
  verdict: "pass" | "repair" | "reject";
  mode?: V3AnswerOutput["mode"];
  answer: string;
  summary: string;
  sections: V3AnswerOutput["sections"];
  sentence_evidence: V3AnswerOutput["sentence_evidence"];
  coverage?: V3CoverageItem[];
  needs_route?: boolean;
  route_key?: string | null;
  route_reason?: string;
  removed_claims: string[];
  reason: string;
};

export type V3ProviderAttempt = {
  provider: "deepseek" | "anthropic";
  model: string;
  purpose: string;
  status: "success" | "failed";
  latencyMs: number;
  error?: string;
  promptChars?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningMode?: "enabled" | "disabled";
  temperature?: number;
};

export type V3ProviderResult<T> = {
  output: T;
  provider: "deepseek" | "anthropic";
  model: string;
  attempts: V3ProviderAttempt[];
};

export type V3ProviderInput<T> = {
  purpose: string;
  system: string;
  user: string;
  maxTokens: number;
  parse: (content: string) => T;
};

export type V3Provider = <T>(input: V3ProviderInput<T>) => Promise<V3ProviderResult<T>>;
