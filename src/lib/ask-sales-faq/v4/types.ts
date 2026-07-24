import type { AskSalesFaqChatMessage, AskSalesFaqStructuredAnswer } from "@/lib/ask-sales-faq/types";
import type { V3BlockedTopic, V3Policy, V3Provider, V3ProviderAttempt, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import type { V4SystemicRelation, V4SystemicRequestKind } from "@/lib/ask-sales-faq/v4/systemic/relations";

export type V4Lane = "answer" | "partial" | "clarify" | "live_lookup" | "artifact" | "route" | "conversation";

export type V4Candidate = {
  policy: V3Policy;
  rank: number;
  score: number;
  reciprocalRankScore: number;
  lexicalScore: number;
  familyScore: number;
  characterScore: number;
  fieldScore: number;
  scopeScore: number;
  matchedTerms: string[];
  rankSources: Record<string, number>;
};

export type V4BlockedCandidate = {
  topic: V3BlockedTopic;
  score: number;
  matchedTerms: string[];
  matchKind: "canonical_family" | "legacy_anchor" | "structured";
};

export type V4RetrievalResult = {
  query: string;
  queryTokens: string[];
  expandedTokens: string[];
  candidates: V4Candidate[];
  blocked: V4BlockedCandidate[];
  corpusSize: number;
  stageTimings: Record<string, number>;
};

export type V4NeedLane = Exclude<V4Lane, "partial" | "conversation">;

export type V4PlannedNeed = {
  id: string;
  text: string;
  relation?: V4SystemicRelation;
  request_kind?: V4SystemicRequestKind;
  product_scope?: "main_istv" | "dj_nlceo" | "comparison" | "unknown";
  domains?: string[];
  actions?: string[];
  entities?: string[];
  lane: V4NeedLane;
  evidence_refs: string[];
  supported_claim: string;
  reason: string;
  route_key: string | null;
  clarification_question: string;
};

export type V4AnswerPlan = {
  needs: V4PlannedNeed[];
  overall_lane: V4Lane;
  confidence_score: number;
  reasoning_summary: string;
};

export type V4ComposedSentence = {
  id: string;
  text: string;
  need_ids: string[];
  evidence_refs: string[];
  kind: "answer" | "boundary" | "clarification";
};

export type V4Composition = {
  summary: string;
  sentences: V4ComposedSentence[];
};

export type V4SentenceCheck = {
  sentenceId: string;
  status: "supported" | "unsupported" | "irrelevant";
  evidenceRefs: string[];
  answeredNeedIds?: string[];
  reason: string;
  deterministicErrors: string[];
};

export type V4Validation = {
  verdict: "pass" | "repair" | "partial_recovery" | "route";
  sentenceChecks: V4SentenceCheck[];
  removedSentences: string[];
  unresolvedNeedIds: string[];
  reason: string;
};

export type V4EvidenceCitation = {
  policyId: string;
  title: string;
  decisionKey: string;
  lastReviewed: string;
  authority: number;
  sourceKind: string;
  approvedBy: string[];
};

export type V4RuntimeMetadata = {
  pipelineVersion: "v4-isolated" | "v4-systemic" | "v4-hybrid" | "v5-isolated" | "v5.1-isolated";
  isolation: {
    productionSelectorChanged: false;
    databaseWrites: false;
    historyPersistence: false;
  };
  knowledgeVersion: string;
  authorityResolutionVersion?: string;
  turn: V3TurnResolution;
  retrieval: {
    corpusSize: number;
    candidateCount: number;
    candidates: Array<{
      id: string;
      rank: number;
      score: number;
      decisionKey: string;
      answerability: string;
      qualityTier: string;
      productScopes: string[];
      sourceKind?: string;
      temporalRisk?: string;
      relationScore?: number;
      semanticVectorScore?: number;
      matchedDecisionId?: string;
    }>;
    blockedTopicIds: string[];
    blockedMatches?: Array<{
      needId: string;
      topicId: string;
      score: number;
      matchedTerms: string[];
    }>;
    diagnostics?: {
      snapshotVersion: string;
      needs: Array<{
        needId: string;
        evidenceState?: "exact_evidence_found" | "exact_evidence_rejected" | "neighbor_only" | "knowledge_absent";
        documentsConsidered: number;
        hardCompatible: number;
        directLaneSelected: number;
        expansionLaneSelected: number;
        selectedPolicyIds: string[];
        rejectionCounts: Record<string, number>;
      }>;
    };
  };
  plan: V4AnswerPlan;
  sourcePlan?: {
    needs: Array<{
      needId: string;
      lane: "answer" | "route";
      directPolicyIds: string[];
      preferredPolicyIds: string[];
      excludedConflictPolicyIds: string[];
      reason: string;
    }>;
    reasoningSummary: string;
  };
  executionMode: {
    planning: "model" | "deterministic_governed" | "deterministic_fallback" | "systemic_model" | "systemic_fallback" | "systemic_champion" | "hybrid_model" | "hybrid_fallback" | "conversation";
    composition: "model" | "exact_evidence" | "not_required";
    validation: "model_and_deterministic" | "deterministic_exact_evidence" | "not_required";
  };
  championComparison?: {
    selected: "current_v4" | "systemic_expansion";
    championLane: V4Lane;
    systemicLane: V4Lane;
    selectionMode: "deterministic" | "evidence_arbiter" | "fail_closed" | "safety_veto";
    confidence: number | null;
    reason: string;
  };
  validation: V4Validation;
  providerAttempts: V3ProviderAttempt[];
  stageTimings: Record<string, number>;
};

export type AskSalesFaqV4Result = {
  ok: true;
  answer: string;
  structuredAnswer: AskSalesFaqStructuredAnswer;
  lane: V4Lane;
  needsRoute: boolean;
  routeReason: string | null;
  routeChannels: string[];
  provider: "deepseek" | "anthropic" | null;
  model: string | null;
  latencyMs: number;
  citations: V4EvidenceCitation[];
  selectedPolicyIds: string[];
  redactions: string[];
  runtimeMetadata: V4RuntimeMetadata;
};

export type V4RuntimeOptions = {
  provider?: V3Provider;
  validatorProvider?: V3Provider;
  skipModelValidation?: boolean;
  skipChampionComparison?: boolean;
};

export type V4RunInput = {
  question: string;
  messages?: AskSalesFaqChatMessage[];
  options?: V4RuntimeOptions;
};
