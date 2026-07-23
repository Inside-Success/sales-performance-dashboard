import type { V3Policy, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import type { V4SystemicRelation, V4SystemicRequestKind } from "@/lib/ask-sales-faq/v4/systemic/relations";

export type V4SystemicKnowledgeMetadata = {
  temporalRisk: "stable" | "time_sensitive" | "live_only";
  scopeRisk: "general" | "scoped" | "case_specific";
  sourceClass: "governed_policy" | "authoritative_operational_qna";
  ownerReviewRequired: boolean;
  sourceIds: string[];
};

export type V4SystemicPolicy = V3Policy & {
  systemic: V4SystemicKnowledgeMetadata;
};

export type V4SystemicNeed = {
  id: string;
  text: string;
  authorityText?: string;
  originalRequestText?: string;
  retrievalQueries: string[];
  productScope: "main_istv" | "dj_nlceo" | "comparison" | "unknown";
  domains: string[];
  actions: string[];
  entities: string[];
  relation: V4SystemicRelation;
  requestKind: V4SystemicRequestKind;
  ambiguity: "none" | "material";
  clarificationQuestion: string;
};

export type V4SystemicQueryPlan = {
  needs: V4SystemicNeed[];
  conversationIntent: "answer" | "social" | "rewrite" | "memory";
  reasoningSummary: string;
};

export type V4SystemicCandidate = {
  policy: V4SystemicPolicy;
  rank: number;
  score: number;
  matchedQueries: string[];
  matchedTerms: string[];
  lexicalScore: number;
  familyScore: number;
  characterScore: number;
  structuredScore: number;
  authorityScore: number;
  relationScore: number;
};

export type V4SystemicBlockedMatch = {
  needId: string;
  topicId: string;
  score: number;
  matchedTerms: string[];
};

export type V4SystemicRetrieval = {
  query: string;
  turn: V3TurnResolution;
  corpusSize: number;
  candidates: V4SystemicCandidate[];
  blockedTopicIds: string[];
  blockedMatches: V4SystemicBlockedMatch[];
  stageTimings: Record<string, number>;
};

export type V4SystemicNeedDecision = {
  needId: string;
  lane: "answer" | "clarify" | "route" | "live_lookup" | "artifact";
  evidenceRefs: string[];
  answerSentences: Array<{
    text: string;
    evidenceRefs: string[];
  }>;
  routeKey: "sales_policy" | "sales_tech" | "finance" | "fulfillment" | "greenlight" | null;
  clarificationQuestion: string;
  confidence: number;
  reason: string;
};

export type V4SystemicDraft = {
  needs: V4SystemicNeedDecision[];
  naturalAnswer: string;
  reasoningSummary: string;
};
