import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import { getV4SystemicCorpus } from "@/lib/ask-sales-faq/v4/systemic/corpus";
import { runAskSalesFaqV4SystemicCandidateWithProfile, type V4SystemicCandidateRuntimeProfile } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { AskSalesFaqV4Result, V4RuntimeOptions } from "@/lib/ask-sales-faq/v4/types";
import type { V4SystemicNeed, V4SystemicPolicy, V4SystemicQueryPlan, V4SystemicRetrieval } from "@/lib/ask-sales-faq/v4/systemic/types";
import { v52OperationalEffectErrors } from "@/lib/ask-sales-faq/v5/decision-contract";
import { naturalizeV512Decision, preferredV512EvidenceSentence, refineV512QueryPlan, resolveV512RouteKey, resolveV512Turn, v512ExactSourceFallbackSentence } from "@/lib/ask-sales-faq/v5-12/runtime";
import { V512_SOURCE_REVIEWED_POLICIES } from "@/lib/ask-sales-faq/v5-12/knowledge";
import { v513DecisionContractErrors } from "@/lib/ask-sales-faq/v5-13/decision-contract";
import { refineV514SourcePlanWithRawEntailment, v514VerifiedQuoteForNeed } from "@/lib/ask-sales-faq/v5-14/entailment";
import { getV514KnowledgeVersion, getV514OperationalPolicyCount, V514_CALL2_QUOTE_SEQUENCE_POLICY, V514_CURRENT_PRICES_AND_PLANS_POLICY, V514_DOCTOR_NURSE_ELIGIBILITY_POLICY, V514_WEEKLY_SUPPORT_DISCONTINUED_POLICY } from "@/lib/ask-sales-faq/v5-14/knowledge";
import { retrieveV514Policies } from "@/lib/ask-sales-faq/v5-14/retrieval";
import { V56_OWNER_CONFIRMED_POLICIES } from "@/lib/ask-sales-faq/v5-6/knowledge";

export const ASK_SALES_V514_PIPELINE_VERSION = "v5.14-isolated" as const;
export const ASK_SALES_V514_DECISION_LAYER_VERSION = "governed-source-preservation-quote-verified-projection-r1";

const policyById = new Map([
  ...getV4SystemicCorpus(),
  ...V56_OWNER_CONFIRMED_POLICIES,
  ...V512_SOURCE_REVIEWED_POLICIES,
  V514_WEEKLY_SUPPORT_DISCONTINUED_POLICY,
  V514_DOCTOR_NURSE_ELIGIBILITY_POLICY,
  V514_CALL2_QUOTE_SEQUENCE_POLICY,
  V514_CURRENT_PRICES_AND_PLANS_POLICY,
].map((policy) => [policy.id, policy]));

export function selectV514ActiveDirectPolicy(
  fallback: V4SystemicPolicy,
  corpus: V4SystemicPolicy[] = getV4SystemicCorpus(),
) {
  const released = corpus
    .filter((policy) =>
      policy.decision_key === fallback.decision_key &&
      policy.source.kind === "admin_approved_knowledge_release",
    )
    .sort((left, right) =>
      right.authority - left.authority ||
      right.effective_at.localeCompare(left.effective_at) ||
      right.last_reviewed.localeCompare(left.last_reviewed) ||
      left.id.localeCompare(right.id),
    )[0];
  return released || fallback;
}

export function v514PolicyById(id: string) {
  return policyById.get(id) || null;
}

type DirectDecision = { answer: string; policies: V4SystemicPolicy[]; kind: "conversation" | "policy" };

function naturalConversationDecision(question: string): DirectDecision | null {
  const text = question.trim().replace(/\s+/g, " ");
  if (/^(?:hi|hello|hey)(?:\s+there|\s+team)?[!.?\s]*$|^good\s+(?:morning|afternoon|evening)[!.?\s]*$|^how\s+are\s+you[!.?\s]*$/i.test(text)) {
    return { answer: "Hi! I’m ready whenever you are.", policies: [], kind: "conversation" };
  }
  if (/^(?:got\s+it|understood|okay|ok|perfect|great)[,!?.\s-]*(?:thanks|thank\s+you)?[!.?\s]*$|^(?:thanks|thank\s+you|appreciate\s+it)(?:\s+(?:for\s+that|for\s+everything|so\s+much))?[!.?\s]*$/i.test(text)) {
    return { answer: "You’re welcome!", policies: [], kind: "conversation" };
  }
  if (/^(?:goodbye|bye|see\s+you|talk\s+(?:to\s+you\s+)?later)(?:\s+for\s+now)?[!.?\s]*$/i.test(text)) {
    return { answer: "Goodbye! Come back anytime you have another sales question.", policies: [], kind: "conversation" };
  }
  return null;
}

function exactPolicyDecision(question: string): DirectDecision | null {
  const text = question.trim().replace(/\s+/g, " ");
  const exact = (id: string) => policyById.get(id);
  if (/\b(?:istv|inside\s+success)\b/i.test(text) && /\b(?:price|pricing|cost)\w*\b/i.test(text) &&
    /\b(?:payment\s+plans?|installments?|split\s+payments?)\b/i.test(text)) {
    const policy = selectV514ActiveDirectPolicy(V514_CURRENT_PRICES_AND_PLANS_POLICY);
    return { answer: policy.decision, policies: [policy], kind: "policy" };
  }
  if ((/\b(?:call\s*2|call\s*two|second\s+call)\b/i.test(text) ||
      /(?:\b20k\b|\$20,?000\b)[\s\S]{0,180}\b(?:price\s+objection|too\s+expensive|lite)\b/i.test(text)) &&
    /\b(?:package|pricing|prices?|quote|standard|vip|lite|upsell|downsell)\b/i.test(text) &&
    /\b(?:present|show|offer|quote|start|lead|choose|choice|upsell|downsell|all\s+three|which\s+package|package\s+first)\b/i.test(text)) {
    const policy = selectV514ActiveDirectPolicy(V514_CALL2_QUOTE_SEQUENCE_POLICY);
    return { answer: policy.decision, policies: [policy], kind: "policy" };
  }
  if (!/\bmoney\s+mondays?\b/i.test(text) &&
    /\b(?:six[ -]?months?|weekly)\b[\s\S]{0,120}\b(?:training|social\s*media\s+support|support\s+calls?)\b|\b(?:training|social\s*media\s+support|support\s+calls?)\b[\s\S]{0,120}\b(?:six[ -]?months?|weekly)\b/i.test(text)) {
    const policy = selectV514ActiveDirectPolicy(V514_WEEKLY_SUPPORT_DISCONTINUED_POLICY);
    return { answer: policy.decision, policies: [policy], kind: "policy" };
  }
  if (/\b(?:contract|agreement)\b/i.test(text) && /\b(?:attorney|lawyer|legal\s+(?:team|review))\b/i.test(text) &&
    /\b(?:send|share|copy|review|walk\s+through)\b/i.test(text)) {
    const policy = exact("v512src-attorney-contract-review-sequence");
    if (policy) return { answer: policy.decision, policies: [policy], kind: "policy" };
  }
  if (/\b(?:pay|paid|purchase)\b[\s\S]{0,80}\b(?:extra|more|additional)\b[\s\S]{0,100}\b(?:guarantee|force)\b[\s\S]{0,80}\b(?:apple\s*tv|tier[- ]?1|platform|placement|submission)\b|\b(?:guarantee|force)\b[\s\S]{0,80}\b(?:apple\s*tv|tier[- ]?1|platform|placement|submission)\b[\s\S]{0,100}\b(?:pay|paid|purchase)\b/i.test(text)) {
    const policy = exact("owner-vip-tier-one-platform-boundary");
    if (policy) return { answer: policy.decision, policies: [policy], kind: "policy" };
  }
  if (/\b(?:america['’]?s\s+(?:best|top)\s+doctors?|doctors?\s+show)\b/i.test(text) &&
    /\b(?:doctor|physician|m\.?d\.?)\b/i.test(text) && /\b(?:nurse|r\.?n\.?)\b/i.test(text) &&
    /\b(?:qualif|eligible|eligibility|fit)\w*\b/i.test(text)) {
    const policy = selectV514ActiveDirectPolicy(V514_DOCTOR_NURSE_ELIGIBILITY_POLICY);
    return { answer: policy.decision, policies: [policy], kind: "policy" };
  }
  return null;
}

export function v514BoundedDirectDecision(question: string): DirectDecision | null {
  return naturalConversationDecision(question) || exactPolicyDecision(question);
}

function boundedDirectResult(question: string, messages: AskSalesFaqChatMessage[], decision: DirectDecision): AskSalesFaqV4Result {
  const conversation = decision.kind === "conversation";
  const turn = resolveV512Turn(question, messages);
  const selectedPolicyIds = decision.policies.map((policy) => policy.id);
  const validation = {
    verdict: "pass" as const,
    sentenceChecks: [], removedSentences: [], unresolvedNeedIds: [],
    reason: conversation ? "No policy answer was required." : "A narrowly guarded exact governed decision was projected without model paraphrasing.",
  };
  return {
    ok: true,
    answer: decision.answer,
    structuredAnswer: {
      summary: decision.answer,
      sections: conversation ? [] : [{ title: "Guidance", items: [decision.answer], tone: "good" }],
      confidenceLabel: "High",
      confidenceScore: 100,
      sourceMode: conversation ? "conversation" : "evidence",
    },
    lane: conversation ? "conversation" : "answer",
    needsRoute: false,
    routeReason: null,
    routeChannels: [],
    provider: null,
    model: null,
    latencyMs: 0,
    citations: decision.policies.map((policy) => ({
      policyId: policy.id,
      title: policy.title,
      decisionKey: policy.decision_key,
      lastReviewed: policy.last_reviewed,
      authority: policy.authority,
      sourceKind: policy.source.kind,
      approvedBy: policy.source.approved_by,
    })),
    selectedPolicyIds,
    redactions: [],
    runtimeMetadata: {
      pipelineVersion: ASK_SALES_V514_PIPELINE_VERSION,
      isolation: { productionSelectorChanged: false, databaseWrites: false, historyPersistence: false },
      knowledgeVersion: getV514KnowledgeVersion(),
      turn,
      retrieval: { corpusSize: 0, candidateCount: decision.policies.length, candidates: decision.policies.map((policy) => ({
        id: policy.id, rank: 0, score: 1, decisionKey: policy.decision_key, answerability: policy.answerability,
        qualityTier: policy.quality_tier, productScopes: policy.product_scopes, sourceKind: policy.source.kind,
        temporalRisk: policy.systemic.temporalRisk, relationScore: 30, matchedDecisionId: `${policy.id}::v514-bounded-direct`,
      })), blockedTopicIds: [] },
      plan: { needs: [], overall_lane: conversation ? "conversation" : "answer", confidence_score: 100, reasoning_summary: conversation ? "Conversation-only turn." : "V5.14 bounded direct projection." },
      executionMode: { planning: conversation ? "conversation" : "deterministic_governed", composition: conversation ? "not_required" : "exact_evidence", validation: conversation ? "not_required" : "deterministic_exact_evidence" },
      validation,
      providerAttempts: [],
      stageTimings: { v514BoundedDirectProjection: 1, totalMs: 0 },
    },
  };
}

function preferredV514EvidenceSentence(
  need: V4SystemicNeed,
  plan: V4SystemicQueryPlan,
  retrieval: V4SystemicRetrieval,
  preferredPolicyIds: string[],
  metadata?: Record<string, unknown>,
) {
  if (preferredPolicyIds.length !== 1) return preferredV512EvidenceSentence(need, plan, retrieval, preferredPolicyIds, metadata);
  const policyId = preferredPolicyIds[0];
  const candidate = retrieval.candidates.find((item) => item.policy.id === policyId);
  const policy = candidate?.policy;
  const matchedDecisionId = candidate?.needScores?.[need.id]?.matchedDecisionId || "";
  const needsQuoteProjection =
    policy?.answerability === "route_or_support" ||
    policy?.id.startsWith("v514src-") ||
    matchedDecisionId.endsWith("::v514-governed-v3-preservation") ||
    matchedDecisionId.endsWith("::v514-exact-material-family");
  const quote = needsQuoteProjection ? v514VerifiedQuoteForNeed(need.id, policyId, metadata) : null;
  if (quote && policy && !v513DecisionContractErrors(need, { ...policy, decision: quote }).length) {
    return { text: naturalizeV512Decision(quote), policyId, evidence: `${policy.title}: ${quote}` };
  }
  return preferredV512EvidenceSentence(need, plan, retrieval, preferredPolicyIds, metadata);
}

const profile: V4SystemicCandidateRuntimeProfile = {
  pipelineVersion: ASK_SALES_V514_PIPELINE_VERSION,
  knowledgeVersion: getV514KnowledgeVersion,
  operationalPolicyCount: getV514OperationalPolicyCount,
  resolveTurn: resolveV512Turn,
  retrieve: retrieveV514Policies,
  refineQueryPlan: refineV512QueryPlan,
  resolveRouteKey: resolveV512RouteKey,
  sentenceBoundaryErrors: v52OperationalEffectErrors,
  allowGenericRichAuthority: false,
  skipLegacySourcePlanner: true,
  refineSourcePlanWithModel: refineV514SourcePlanWithRawEntailment,
  exactSourceFallbackSentence: v512ExactSourceFallbackSentence,
  disableDefaultExactSourceFallback: true,
  preferredExactEvidenceSentence: preferredV514EvidenceSentence,
  trustPreferredExactEvidence: true,
  trustPreferredCollectiveEvidence: true,
  precomposePreferredEvidence: true,
  appendRouteForAnsweredSupport: false,
  evidenceDraftPurpose: "v5_14_quote_verified_answer_projection_validation",
  evidenceDraftRetryPurpose: "v5_14_quote_verified_answer_projection_retry_validation",
  fallbackLabel: "Frozen V4",
  fallbackOnEmptyRetrieval: false,
  fallbackOnStageFailure: false,
};

export async function runAskSalesFaqV514(question: string, conversationMessages: AskSalesFaqChatMessage[] = [], options: V4RuntimeOptions = {}) {
  const direct = v514BoundedDirectDecision(question);
  if (direct) return boundedDirectResult(question, conversationMessages, direct);
  return runAskSalesFaqV4SystemicCandidateWithProfile(question, conversationMessages, options, profile);
}
